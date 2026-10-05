from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class CaseTaskAttempt(Base):
    __tablename__ = "case_task_attempts"
    __table_args__ = (
        UniqueConstraint(
            "assignment_id",
            "task_id",
            "attempt_number",
            name="uq_case_task_attempt_assignment_task_number",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("case_assignments.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("case_tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    attempt_number = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    score = Column(Integer, nullable=True)
    hints_used = Column(Integer, default=0, nullable=False)
    validation_result = Column(JSON, default=dict, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    assignment = relationship("CaseAssignment")
    task = relationship("CaseTask")
