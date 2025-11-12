import random
from faker import Faker
from sqlalchemy.orm import Session
import sys, os
import traceback

# Allow running both:
# - as a module: python -m server.seed_data
# - as a script: python server/seed_data.py
if __package__ in (None, ""):
    # Add project root to sys.path so 'server' is importable
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from server.models import (
        Department, User, RoleEnum, Shoutout, ShoutoutRecipient,
        Comment, Reaction, ReactionType, Report
    )
    from server.database import SessionLocal, create_database_tables
    from server.auth import hash_password
else:
    from .models import (
        Department, User, RoleEnum, Shoutout, ShoutoutRecipient,
        Comment, Reaction, ReactionType, Report
    )
    from .database import SessionLocal, create_database_tables
    from .auth import hash_password

fake = Faker()

def seed_data():
    db: Session = SessionLocal()
    try:
        print("🌱 Seeding database with demo data...")

        # ----------------- Departments -----------------
        departments = [
            "Engineering",
            "Human Resources",
            "Marketing",
            "Design",
            "Finance",
            "Operations"
        ]
        dept_objs = []
        for dept in departments:
            existing = db.query(Department).filter(Department.name == dept).first()
            if not existing:
                new_dept = Department(name=dept)
                db.add(new_dept)
                dept_objs.append(new_dept)
        db.commit()

        # ----------------- Users -----------------
        users = []
        for dept in departments:
            for i in range(5):  # 5 users per department
                name = fake.name()
                email = f"{dept.lower().replace(' ', '')}{i}@gmail.com"
                existing_user = db.query(User).filter(User.email == email).first()
                if not existing_user:
                    user = User(
                        name=name,
                        email=email,
                        password=hash_password("abc123"),
                        department=dept,
                        designation=random.choice(["Engineer", "Manager", "Intern", "Lead"]),
                        role=RoleEnum.employee,
                        profile_pic=f"https://i.pravatar.cc/150?u={email}"
                    )
                    db.add(user)
                    users.append(user)

        # Add one admin
        admin_email = "admin@bragboard.com"
        if not db.query(User).filter(User.email == admin_email).first():
            admin = User(
                name="System Admin",
                email=admin_email,
                password=hash_password("abc123"),
                department="Human Resources",
                designation="Administrator",
                role=RoleEnum.admin,
                profile_pic=f"https://i.pravatar.cc/150?u={admin_email}"
            )
            db.add(admin)
            users.append(admin)

        db.commit()
        users = db.query(User).all()

        # ----------------- Shoutouts -----------------
        for _ in range(15):
            sender = random.choice(users)
            message = fake.sentence(nb_words=10)
            department = sender.department
            shoutout = Shoutout(
                sender_id=sender.id,
                message=message,
                department=department,
                image_url=None
            )
            db.add(shoutout)
            db.commit()

            # Add recipients
            all_receivers = random.sample(users, k=min(2, len(users)))
            for rec in all_receivers:
                recipient = ShoutoutRecipient(
                    shoutout_id=shoutout.id,
                    recipient_id=rec.id
                )
                db.add(recipient)
            db.commit()

        shoutouts = db.query(Shoutout).all()

        # ----------------- Comments -----------------
        for shoutout in shoutouts:
            for _ in range(random.randint(1, 3)):
                commenter = random.choice(users)
                comment = Comment(
                    shoutout_id=shoutout.id,
                    user_id=commenter.id,
                    content=fake.sentence(nb_words=8)
                )
                db.add(comment)
        db.commit()

        # ----------------- Reactions -----------------
        for shoutout in shoutouts:
            for user in random.sample(users, k=random.randint(3, 6)):
                reaction = Reaction(
                    shoutout_id=shoutout.id,
                    user_id=user.id,
                    type=random.choice(list(ReactionType))
                )
                db.add(reaction)
        db.commit()

        # ----------------- Reports (some random) -----------------
        comments = db.query(Comment).all()
        for _ in range(5):
            reporter = random.choice(users)
            report = Report(
                shoutout_id=random.choice(shoutouts).id,
                reported_by=reporter.id,
                reason=fake.sentence(nb_words=6)
            )
            db.add(report)

        for _ in range(3):
            reporter = random.choice(users)
            report = Report(
                comment_id=random.choice(comments).id,
                reported_by=reporter.id,
                reason=fake.sentence(nb_words=6)
            )
            db.add(report)

        db.commit()
        print("✅ Database seeded with departments, users, shoutouts, comments, reactions, and reports!")

    except Exception as e:
        print(f"❌ Seeding error: {e}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    # Ensure tables exist before seeding
    create_database_tables()
    try:
        seed_data()
    except Exception:
        # Non-zero exit to indicate failure in CI/scripts
        sys.exit(1)
