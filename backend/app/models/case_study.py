from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class CaseStudy(Base):
    __tablename__ = "case_studies"

    id = Column(Integer, primary_key=True, index=True)
    scenario_code = Column(String, nullable=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(String, default="basic", nullable=False)
    category = Column(String, default="general", nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    status = Column(String, default="draft", nullable=False)
    initial_state = Column(JSON, default=dict, nullable=False)
    validation_rules = Column(JSON, default=list, nullable=False)
    completion_message = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tasks = relationship(
        "CaseTask",
        back_populates="case_study",
        cascade="all, delete-orphan",
        order_by="CaseTask.task_order",
    )
    assignments = relationship(
        "CaseAssignment",
        back_populates="case_study",
        cascade="all, delete-orphan",
    )


class CaseTask(Base):
    __tablename__ = "case_tasks"

    id = Column(Integer, primary_key=True, index=True)
    case_study_id = Column(Integer, ForeignKey("case_studies.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    module = Column(String, nullable=False)
    expected_result = Column(Text, nullable=True)
    expected_action = Column(String, nullable=True)
    trigger_type = Column(String, default="manual", nullable=False)
    trigger_condition = Column(JSON, default=dict, nullable=False)
    validation_rules = Column(JSON, default=list, nullable=False)
    message_template = Column(Text, nullable=True)
    feedback_config = Column(JSON, default=dict, nullable=False)
    task_order = Column(Integer, default=1, nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)
    blocking = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    case_study = relationship("CaseStudy", back_populates="tasks")
    progress_entries = relationship(
        "CaseTaskProgress",
        back_populates="task",
        cascade="all, delete-orphan",
    )
