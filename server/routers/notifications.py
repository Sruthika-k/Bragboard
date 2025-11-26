from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from server import database, models, auth

router = APIRouter()


@router.delete("/notifications/{notif_id}")
def delete_notification(
    notif_id: int,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    """Delete a notification by id.

    Behaviour:
    - Admins may delete AdminLog-backed notifications (admin notifications)
      and also Notification rows if present.
    - Regular users may delete only Notification rows that belong to them.
    """
    role_val = getattr(current_user.role, "value", str(current_user.role)) if current_user.role is not None else "employee"

    # First, try to delete a user Notification row scoped to the current user
    notif = db.query(models.Notification).get(notif_id)
    if notif is not None:
        if notif.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not allowed to delete this notification")
        db.delete(notif)
        db.commit()
        return {"deleted": True}

    # If not found in Notification, admins may also delete AdminLog rows
    if role_val == "admin":
        log = db.query(models.AdminLog).get(notif_id)
        if not log:
            raise HTTPException(status_code=404, detail="Notification not found")
        db.delete(log)
        db.commit()
        return {"deleted": True}

    # Non-admin and nothing in Notification table: nothing to delete
    raise HTTPException(status_code=404, detail="Notification not found")
