from fastapi import FastAPI, Depends, HTTPException, Body, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from sqlalchemy import inspect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from .auth import get_current_user


# REMOVED: from sqlalchemy.ext.asyncio import AsyncSession - We are using synchronous Session from database.py
from .database import engine 
from . import database, models, auth 
import time 


def startup_event_handler():
    database.create_database_tables()


app = FastAPI(title="BragBoard API") 

# Configure CORS (Cross-Origin Resource Sharing)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,             
    allow_credentials=True,            
    allow_methods=["*"],               
    allow_headers=["*"],               
)


# FIX: Re-enable and update the startup event handler for table creation
# Use a plain function call for table creation or rely on the router endpoints.
# If you want to keep it as a function that can be called, ensure it's called.
# Since we can't guarantee how the user runs it, we'll define it as a plain function.
def create_database_tables():
    # Delegate to database module's function for single source of truth
    database.create_database_tables()


# Dependency to get the database session (defined in database.py)
# FIX: Use the dependency function from database.py directly to avoid duplication
get_db = database.get_db


@app.on_event("startup")
def on_startup():
    # Call the table creation function when the application starts
    create_database_tables()
    # Auto-seed if empty
    try:
        db = database.SessionLocal()
        user_count = db.query(models.User).count()
        if user_count == 0:
            print("🌱 Seeding database with demo data...")
            # Import here to avoid circular imports at module load time
            try:
                from .seed_data import seed_data
            except Exception:
                # Fallback for script-execution context
                import sys, os
                sys.path.append(os.path.dirname(os.path.dirname(__file__)))
                from server.seed_data import seed_data
            seed_data()
            print("✅ Database seeded successfully!")
        else:
            print("✅ Database tables checked/created successfully.")
    except Exception as e:
        print(f"⚠️ Startup seeding check failed: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass


@app.get("/")
def root():
    return {"message": "Backend is running"}


@app.get("/test-db")
def test_database(db: Session = Depends(get_db)):
    try:
        # Check if the connection is active and tables exist
        db.execute(text("SELECT 1")) 
        return {"message": "✅ Database connection successful!"}
    except Exception as e:
        print(f"DATABASE ERROR in /test-db: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"❌ Database connection failed: {str(e)}"
        )

app.include_router(auth.router)

# ------------------------------
# Minimal Schemas
# ------------------------------
class UserOut(BaseModel):
    id: int
    name: str
    email: str
    department: Optional[str] = None
    role: str
    class Config:
        from_attributes = True

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
    recipients: List[UserOut] = []
    reactions: dict = {}
    comments_count: int = 0

    class Config:
        from_attributes = True

# ------------------------------
# Utility: seed departments if empty
# ------------------------------
DEFAULT_DEPARTMENTS = ["Marketing", "Engineering", "HR", "Sales", "Finance"]

@app.get("/departments")
def get_departments(db: Session = Depends(get_db)):
    # Try to use Department table if present, else fall back to distinct user departments
    try:
        if hasattr(models, "Department"):
            rows = db.query(models.Department).all()
            if not rows:
                for name in DEFAULT_DEPARTMENTS:
                    db.add(models.Department(name=name))
                db.commit()
                rows = db.query(models.Department).all()
            return {"departments": [r.name for r in rows]}
    except Exception:
        db.rollback()
    # Fallback: distinct user departments
    depts = sorted({u.department for u in db.query(models.User).all() if u.department})
    if not depts:
        depts = DEFAULT_DEPARTMENTS
    return {"departments": depts}

# ------------------------------
# Users listing (for tagging dropdown)
# ------------------------------
@app.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    # Map enum role to value if needed
    out = []
    for u in users:
        role_val = getattr(u.role, "value", str(u.role)) if u.role is not None else "employee"
        out.append(UserOut(id=u.id, name=u.name, email=u.email, department=u.department, role=role_val))
    return out

# ------------------------------
# Shoutouts: create and feed
# ------------------------------

@app.post("/shoutout/create")
def create_shoutout(payload: ShoutoutCreate = Body(...), db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    sh = models.Shoutout(
        sender_id=current_user.id,
        message=payload.message,
        department=payload.department or current_user.department,
        # Ignore image field per new requirement; do not store
        image_url=None,
    )
    db.add(sh)
    db.commit()
    db.refresh(sh)
    # recipients linking
    for rid in (payload.recipient_ids or []):
        db.add(models.ShoutoutRecipient(shoutout_id=sh.id, recipient_id=rid))
    db.commit()
    return {"message": "Shoutout created", "id": sh.id}

@app.get("/shoutout/feed")
def get_feed(department: Optional[str] = None, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # department filter: None=all, "mine"=current user's department, or explicit name
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

    # Preload users to avoid many queries
    user_map = {u.id: u for u in db.query(models.User).all()}

    for sh in shoutouts:
        rec_rows = db.query(models.ShoutoutRecipient).filter(models.ShoutoutRecipient.shoutout_id == sh.id).all()
        rec_users = []
        for r in rec_rows:
            u = user_map.get(r.recipient_id)
            if u:
                role_val = getattr(u.role, "value", str(u.role)) if u.role is not None else "employee"
                rec_users.append(UserOut(id=u.id, name=u.name, email=u.email, department=u.department, role=role_val))
        # Reaction counts if table exists
        try:
            reaction_counts = {
                "like": db.query(models.Reaction).filter(models.Reaction.shoutout_id == sh.id, models.Reaction.type == models.ReactionType.like).count(),
                "clap": db.query(models.Reaction).filter(models.Reaction.shoutout_id == sh.id, models.Reaction.type == models.ReactionType.clap).count(),
                "star": db.query(models.Reaction).filter(models.Reaction.shoutout_id == sh.id, models.Reaction.type == models.ReactionType.star).count(),
            }
        except Exception:
            reaction_counts = {"like": 0, "clap": 0, "star": 0}
        try:
            comments_count = db.query(models.Comment).filter(models.Comment.shoutout_id == sh.id).count()
        except Exception:
            comments_count = 0
        results.append({
            "id": sh.id,
            "sender_id": sh.sender_id,
            "message": sh.message,
            "department": getattr(sh, "department", None),
            "image_url": getattr(sh, "image_url", None),
            "created_at": getattr(sh, "created_at", None).isoformat() if getattr(sh, "created_at", None) else None,
            "recipients": [ru.dict() for ru in rec_users],
            "reactions": reaction_counts,
            "comments_count": comments_count,
        })
    return {"items": results}

# ------------------------------
# Debug utilities: list tables and force create
# ------------------------------
@app.get("/debug/tables")
def debug_list_tables():
    insp = inspect(engine)
    return {"tables": insp.get_table_names()}

@app.post("/debug/create-tables")
def debug_create_tables():
    database.create_database_tables()
    insp = inspect(engine)
    return {"tables": insp.get_table_names()}

# ------------------------------
# User profile
# ------------------------------
class MeOut(BaseModel):
    id: int
    name: str
    email: str
    department: Optional[str] = None
    role: str
    class Config:
        from_attributes = True

@app.get("/user/me", response_model=MeOut)
def user_me(current_user = Depends(get_current_user)):
    role_val = getattr(current_user.role, "value", str(current_user.role)) if current_user.role is not None else "employee"
    return MeOut(id=current_user.id, name=current_user.name, email=current_user.email, department=current_user.department, role=role_val)

# ------------------------------
# Reactions
# ------------------------------
class ReactionToggle(BaseModel):
    shoutout_id: int
    type: str  # like | clap | star

@app.post("/reaction/toggle")
def toggle_reaction(payload: ReactionToggle, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Validate type
    valid = {"like": models.ReactionType.like, "clap": models.ReactionType.clap, "star": models.ReactionType.star}
    if payload.type not in valid:
        raise HTTPException(status_code=400, detail="Invalid reaction type")

    existing = db.query(models.Reaction).filter(
        models.Reaction.shoutout_id == payload.shoutout_id,
        models.Reaction.user_id == current_user.id,
        models.Reaction.type == valid[payload.type]
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        action = "removed"
    else:
        rec = models.Reaction(shoutout_id=payload.shoutout_id, user_id=current_user.id, type=valid[payload.type])
        db.add(rec)
        db.commit()
        action = "added"
    # counts
    counts = {
        "like": db.query(models.Reaction).filter(models.Reaction.shoutout_id == payload.shoutout_id, models.Reaction.type == models.ReactionType.like).count(),
        "clap": db.query(models.Reaction).filter(models.Reaction.shoutout_id == payload.shoutout_id, models.Reaction.type == models.ReactionType.clap).count(),
        "star": db.query(models.Reaction).filter(models.Reaction.shoutout_id == payload.shoutout_id, models.Reaction.type == models.ReactionType.star).count(),
    }
    return {"status": action, "counts": counts}

@app.get("/reaction/counts/{shoutout_id}")
def reaction_counts(shoutout_id: int, db: Session = Depends(get_db)):
    return {
        "like": db.query(models.Reaction).filter(models.Reaction.shoutout_id == shoutout_id, models.Reaction.type == models.ReactionType.like).count(),
        "clap": db.query(models.Reaction).filter(models.Reaction.shoutout_id == shoutout_id, models.Reaction.type == models.ReactionType.clap).count(),
        "star": db.query(models.Reaction).filter(models.Reaction.shoutout_id == shoutout_id, models.Reaction.type == models.ReactionType.star).count(),
    }

# ------------------------------
# Comments and reporting
# ------------------------------
class CommentAdd(BaseModel):
    shoutout_id: int
    content: str

class ReportShoutout(BaseModel):
    shoutout_id: int
    reason: str

class ReportComment(BaseModel):
    comment_id: int
    reason: str

@app.post("/comment/add")
def add_comment(payload: CommentAdd, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    c = models.Comment(shoutout_id=payload.shoutout_id, user_id=current_user.id, content=payload.content)
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"message": "Comment added", "id": c.id}

@app.get("/comment/fetch/{shoutout_id}")
def fetch_comments(shoutout_id: int, db: Session = Depends(get_db)):
    comments = db.query(models.Comment).filter(models.Comment.shoutout_id == shoutout_id).order_by(models.Comment.id.asc()).all()
    users = {u.id: u for u in db.query(models.User).all()}
    items = []
    for c in comments:
        u = users.get(c.user_id)
        items.append({
            "id": c.id,
            "content": c.content,
            "created_at": getattr(c, "created_at", None).isoformat() if getattr(c, "created_at", None) else None,
            "user": {"id": u.id, "name": u.name, "email": u.email} if u else None
        })
    return {"items": items}

@app.post("/shoutout/report")
def report_shoutout(payload: ReportShoutout, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    r = models.Report(shoutout_id=payload.shoutout_id, reported_by=current_user.id, reason=payload.reason)
    db.add(r)
    db.commit()
    return {"message": "Report submitted"}

@app.post("/comment/report")
def report_comment(payload: ReportComment, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    r = models.Report(shoutout_id=None, comment_id=payload.comment_id, reported_by=current_user.id, reason=payload.reason)
    db.add(r)
    db.commit()
    return {"message": "Report submitted"}

# ------------------------------
# Admin endpoints
# ------------------------------
def ensure_admin(user) -> None:
    role_val = getattr(user.role, "value", str(user.role)) if user.role is not None else "employee"
    if role_val != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

@app.get("/admin/users")
def admin_users(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_admin(current_user)
    return [
        {"id": u.id, "name": u.name, "email": u.email, "department": u.department, "role": getattr(u.role, "value", str(u.role))}
        for u in db.query(models.User).all()
    ]

@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_admin(current_user)
    u = db.query(models.User).get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(u)
    db.commit()
    return {"message": "User deleted"}

@app.get("/admin/shoutouts")
def admin_shoutouts(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_admin(current_user)
    return [
        {"id": s.id, "sender_id": s.sender_id, "message": s.message, "department": s.department}
        for s in db.query(models.Shoutout).order_by(models.Shoutout.id.desc()).limit(200).all()
    ]

@app.delete("/admin/shoutouts/{sid}")
def admin_delete_shoutout(sid: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
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
    db.delete(s)
    db.commit()
    return {"message": "Shoutout deleted"}

@app.get("/admin/reports")
def admin_reports(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_admin(current_user)
    rows = db.query(models.Report).order_by(models.Report.id.desc()).all()
    return [
        {"id": r.id, "shoutout_id": r.shoutout_id, "comment_id": r.comment_id, "reported_by": r.reported_by, "reason": r.reason}
        for r in rows
    ]

@app.post("/admin/reports/{rid}/dismiss")
def admin_dismiss_report(rid: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    ensure_admin(current_user)
    r = db.query(models.Report).get(rid)
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    # If this report is about a comment, delete the comment as part of resolving the report
    if r.comment_id:
        c = db.query(models.Comment).get(r.comment_id)
        if c:
            db.delete(c)
    db.delete(r)
    db.commit()
    return {"message": "Report resolved"}

@app.get("/admin/analytics")
def admin_analytics(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
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