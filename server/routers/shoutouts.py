from typing import List, Optional, Dict
import json
import os
import re
import time

from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server import database, models, auth

router = APIRouter()


class ShoutoutCreate(BaseModel):
    message: str
    department: Optional[str] = None
    recipient_ids: List[int] = []
    image_url: Optional[str] = None


class ShoutoutOut(BaseModel):
    id: int
    sender_id: int
    message: str
    department: Optional[str] = None
    image_url: Optional[str] = None
    created_at: Optional[str] = None
    recipients: List["UserOut"] = []
    reactions: dict = {}
    reactors: Dict[str, List["UserOut"]] = {}
    comments_count: int = 0

    class Config:
        from_attributes = True


MENTION_PATTERN = re.compile(r"@\S+")


def has_non_tag_content(text: Optional[str]) -> bool:
    if not text or not text.strip():
        return False
    stripped = MENTION_PATTERN.sub("", text)
    return bool(stripped.strip())


UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


@router.post("/shoutout/create")
def create_shoutout(
    payload: ShoutoutCreate = Body(...),
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    if not has_non_tag_content(payload.message):
        raise HTTPException(
            status_code=400,
            detail="Shoutout message cannot be empty or only mentions",
        )
    if not payload.recipient_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one recipient.",
        )
    # Prevent self-tagging
    if any(int(rid) == int(current_user.id) for rid in (payload.recipient_ids or [])):
        raise HTTPException(
            status_code=400,
            detail="You cannot tag yourself.",
        )
    if not (current_user.department or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Please set your department before creating a shoutout",
        )

    sh = models.Shoutout(
        sender_id=current_user.id,
        message=payload.message,
        department=payload.department or current_user.department,
        image_url=None,
    )
    db.add(sh)
    db.commit()
    db.refresh(sh)

    for rid in (payload.recipient_ids or []):
        db.add(models.ShoutoutRecipient(shoutout_id=sh.id, recipient_id=rid))
    db.commit()

    # Lightweight notifications for tagged recipients (re-using AdminLog)
    try:
        sender_name = getattr(current_user, "name", None) or "Someone"
        for rid in (payload.recipient_ids or []):
            rid_int = int(rid)
            if rid_int == int(current_user.id):
                continue
            db.add(
                models.AdminLog(
                    admin_id=current_user.id,
                    action=f"Tagged in shoutout - {sender_name} tagged user #{rid_int}.",
                    target_id=sh.id,
                    target_type="shoutout",
                    type="tag",
                )
            )
        db.commit()
    except Exception:
        db.rollback()

    return {"message": "Shoutout created", "id": sh.id}


@router.post("/shoutout/create-with-image")
async def create_shoutout_with_image(
    message: str = Form(...),
    recipient_ids: str = Form("[]"),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    if not has_non_tag_content(message):
        raise HTTPException(
            status_code=400,
            detail="Shoutout message cannot be empty or only mentions",
        )

    if not (current_user.department or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Please set your department before creating a shoutout",
        )

    # Parse and validate recipient IDs
    try:
        rec_ids_raw = json.loads(recipient_ids or "[]")
        rec_ids = [int(x) for x in rec_ids_raw]
    except Exception:
        rec_ids = []

    if not rec_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one recipient.",
        )

    # Prevent self-tagging
    if any(int(rid) == int(current_user.id) for rid in rec_ids):
        raise HTTPException(
            status_code=400,
            detail="You cannot tag yourself.",
        )

    # Validate file type and size
    allowed_types = {"image/jpeg", "image/png"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only JPG and PNG image files are allowed (max 5MB)",
        )

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image file size too large.",
        )

    # Ensure upload directory exists and save file safely
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to prepare upload directory. Please try again later.",
        )

    name_root, ext = os.path.splitext(file.filename or "image")
    ext = ext.lower() or ".jpg"
    safe_name = f"shoutout_{int(time.time()*1000)}{ext}"
    path = os.path.join(UPLOAD_DIR, safe_name)

    try:
        with open(path, "wb") as f:
            f.write(data)
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to save image. Please try again later.",
        )

    image_url = f"/uploads/{safe_name}"

    sh = models.Shoutout(
        sender_id=current_user.id,
        message=message,
        department=current_user.department,
        image_url=image_url,
    )
    db.add(sh)
    db.commit()
    db.refresh(sh)

    for rid in rec_ids:
        db.add(models.ShoutoutRecipient(shoutout_id=sh.id, recipient_id=rid))
    db.commit()

    # Lightweight notifications for tagged recipients (re-using AdminLog)
    try:
        sender_name = getattr(current_user, "name", None) or "Someone"
        for rid in rec_ids:
            rid_int = int(rid)
            if rid_int == int(current_user.id):
                continue
            db.add(
                models.AdminLog(
                    admin_id=current_user.id,
                    action=f"Tagged in shoutout - {sender_name} tagged user #{rid_int}.",
                    target_id=sh.id,
                    target_type="shoutout",
                    type="tag",
                )
            )
        db.commit()
    except Exception:
        db.rollback()

    return {"id": sh.id, "image_url": image_url}
