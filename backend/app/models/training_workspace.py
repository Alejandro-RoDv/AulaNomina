from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base


class TrainingWorkspace(Base):
    __tablename__ = "training_workspaces"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    workspace_code = Column(String, nullable=False, unique=True, index=True)
    status = Column(String, default="active", nullable=False, index=True)
    seed_version = Column(String, default="2026.1", nullable=False)
    reset_generation = Column(Integer, default=0, nullable=False)
    last_reset_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    student = relationship("Student", back_populates="workspace")
    assignments = relationship("CaseAssignment", back_populates="workspace")
