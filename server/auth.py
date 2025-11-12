from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, APIRouter
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from pydantic import BaseModel
import os
from passlib.context import CryptContext

# Use package-relative imports for uvicorn server.main:app
from . import database, models

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
    # 1. Check for existing user
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 2. Hash password - FIXED: Changed get_password_hash() to the correct hash_password()
    hashed_password = hash_password(user_data.password)
    
    # 3. Create new user object
    user = models.User(
        name=user_data.name,
        email=user_data.email,
        password=hashed_password,
        department=user_data.department,
        role=user_data.role
    )
    
    # 4. Save to database
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        # This catches errors like database connection loss or schema mismatch
        print(f"Database save error during registration: {e}")
        raise HTTPException(status_code=500, detail="An error occurred while saving user data.")
        
    return {"message": "User created successfully", "user_id": user.id}

# -------------------
# Login endpoint (JSON)
# -------------------
@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if not user or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}
