# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL not found in .env file")

# Create the PostgreSQL engine (silence SQL echo in production)
engine = create_engine(DATABASE_URL, echo=False, future=True)

# Session and Base
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency for DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_database_tables():
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables checked/created successfully.")
    except Exception as e:
        print(f"❌ Error while creating database tables: {e}")
