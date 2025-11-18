from typing import Optional
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import database, models, auth

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
    return {"message": "Report submitted"}


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
    r = models.Report(
        shoutout_id=None,
        comment_id=payload.comment_id,
        reported_by=current_user.id,
        reason=payload.reason,
    )
    db.add(r)
    db.commit()
    return {"message": "Report submitted"}
