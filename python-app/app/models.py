from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from .database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    security_question = Column(String(255), nullable=False)
    security_answer_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    notes = relationship("Note", back_populates="user", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="user", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="user", cascade="all, delete-orphan")
    custom_fields = relationship("CustomField", back_populates="user", cascade="all, delete-orphan")
    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    date = Column(String(10), nullable=False, index=True)  # Format: YYYY-MM-DD
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="notes")
    lines = relationship("NoteLine", back_populates="note", cascade="all, delete-orphan", order_by="NoteLine.order")


class NoteLine(Base):
    __tablename__ = "note_lines"

    id = Column(String, primary_key=True, default=generate_uuid)
    note_id = Column(String, ForeignKey("notes.id"), nullable=False)
    content = Column(Text, default="")
    type = Column(String(20), default="paragraph")  # paragraph, title, subtitle, quote, bullet
    collapsed = Column(Boolean, default=False)
    indent = Column(Integer, default=0)
    order = Column(Integer, default=0)

    # Relationships
    note = relationship("Note", back_populates="lines")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="open")  # open, done
    completed = Column(Boolean, default=False)
    tags_json = Column(JSON, default=list)  # List of tag IDs
    custom_fields_json = Column(JSON, default=dict)  # Dict of field_key: value
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="activities")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String(50), nullable=False)
    color = Column(String(20), default="#f59e0b")  # Amber color default

    # Relationships
    user = relationship("User", back_populates="tags")


class CustomField(Base):
    __tablename__ = "custom_fields"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    key = Column(String(100), nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(30), nullable=False)  # text, long_text, date, datetime, number, currency, boolean, single_select, multi_select, tags
    options_json = Column(JSON, default=list)  # For select types
    enabled = Column(Boolean, default=True)
    required = Column(Boolean, default=False)
    default_value = Column(Text, nullable=True)
    display = Column(String(20), default="both")  # list, detail, both
    order = Column(Integer, default=0)

    # Relationships
    user = relationship("User", back_populates="custom_fields")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True)
    allow_reopen_completed = Column(Boolean, default=True)
    default_sort = Column(String(30), default="manual")  # manual, dueDate_asc, dueDate_desc, priority_asc, priority_desc, createdAt_desc
    activity_creation_mode = Column(String(20), default="simple")  # simple, detailed

    # Relationships
    user = relationship("User", back_populates="settings")
