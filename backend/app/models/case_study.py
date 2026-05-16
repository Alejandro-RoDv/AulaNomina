from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class CaseStudy(Base):
    __tablename__ = "case_studies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(String, default="basic", nullable=False)
    status = Column(String, default="draft", nullable=False)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tasks = relationship(
        "CaseTask",
        back_populates="case_study",
        cascade="all, delete-orphan",
        order_by="CaseTask.task_order",
    )


class CaseTask(Base):
    __tablename__ = "case_tasks"

    id = Column(Integer, primary_key=True, index=True)
    case_study_id = Column(Integer, ForeignKey("case_studies.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    module = Column(String, nullable=False)
    expected_result = Column(Text, nullable=True)
    task_order = Column(Integer, default=1, nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    case_study = relationship("CaseStudy", back_populates="tasks")
