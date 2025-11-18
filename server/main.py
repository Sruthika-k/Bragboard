from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware


# REMOVED: from sqlalchemy.ext.asyncio import AsyncSession - We are using synchronous Session from database.py
import os
from fastapi.staticfiles import StaticFiles
from . import database, models
from .routers import (
    auth as auth_router,
    admin as admin_router,
    users as users_router,
    shoutouts as shoutouts_router,
    comments as comments_router,
    reactions as reactions_router,
    reports as reports_router,
    notifications as notif_router,
    feed as feed_router,
)


def startup_event_handler():
    database.create_database_tables()


app = FastAPI(title="BragBoard API") 

# Serve uploaded images (after app is created)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
except Exception:
    pass

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Configure CORS (Cross-Origin Resource Sharing)
origins = ["*"]

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


app.include_router(auth_router.router)
app.include_router(admin_router.router)
app.include_router(users_router.router)
app.include_router(shoutouts_router.router)
app.include_router(comments_router.router)
app.include_router(reactions_router.router)
app.include_router(reports_router.router)
app.include_router(notif_router.router)
app.include_router(feed_router.router)
