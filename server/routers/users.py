from typing import List, Optional
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import database, models, auth

router = APIRouter()


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    department: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class MeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    profile_pic: Optional[str] = None
    password: Optional[str] = None


class MeOut(BaseModel):
    id: int
    name: str
    email: str
    department: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(database.get_db)):
    users = db.query(models.User).all()
    out = []
    for u in users:
        role_val = getattr(u.role, "value", str(u.role)) if u.role is not None else "employee"
        out.append(UserOut(id=u.id, name=u.name, email=u.email, department=u.department, role=role_val))
    return out


@router.get("/user/me", response_model=MeOut)
def user_me(current_user=Depends(auth.get_current_user)):
    role_val = getattr(current_user.role, "value", str(current_user.role)) if current_user.role is not None else "employee"
    return MeOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        department=current_user.department,
        role=role_val,
    )


@router.put("/user/me")
def update_me(
    payload: MeUpdate,
    db: Session = Depends(database.get_db),
    current_user=Depends(auth.get_current_user),
):
    changed = False
    name_changed = False
    password_changed = False
    old_name = current_user.name

    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Name cannot be blank")
        if new_name != current_user.name:
            current_user.name = new_name
            changed = True
            name_changed = True

    if payload.department is not None:
        current_user.department = payload.department
        changed = True

    if payload.designation is not None:
        current_user.designation = payload.designation
        changed = True

    if payload.profile_pic is not None:
        current_user.profile_pic = payload.profile_pic
        changed = True

    if payload.password is not None and payload.password.strip():
        try:
            pwd = payload.password.strip()
            pwd_pattern = re.compile(r"^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$")
            if not pwd_pattern.match(pwd):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Password must be at least 8 characters and include an uppercase "
                        "letter, a number, and a special character"
                    ),
                )
            current_user.password = auth.hash_password(pwd)
            changed = True
            password_changed = True
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid password")

    if not changed:
        return {"message": "No changes"}

    db.add(current_user)

    try:
        if name_changed:
            db.add(
                models.AdminLog(
                    admin_id=current_user.id,
                    action=f"Username updated: {new_name}",
                    target_id=current_user.id,
                    target_type="user",
                )
            )
        if password_changed:
            db.add(
                models.AdminLog(
                    admin_id=current_user.id,
                    action="password_change",
                    target_id=current_user.id,
                    target_type="user",
                )
            )
    except Exception:
        pass

    db.commit()
    return {"message": "Profile updated"}
