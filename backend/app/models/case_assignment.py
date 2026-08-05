from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class CaseAssignment(Base):
    __tablename__ = "case_assignments"

    id = Column(Integer, primary_key=True, index=True)
    case_study_id = Column(Integer, ForeignKey("case_studies.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    group_id = Column(Integer, ForeignKey("student_groups.id"), nullable=True, index=True)
    assigned_by = Column(String, nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    current_task_order = Column(Integer, default=1, nullable=False)
    completion_percentage = Column(Integer, default=0, nullable=False)
    status = Column(String, default="assigned", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case_study = relationship("CaseStudy", back_populates="assignments")
    student = relationship("Student")
    group = relationship("StudentGroup")
    progress_entries = relationship(
        "CaseTaskProgress",
        back_populates="assignment",
        cascade="all, delete-orphan",
        order_by="CaseTaskProgress.id.asc()",
    )
    email_threads = relationship("EmailThread", back_populates="case_assignment")

    @property
    def case_title(self):
        return self.case_study.title if self.case_study else None

    @property
    def student_name(self):
        return self.student.full_name if self.student else None

    @property
    def group_name(self):
        return self.group.name if self.group else None

    @property
    def assignee_name(self):
        if self.student:
            return self.student.full_name
        if self.group:
            return self.group.name
        return "Sin destinatario"

    @property
    def assignee_type(self):
        if self.student_id:
            return "student"
        if self.group_id:
            return "group"
        return "none"
