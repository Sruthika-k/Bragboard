from typing import List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect, func

from server import database, models, auth
from server.database import engine

router = APIRouter()


DEFAULT_DEPARTMENTS = ["HR",
    "Finance",
    "Marketing",
    "Product Development",
    "Quality Assurance",
    "Security"]


@router.get("/")
def root():
    return {"message": "Backend is running"}


@router.get("/test-db")
def test_database(db: Session = Depends(database.get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"message": "✅ Database connection successful!"}
    except Exception as e:
        print(f"DATABASE ERROR in /test-db: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"❌ Database connection failed: {str(e)}",
        )


@router.get("/departments")
def get_departments(db: Session = Depends(database.get_db)):
    # For now, always return the fixed default department list.
    return {"departments": DEFAULT_DEPARTMENTS}


@router.get("/shoutout/feed")
def get_feed(
    department: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    dept = None
    if department == "mine":
        dept = current_user.department
    elif department and department.lower() != "all":
        dept = department

    q = db.query(models.Shoutout)
    if dept:
        q = q.filter(models.Shoutout.department == dept)
    q = q.order_by(models.Shoutout.id.desc()).limit(50)

    shoutouts = q.all()
    results = []

    user_map = {u.id: u for u in db.query(models.User).all()}

    for sh in shoutouts:
        rec_rows = (
            db.query(models.ShoutoutRecipient)
            .filter(models.ShoutoutRecipient.shoutout_id == sh.id)
            .all()
        )
        rec_users = []
        for r in rec_rows:
            u = user_map.get(r.recipient_id)
            if u:
                role_val = getattr(u.role, "value", str(u.role)) if u.role is not None else "employee"
                rec_users.append(
                    {
                        "id": u.id,
                        "name": u.name,
                        "email": u.email,
                        "department": u.department,
                        "role": role_val,
                    }
                )

        reaction_counts = {"like": 0, "clap": 0, "star": 0}
        reactors_map: Dict[str, List[Dict]] = {
            "like": [],
            "clap": [],
            "star": [],
        }
        try:
            react_rows = (
                db.query(models.Reaction)
                .filter(models.Reaction.shoutout_id == sh.id)
                .all()
            )
            for rr in react_rows:
                u = user_map.get(rr.user_id)
                if not u:
                    continue
                type_val = getattr(rr.type, "value", str(rr.type))
                if type_val in reaction_counts:
                    reaction_counts[type_val] += 1
                    role_val = getattr(u.role, "value", str(u.role)) if u.role is not None else "employee"
                    reactors_map[type_val].append(
                        {
                            "id": u.id,
                            "name": u.name,
                            "email": u.email,
                            "department": u.department,
                            "role": role_val,
                        }
                    )
        except Exception:
            pass

        try:
            comments_q = db.query(models.Comment).filter(
                models.Comment.shoutout_id == sh.id
            )
            comments_count = comments_q.count()
            tagged_in_comments = False
            if current_user is not None:
                name_marker = (
                    f"@{current_user.name}"
                    if getattr(current_user, "name", None)
                    else None
                )
                if name_marker:
                    for c in comments_q.all():
                        if c.user_id == current_user.id:
                            continue
                        if name_marker in (c.content or ""):
                            tagged_in_comments = True
                            break
        except Exception:
            comments_count = 0
            tagged_in_comments = False

        results.append(
            {
                "id": sh.id,
                "sender_id": sh.sender_id,
                "message": sh.message,
                "department": getattr(sh, "department", None),
                "image_url": getattr(sh, "image_url", None),
                "created_at": (
                    getattr(sh, "created_at", None).isoformat()
                    if getattr(sh, "created_at", None)
                    else None
                ),
                "recipients": rec_users,
                "reactions": reaction_counts,
                "reactors": reactors_map,
                "comments_count": comments_count,
                "tagged_in_comments": tagged_in_comments,
            }
        )

    return {"items": results}


@router.get("/debug/tables")
def debug_list_tables():
    insp = inspect(engine)
    return {"tables": insp.get_table_names()}


@router.post("/debug/create-tables")
def debug_create_tables():
    database.create_database_tables()
    insp = inspect(engine)
    return {"tables": insp.get_table_names()}
