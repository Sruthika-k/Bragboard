from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
# REMOVED: from sqlalchemy.ext.asyncio import AsyncSession - We are using synchronous Session from database.py
from database import engine 
import database, models, auth 
import time 


def startup_event_handler():
    create_database_tables()


app = FastAPI(title="BragBoard API") 

# Configure CORS (Cross-Origin Resource Sharing)
origins = [
    "http://localhost",
    "http://localhost:5173", # Your React frontend URL
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000" # Include the server itself
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
    """
    Attempts to connect to the database and create all tables defined
    in models.Base.metadata. Retries multiple times on failure.
    """
    max_retries = 5
    for i in range(max_retries):
        try:
            # This line will create all tables (users, shoutouts, etc.) if they don't exist
            models.Base.metadata.create_all(bind=engine)
            print("✅ Database tables checked/created successfully.")
            return
        except Exception as e:
            print(f"⚠️ Attempt {i+1}/{max_retries}: Failed to connect and create tables. Retrying in 2 seconds...")
            print(f"Error details: {e}")
            time.sleep(2)
            
    # If all retries fail, crash the server and alert the user
    raise RuntimeError("Failed to connect to database and create tables after multiple retries. Check your database connection string and server status.")


# Dependency to get the database session (defined in database.py)
# FIX: Use the dependency function from database.py directly to avoid duplication
get_db = database.get_db


@app.on_event("startup")
def on_startup():
    # Call the table creation function when the application starts
    create_database_tables()


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