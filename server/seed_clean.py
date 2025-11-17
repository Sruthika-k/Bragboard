import os
import sys
import random
from datetime import datetime, timedelta
from typing import List

# Allow running both:
# - as a module: python -m server.seed_clean
# - as a script: python server/seed_clean.py
if __package__ in (None, ""):
    sys.path.append(os.path.dirname(os.path.dirname(__file__)))
    from server.database import Base, engine, SessionLocal, create_database_tables
    from server.models import (
        Department,
        User,
        RoleEnum,
        Shoutout,
        ShoutoutRecipient,
        Comment,
        Reaction,
        ReactionType,
        Report,
        AdminLog,
    )
    from server.auth import hash_password
else:
    from .database import Base, engine, SessionLocal, create_database_tables
    from .models import (
        Department,
        User,
        RoleEnum,
        Shoutout,
        ShoutoutRecipient,
        Comment,
        Reaction,
        ReactionType,
        Report,
        AdminLog,
    )
    from .auth import hash_password


def wipe_and_recreate_tables():
    print("🧹 Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("🧱 Recreating tables from models...")
    Base.metadata.create_all(bind=engine)


def pick_time_on(date_base: datetime) -> datetime:
    # Prefer morning/afternoon hours
    hour_choices = [9, 10, 11, 12, 14, 15, 16, 17]
    h = random.choice(hour_choices)
    m = random.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    s = random.choice([0, 12, 24, 36, 48])
    return date_base.replace(hour=h, minute=m, second=s, microsecond=0)


def seed_data():
    random.seed(42)
    db = SessionLocal()
    try:
        print("🌱 Starting clean rebuild and seed...")
        wipe_and_recreate_tables()

        # Departments
        dept_names = [
            "Engineering",
            "Human Resources",
            "Marketing",
            "Design",
            "Finance",
            "Operations",
        ]
        dept_map = {}
        for name in dept_names:
            d = Department(name=name)
            db.add(d)
            dept_map[name] = d
        db.commit()

        # Users
        names: List[str] = [
            "Sruthi",
            "Shreya",
            "Rahul",
            "Rohan",
            "Kiran",
            "Ram",
            "Sathya",
            "Aarav",
            "Diya",
            "Neha",
            "Ravi",
            "Priya",
        ]

        designations_by_dept = {
            "Engineering": ["Software Engineer", "Senior Engineer", "QA Engineer"],
            "Human Resources": ["HR Manager", "HR Executive"],
            "Marketing": ["Marketing Executive", "Content Specialist"],
            "Design": ["UI/UX Designer", "Graphic Designer"],
            "Finance": ["Accountant", "Financial Analyst"],
            "Operations": ["Operations Executive", "Operations Manager"],
        }

        # Round-robin assign departments
        users: List[User] = []
        for idx, name in enumerate(names):
            dept = dept_names[idx % len(dept_names)]
            desig = random.choice(designations_by_dept[dept])
            email = f"{name.lower()}@gmail.com"
            u = User(
                name=name,
                email=email,
                password=hash_password("abc123"),
                department=dept,
                designation=desig,
                role=RoleEnum.employee,
                profile_pic=f"https://i.pravatar.cc/150?u={email}",
            )
            db.add(u)
            users.append(u)
        db.commit()

        # Make Sruthi the admin if present; otherwise pick one
        admin_user = db.query(User).filter(User.name == "Sruthi").first()
        if not admin_user:
            admin_user = random.choice(db.query(User).all())
        admin_user.role = RoleEnum.admin
        db.add(admin_user)
        db.commit()

        users = db.query(User).all()
        users_by_name = {u.name: u for u in users}

        # Shoutouts
        sample_messages = [
            "Great job on the project delivery!",
            "Thanks for helping with the onboarding process.",
            "Kudos to the design team for their creativity!",
            "Appreciate the extra effort from Rahul on client support.",
            "Well handled during the release, team!",
            "Fantastic presentation in the client meeting.",
            "Thanks for the quick turnaround on the bug fix.",
            "Great collaboration across teams this week!",
            "Solid work on the data report.",
            "Creative solution to the UI problem!",
            "Thanks for covering the shift yesterday.",
            "Brilliant work driving the marketing campaign!",
            "Excellent stakeholder communication.",
            "Top-notch documentation, very clear!",
            "Kudos for mentoring the new joiners!",
        ]

        # Dates: 11, 12, 13 Nov 2025
        date_pool = [
            datetime(2025, 11, 11, 9, 0, 0),
            datetime(2025, 11, 12, 9, 0, 0),
            datetime(2025, 11, 13, 9, 0, 0),
        ]

        shoutouts: List[Shoutout] = []
        total_shoutouts = random.randint(10, 15)
        for i in range(total_shoutouts):
            sender = random.choice(users)
            msg = random.choice(sample_messages)
            when = pick_time_on(random.choice(date_pool))
            s = Shoutout(
                sender_id=sender.id,
                message=msg,
                department=sender.department,
                image_url=None,
                created_at=when,
            )
            db.add(s)
            db.commit()  # to get ID
            shoutouts.append(s)

            # recipients: 1-3 distinct, not including sender
            possible_receivers = [u for u in users if u.id != sender.id]
            k = random.randint(1, min(3, len(possible_receivers)))
            recs = random.sample(possible_receivers, k=k)
            for rec in recs:
                db.add(ShoutoutRecipient(shoutout_id=s.id, recipient_id=rec.id))
            db.commit()

        # Comments: 1-3 per shoutout
        comment_texts = [
            "Congratulations!",
            "Great work!",
            "Well deserved!",
            "Thank you!",
        ]
        total_comments = 0
        for s in shoutouts:
            for _ in range(random.randint(1, 3)):
                commenter = random.choice(users)
                c = Comment(
                    shoutout_id=s.id,
                    user_id=commenter.id,
                    content=random.choice(comment_texts),
                )
                db.add(c)
                total_comments += 1
        db.commit()

        # Reactions: random per shoutout
        reaction_types = [ReactionType.like, ReactionType.clap, ReactionType.star]
        total_reactions = 0
        for s in shoutouts:
            # 3-6 users reacting
            reactors = random.sample(users, k=min(random.randint(3, 6), len(users)))
            for u in reactors:
                r = Reaction(
                    shoutout_id=s.id,
                    user_id=u.id,
                    type=random.choice(reaction_types),
                )
                db.add(r)
                total_reactions += 1
        db.commit()

        # Reports: leave empty intentionally
        # Admin logs: leave empty (no admin actions yet)

        # Summary
        user_count = db.query(User).count()
        shout_count = db.query(Shoutout).count()
        comment_count = db.query(Comment).count()

        print("----- Seed Summary -----")
        print(f"Users added: {user_count}")
        print(f"Shoutouts added: {shout_count}")
        print(f"Comments added: {comment_count}")
        print("🌱 Clean and realistic seed data created successfully!")

    except Exception as e:
        db.rollback()
        print(f"❌ Seeding error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    # Ensure DB connectivity and then seed
    create_database_tables()
    seed_data()
