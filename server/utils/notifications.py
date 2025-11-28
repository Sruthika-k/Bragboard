from typing import Optional

from sqlalchemy.orm import Session

from server import models


def create_notification(
    db: Session,
    user_id: int,
    actor_id: Optional[int],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
):
    """Best-effort helper to create a Notification row.

    This must NEVER raise; it should swallow errors so primary flows
    (shoutouts, comments, reports, etc.) are not affected.
    """
    try:
        n = models.Notification(
            user_id=int(user_id),
            actor_id=int(actor_id) if actor_id is not None else None,
            action=action or "",
            target_type=target_type,
            target_id=int(target_id) if target_id is not None else None,
        )
        db.add(n)
        db.commit()
        db.refresh(n)
        return n
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        print("create_notification failed:", e)
        return None
