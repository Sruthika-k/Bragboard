from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, APIRouter
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from pydantic import BaseModel
import re
import os
from passlib.context import CryptContext

# Use package-relative imports for uvicorn server.main:app
from server import database, models

# -------------------
# Load environment variables
# -------------------
load_dotenv()
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your_secret_key")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

# -------------------
# Password hashing
# -------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _bcrypt_safe_truncate(password: str) -> str:
    """Ensure password respects bcrypt's 72-byte limit.
    We truncate the UTF-8 bytes to 72 and decode, ignoring partial chars at the cut.
    """
    if password is None:
        return ""
    b = password.encode("utf-8")
    if len(b) <= 72:
        return password
    return b[:72].decode("utf-8", errors="ignore")

def hash_password(password: str) -> str:
    """Hash plain password before saving to DB"""
    safe = _bcrypt_safe_truncate(password)
    return pwd_context.hash(safe)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compare login password with stored hash"""
    safe = _bcrypt_safe_truncate(plain_password)
    return pwd_context.verify(safe, hashed_password)

# -------------------
# JWT token
# -------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")
router = APIRouter()

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token

def verify_token(token: str, credentials_exception):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return user_id

# -------------------
# Get current user
# -------------------
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id_str = verify_token(token, credentials_exception)
    try:
        user_id = int(user_id_str)
    except ValueError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise credentials_exception
    return user

# -------------------
# Pydantic model for registration
# -------------------
class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    department: str = None
    role: str = "employee"

# -------------------
# Pydantic model for JSON login
# -------------------
class LoginRequest(BaseModel):
    email: str
    password: str

# -------------------
# Registration endpoint
# -------------------
@router.post("/register")
def register(user_data: UserRegister, db: Session = Depends(database.get_db)):
    # Normalize email
    norm_email = (user_data.email or "").strip().lower()
    if not norm_email:
        raise HTTPException(status_code=400, detail="Email is required")

    # Validate email provider (Gmail-only)
    email_pattern = re.compile(r"^[^@\s]+@gmail\.com$")
    if not email_pattern.match(norm_email):
        raise HTTPException(status_code=400, detail="Only Gmail email addresses are allowed")

    # Validate name and department
    name = (user_data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    dept = (user_data.department or "").strip() if user_data.department is not None else ""
    if not dept:
        raise HTTPException(status_code=400, detail="Department is required")

    # 1. Check for existing user (normalized)
    existing_user = db.query(models.User).filter(models.User.email == norm_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Validate password strength then hash
    pwd = user_data.password or ""
    # At least 8 characters, one uppercase letter, one number, and one special character
    pwd_pattern = re.compile(r"^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$")
    if not pwd_pattern.match(pwd):
        raise HTTPException(
            status_code=400,
            detail=(
                "Password must be at least 8 characters and include an uppercase "
                "letter, a number, and a special character"
            ),
        )
    hashed_password = hash_password(pwd)

    # 3. Create new user object (store normalized email)
    user = models.User(
        name=name,
        email=norm_email,
        password=hashed_password,
        department=dept,
        role=user_data.role,
    )

    # 4. Save to database
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        print(f"Database save error during registration: {e}")
        # Return actual error detail to distinguish DB issues from duplicates
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    # 5. Log admin notification for new user registration
    try:
        log = models.AdminLog(
            admin_id=user.id,  # actor is the newly registered user
            action=f"New user registered - {user.name} joined.",
            target_id=user.id,
            target_type="user",
        )
        db.add(log)
        db.commit()
    except Exception:
        # Do not block registration if logging fails
        db.rollback()

    return {"message": "User created successfully", "user_id": user.id}

# -------------------
# Login endpoint (JSON)
# -------------------
@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(database.get_db)):
    # Normalize email for lookup
    norm_email = (request.email or "").strip().lower()
    user = db.query(models.User).filter(models.User.email == norm_email).first()
    if not user or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
