from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server import database, models, auth

router = APIRouter()


class ReactionToggle(BaseModel):
    shoutout_id: int
    type: str


@router.post("/reaction/toggle")
def toggle_reaction(
    payload: ReactionToggle,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    valid = {
        "like": models.ReactionType.like,
        "clap": models.ReactionType.clap,
        "star": models.ReactionType.star,
    }
    if payload.type not in valid:
        raise HTTPException(status_code=400, detail="Invalid reaction type")

    # Enforce only one reaction per user per shoutout
    # 1) If the user already has the SAME reaction on this shoutout, remove it (toggle off)
    existing_same = (
        db.query(models.Reaction)
        .filter(
            models.Reaction.shoutout_id == payload.shoutout_id,
            models.Reaction.user_id == current_user.id,
            models.Reaction.type == valid[payload.type],
        )
        .first()
    )
    if existing_same:
        db.delete(existing_same)
        db.commit()
        action = "removed"
    else:
        # 2) Remove any other reaction types by this user on the same shoutout
        db.query(models.Reaction).filter(
            models.Reaction.shoutout_id == payload.shoutout_id,
            models.Reaction.user_id == current_user.id,
        ).delete()

        # 3) Add the new reaction
        rec = models.Reaction(
            shoutout_id=payload.shoutout_id,
            user_id=current_user.id,
            type=valid[payload.type],
        )
        db.add(rec)
        db.commit()
        action = "added"

    counts = {
        "like": db.query(models.Reaction)
        .filter(
            models.Reaction.shoutout_id == payload.shoutout_id,
            models.Reaction.type == models.ReactionType.like,
        )
        .count(),
        "clap": db.query(models.Reaction)
        .filter(
            models.Reaction.shoutout_id == payload.shoutout_id,
            models.Reaction.type == models.ReactionType.clap,
        )
        .count(),
        "star": db.query(models.Reaction)
        .filter(
            models.Reaction.shoutout_id == payload.shoutout_id,
            models.Reaction.type == models.ReactionType.star,
        )
        .count(),
    }

    return {"status": action, "counts": counts}


@router.get("/reaction/counts/{shoutout_id}")
def reaction_counts(shoutout_id: int, db: Session = Depends(database.get_db)):
    return {
        "like": db.query(models.Reaction)
        .filter(
            models.Reaction.shoutout_id == shoutout_id,
            models.Reaction.type == models.ReactionType.like,
        )
        .count(),
        "clap": db.query(models.Reaction)
        .filter(
            models.Reaction.shoutout_id == shoutout_id,
            models.Reaction.type == models.ReactionType.clap,
        )
        .count(),
        "star": db.query(models.Reaction)
        .filter(
            models.Reaction.shoutout_id == shoutout_id,
            models.Reaction.type == models.ReactionType.star,
        )
        .count(),
    }
