from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from server import database, models, auth

router = APIRouter()


def _serialize_notification(n: models.Notification):
    return {
        "id": n.id,
        "user_id": n.user_id,
        "actor_id": n.actor_id,
        "action": n.action,
        "target_type": n.target_type,
        "target_id": n.target_id,
        "created_at": getattr(n, "created_at", None).isoformat() if getattr(n, "created_at", None) else None,
        "is_read": bool(getattr(n, "is_read", False)),
    }


@router.get("/notifications")
def list_notifications(
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    """Return recent notifications for the current user, newest-first."""
    q = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc(), models.Notification.id.desc())
    )
    items: List[models.Notification] = q.limit(100).all()
    return {"items": [_serialize_notification(n) for n in items]}


@router.get("/notifications/{notif_id}")
def get_notification(
    notif_id: int,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    n = db.query(models.Notification).get(notif_id)
    if not n or n.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    return _serialize_notification(n)


@router.post("/notifications/read/{notif_id}")
def mark_read(
    notif_id: int,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    n = db.query(models.Notification).get(notif_id)
    if not n or n.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = 1
    db.add(n)
    db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id, models.Notification.is_read == 0)
        .update({models.Notification.is_read: 1})
    )
    db.commit()
    return {"ok": True}


@router.delete("/notifications/{notif_id}")
def delete_notification(
    notif_id: int,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    """Delete a notification only for the owning user."""
    n = db.query(models.Notification).get(notif_id)
    if not n or n.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(n)
    db.commit()
    return {"deleted": True}
