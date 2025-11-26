import json
from datetime import datetime

from sqlalchemy.orm import Session

from server.database import SessionLocal
from server import models


BACKUP_PATH = "adminlog_migration_backup.json"


def _serialize_log(log: models.AdminLog):
    return {
        "id": log.id,
        "admin_id": log.admin_id,
        "action": log.action,
        "target_id": log.target_id,
        "target_type": log.target_type,
        "timestamp": getattr(log, "timestamp", None).isoformat() if getattr(log, "timestamp", None) else None,
    }


def backup_logs(logs, path: str = BACKUP_PATH):
    payload = {
        "created_at": datetime.utcnow().isoformat() + "Z",
        "count": len(logs),
        "items": [_serialize_log(l) for l in logs],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def migrate(db: Session) -> dict:
    """Best-effort migration from AdminLog -> Notification.

    This does NOT delete AdminLog rows; it only creates Notification rows
    where we can infer a reasonable target_type/target_id + user_id.
    """
    logs = db.query(models.AdminLog).all()
    if not logs:
        return {"logs": 0, "notifications_created": 0}

    backup_logs(logs)

    created = 0

    for log in logs:
        text = (log.action or "").lower()

        # Skip if we already have notifications pointing at this target_type/target_id
        # or if this log already has a clear user target and likely produced a Notification.
        # We keep this conservative to avoid duplicates.
        if log.target_type in ("shoutout", "comment", "report", "user") and log.target_id:
            # Heuristic: if it's a report/user/profile/password event, skip here –
            # newer code paths already create Notification rows directly.
            if any(word in text for word in ["profile", "password", "report"]):
                continue

        # Tagging related: "tag" in the message usually means shoutout mention
        if "tag" in text:
            # Try to recover a user id from pattern "user #<id>"
            import re

            m = re.search(r"user #(\d+)", log.action or "")
            user_id = int(m.group(1)) if m else None

            # If we can't parse the user, fall back to target_id as shoutout id
            shoutout_id = log.target_id

            if not shoutout_id:
                continue

            # We only create a Notification when we can attach it to a user
            if not user_id:
                continue

            title = "Tagged in shoutout"
            message = (log.action or "").strip() or None

            try:
                n = models.Notification(
                    user_id=user_id,
                    title=title,
                    message=message,
                    target_type="shoutout",
                    target_id=shoutout_id,
                )
                db.add(n)
                created += 1
            except Exception:
                db.rollback()
        # Other patterns (profile/password/report) are now handled directly by
        # dedicated notification creation paths, so we do not backfill them here
        # to avoid duplicates.

    db.commit()
    return {"logs": len(logs), "notifications_created": created}


def main():
    db = SessionLocal()
    try:
        result = migrate(db)
        print("Migration complete:", result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
