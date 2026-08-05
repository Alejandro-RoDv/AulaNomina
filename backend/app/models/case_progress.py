from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class CaseTaskProgress(Base):
    __tablename__ = "case_task_progress"
    __table_args__ = (
        UniqueConstraint("assignment_id", "task_id", name="uq_case_task_progress_assignment_task"),
    )

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("case_assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("case_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="pending", nullable=False, index=True)
    attempts = Column(Integer, default=0, nullable=False)
    validation_result = Column(JSON, default=dict, nullable=False)
    student_notes = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    assignment = relationship("CaseAssignment", back_populates="progress_entries")
    task = relationship("CaseTask", back_populates="progress_entries")
