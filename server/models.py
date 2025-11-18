# backend/models.py
from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Enum
from sqlalchemy.orm import relationship
import enum
from sqlalchemy import Column, Integer, String, DateTime, func

# Use package-relative import for the database module
from . import database 

Base = database.Base

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)

class RoleEnum(enum.Enum):
    employee = "employee"
    admin = "admin"

class ReactionType(enum.Enum):
    like = "like"
    clap = "clap"
    star = "star"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    department = Column(String(100))
    designation = Column(String(100))
    profile_pic = Column(String(255))
    role = Column(Enum(RoleEnum), default=RoleEnum.employee)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

class Shoutout(Base):
    __tablename__ = "shoutouts"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    department = Column(String(100))
    image_url = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ShoutoutRecipient(Base):
    __tablename__ = "shoutout_recipients"
    id = Column(Integer, primary_key=True)
    shoutout_id = Column(Integer, ForeignKey("shoutouts.id"))
    recipient_id = Column(Integer, ForeignKey("users.id"))

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True)
    shoutout_id = Column(Integer, ForeignKey("shoutouts.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Reaction(Base):
    __tablename__ = "reactions"
    id = Column(Integer, primary_key=True)
    shoutout_id = Column(Integer, ForeignKey("shoutouts.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    type = Column(Enum(ReactionType))

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    shoutout_id = Column(Integer, ForeignKey("shoutouts.id"))
    comment_id = Column(Integer, ForeignKey("comments.id"), nullable=True)
    reported_by = Column(Integer, ForeignKey("users.id"))
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AdminLog(Base):
    __tablename__ = "admin_logs"
    id = Column(Integer, primary_key=True)
    admin_id = Column(Integer, ForeignKey("users.id"))
    action = Column(Text)
    target_id = Column(Integer)
    target_type = Column(String(50))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
