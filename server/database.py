# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# --- START OF FIX ---
if not DATABASE_URL:
    # Raise a clear error if the environment variable is missing
    raise EnvironmentError(
        "DATABASE_URL environment variable is not set. "
        "Please create a .env file and set DATABASE_URL to your PostgreSQL connection string."
    )
# --- END OF FIX ---

# Create the PostgreSQL engine
engine = create_engine(DATABASE_URL)

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
