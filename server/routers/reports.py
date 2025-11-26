from typing import Optional
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server import database, models, auth

router = APIRouter()


MENTION_PATTERN = re.compile(r"@\S+")


def has_non_tag_content(text: Optional[str]) -> bool:
    if not text or not text.strip():
        return False
    stripped = MENTION_PATTERN.sub("", text)
    return bool(stripped.strip())


class ReportShoutout(BaseModel):
    shoutout_id: int
    reason: str


class ReportComment(BaseModel):
    comment_id: int
    reason: str


@router.post("/shoutout/report")
def report_shoutout(
    payload: ReportShoutout,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    if not has_non_tag_content(payload.reason):
        raise HTTPException(
            status_code=400,
            detail="Report reason cannot be empty or only mentions",
        )
    r = models.Report(
        shoutout_id=payload.shoutout_id,
        reported_by=current_user.id,
        reason=payload.reason,
    )
    db.add(r)
    db.commit()
    try:
        db.refresh(r)
        db.add(
            models.AdminLog(
                admin_id=current_user.id,
                action="New Report - A shoutout was reported.",
                target_id=r.id,
                target_type="report",
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    return {"message": "Report submitted"}


@router.get("/reports/{report_id}")
def get_report_detail(report_id: int, db: Session = Depends(database.get_db), current_user=Depends(auth.get_current_user)):
    """Return a single report with its related shoutout, comment, and reporter info.
    Kept minimal and read-only for admin tooling.
    """
    r = db.query(models.Report).get(report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")

    shout = None
    if r.shoutout_id:
        s = db.query(models.Shoutout).get(r.shoutout_id)
        if s:
            shout = {
                "id": s.id,
                "sender_id": s.sender_id,
                "message": s.message,
                "department": getattr(s, "department", None),
                "image_url": getattr(s, "image_url", None),
            }

    comment = None
    if r.comment_id:
        c = db.query(models.Comment).get(r.comment_id)
        if c:
            comment = {
                "id": c.id,
                "shoutout_id": c.shoutout_id,
                "user_id": c.user_id,
                "content": c.content,
            }

    reporter = db.query(models.User).get(r.reported_by)
    reporter_info = None
    if reporter:
        reporter_info = {
            "id": reporter.id,
            "name": reporter.name,
            "email": reporter.email,
            "department": reporter.department,
        }

    return {
        "report": {
            "id": r.id,
            "shoutout_id": r.shoutout_id,
            "comment_id": r.comment_id,
            "reported_by": r.reported_by,
            "reason": r.reason,
            "created_at": getattr(r, "created_at", None).isoformat() if getattr(r, "created_at", None) else None,
        },
        "shoutout": shout,
        "comment": comment,
        "reporter": reporter_info,
    }


@router.post("/comment/report")
def report_comment(
    payload: ReportComment,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    if not has_non_tag_content(payload.reason):
        raise HTTPException(
            status_code=400,
            detail="Report reason cannot be empty or only mentions",
        )
    # Attach the parent shoutout to the report for easier navigation later
    c = db.query(models.Comment).get(payload.comment_id)
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    r = models.Report(
        shoutout_id=c.shoutout_id,
        comment_id=payload.comment_id,
        reported_by=current_user.id,
        reason=payload.reason,
    )
    db.add(r)
    db.commit()
    try:
        db.refresh(r)
        db.add(
            models.AdminLog(
                admin_id=current_user.id,
                action="New Report - A comment was reported.",
                target_id=r.id,
                target_type="report",
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    return {"message": "Report submitted"}
