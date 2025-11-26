from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from server import database, models, auth

router = APIRouter()


def ensure_admin(user) -> None:
    role_val = getattr(user.role, "value", str(user.role)) if user.role is not None else "employee"
    if role_val != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")


def extract_id_from_action(action: str):
    """Best-effort extraction of a numeric user id from an AdminLog action string.

    Looks for patterns like 'user #123' and returns the integer id when found.
    """
    import re

    if not action:
        return None
    m = re.search(r"user #(\d+)", str(action))
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


@router.get("/admin/users")
def admin_users(db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    ensure_admin(current_user)
    return [
        {"id": u.id, "name": u.name, "email": u.email, "department": u.department, "role": getattr(u.role, "value", str(u.role))}
        for u in db.query(models.User).all()
    ]


@router.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    ensure_admin(current_user)
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(u)
    db.commit()
    return {"message": "User deleted"}


@router.get("/admin/shoutouts")
def admin_shoutouts(db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    ensure_admin(current_user)
    return [
        {"id": s.id, "sender_id": s.sender_id, "message": s.message, "department": s.department}
        for s in db.query(models.Shoutout).order_by(models.Shoutout.id.desc()).limit(200).all()
    ]


@router.delete("/admin/shoutouts/{sid}")
def admin_delete_shoutout(sid: int, db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    ensure_admin(current_user)
    s = db.query(models.Shoutout).get(sid)
    if not s:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    # Delete dependent rows first to avoid FK constraint errors
    try:
        db.query(models.Reaction).filter(models.Reaction.shoutout_id == sid).delete()
    except Exception:
        db.rollback()
    try:
        db.query(models.Comment).filter(models.Comment.shoutout_id == sid).delete()
    except Exception:
        db.rollback()
    try:
        db.query(models.ShoutoutRecipient).filter(models.ShoutoutRecipient.shoutout_id == sid).delete()
    except Exception:
        db.rollback()
    try:
        db.query(models.Report).filter(models.Report.shoutout_id == sid).delete()
    except Exception:
        db.rollback()
    # Remove any admin logs tied to this shoutout
    try:
        db.query(models.AdminLog).filter(
            models.AdminLog.target_type == "shoutout",
            models.AdminLog.target_id == sid,
        ).delete()
    except Exception:
        db.rollback()
    db.delete(s)
    db.commit()
    return {"message": "Shoutout deleted"}


@router.delete("/admin/comments/{cid}")
def admin_delete_comment(cid: int, db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    ensure_admin(current_user)
    c = db.query(models.Comment).get(cid)
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    # Remove reports related to this comment
    try:
        db.query(models.Report).filter(models.Report.comment_id == cid).delete()
    except Exception:
        db.rollback()
    # Remove any admin logs tied to this comment
    try:
        db.query(models.AdminLog).filter(
            models.AdminLog.target_type == "comment",
            models.AdminLog.target_id == cid,
        ).delete()
    except Exception:
        db.rollback()
    db.delete(c)
    db.commit()
    return {"message": "Comment deleted"}


@router.get("/admin/reports")
def admin_reports(db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    ensure_admin(current_user)
    rows = db.query(models.Report).order_by(models.Report.id.desc()).all()
    return [
        {
            "id": r.id,
            "shoutout_id": r.shoutout_id,
            "comment_id": r.comment_id,
            "reported_by": r.reported_by,
            "reason": r.reason,
            "created_at": getattr(r, "created_at", None).isoformat() if getattr(r, "created_at", None) else None,
        }
        for r in rows
    ]


@router.get("/admin/notifications")
def admin_notifications(db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    """Lightweight admin notifications: recent user profile changes and reports."""
    ensure_admin(current_user)

    logs = db.query(models.AdminLog).order_by(models.AdminLog.id.desc()).limit(20).all()
    reports = db.query(models.Report).order_by(models.Report.id.desc()).limit(20).all()

    log_items = [
        {
            "type": "user_change",
            "id": log.id,
            "action": log.action,
            "target_id": log.target_id,
            "target_type": log.target_type,
            "created_at": getattr(log, "timestamp", None).isoformat() if getattr(log, "timestamp", None) else None,
        }
        for log in logs
    ]

    report_items = [
        {
            "type": "report",
            "id": r.id,
            "target_type": "report",
            "target_id": r.id,
            "shoutout_id": r.shoutout_id,
            "comment_id": r.comment_id,
            "reported_by": r.reported_by,
            "reason": r.reason,
            "created_at": getattr(r, "created_at", None).isoformat() if getattr(r, "created_at", None) else None,
        }
        for r in reports
    ]

    items = log_items + report_items
    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"items": items}


@router.post("/admin/notifications/retrofix")
def retrofix_notifications(db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    """Retroactively infer target_type/target_id for legacy AdminLog entries.

    This is intended as a one-off maintenance endpoint so old notifications
    can be navigated correctly in the UI.
    """
    ensure_admin(current_user)

    logs = db.query(models.AdminLog).all()
    updated = 0
    for log in logs:
        # Only touch entries that are missing a target_type
        if getattr(log, "target_type", None):
            continue

        text = (getattr(log, "action", "") or "").lower()

        if "tag" in text:
            # Tagging events typically refer to shoutouts; try to recover an id
            log.target_type = "shoutout"
            recovered_id = extract_id_from_action(log.action)
            if recovered_id is not None:
                log.target_id = recovered_id
            # Normalize legacy wording like "you were tagged" / "user profile updated"
            if "you were tagged" in text or "user profile updated" in text:
                log.action = "Tagged in shoutout - You were tagged."
            updated += 1
        elif "profile" in text or "user" in text:
            # Generic user/profile changes
            log.target_type = "user"
            if not getattr(log, "target_id", None):
                log.target_id = getattr(log, "admin_id", None)
            updated += 1

    db.commit()
    return {"updated": updated}


@router.post("/admin/reports/{rid}/dismiss")
def admin_dismiss_report(rid: int, db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    ensure_admin(current_user)
    r = db.query(models.Report).get(rid)
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    # Remove any admin logs tied to this report id
    try:
        db.query(models.AdminLog).filter(
            models.AdminLog.target_type == "report",
            models.AdminLog.target_id == rid,
        ).delete()
    except Exception:
        db.rollback()
    db.delete(r)
    db.commit()
    return {"message": "Report dismissed"}


@router.get("/admin/analytics")
def admin_analytics(db: Session = Depends(database.get_db), current_user = Depends(auth.get_current_user)):
    from sqlalchemy import func

    ensure_admin(current_user)
    # Top contributors
    top_contributors = [
        {"user_id": uid, "count": cnt}
        for uid, cnt in db.query(models.Shoutout.sender_id, func.count(models.Shoutout.id)).group_by(models.Shoutout.sender_id).order_by(func.count(models.Shoutout.id).desc()).limit(10)
    ]
    # Most tagged employees
    most_tagged = [
        {"user_id": uid, "count": cnt}
        for uid, cnt in db.query(models.ShoutoutRecipient.recipient_id, func.count(models.ShoutoutRecipient.id)).group_by(models.ShoutoutRecipient.recipient_id).order_by(func.count(models.ShoutoutRecipient.id).desc()).limit(10)
    ]
    # Most active departments
    active_depts = [
        {"department": dept, "count": cnt}
        for dept, cnt in db.query(models.Shoutout.department, func.count(models.Shoutout.id)).group_by(models.Shoutout.department).order_by(func.count(models.Shoutout.id).desc()).limit(10)
    ]
    return {"top_contributors": top_contributors, "most_tagged": most_tagged, "active_departments": active_depts}
