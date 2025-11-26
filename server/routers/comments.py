from typing import List, Optional
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


class CommentAdd(BaseModel):
    shoutout_id: int
    content: str


@router.post("/comment/add")
def add_comment(
    payload: CommentAdd,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    if not has_non_tag_content(payload.content):
        raise HTTPException(
            status_code=400,
            detail="Comment cannot be empty.",
        )
    c = models.Comment(
        shoutout_id=payload.shoutout_id,
        user_id=current_user.id,
        content=payload.content,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"message": "Comment added", "id": c.id}


@router.get("/comment/fetch/{shoutout_id}")
def fetch_comments(shoutout_id: int, db: Session = Depends(database.get_db)):
    comments = (
        db.query(models.Comment)
        .filter(models.Comment.shoutout_id == shoutout_id)
        .order_by(models.Comment.id.asc())
        .all()
    )
    users = {u.id: u for u in db.query(models.User).all()}
    items: List[dict] = []
    for c in comments:
        u = users.get(c.user_id)
        items.append(
            {
                "id": c.id,
                "content": c.content,
                "created_at": (
                    getattr(c, "created_at", None).isoformat()
                    if getattr(c, "created_at", None)
                    else None
                ),
                "user": {
                    "id": u.id,
                    "name": u.name,
                    "email": u.email,
                }
                if u
                else None,
            }
        )
    return {"items": items}
