from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class Correction(Base):
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("case_assignments.id"), nullable=True)
    case_study_id = Column(Integer, ForeignKey("case_studies.id"), nullable=True)
    student_name = Column(String, nullable=True)
    student_group = Column(String, nullable=True)
    status = Column(String, default="pending_review", nullable=False)
    grade = Column(Float, nullable=True)
    teacher_feedback = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assignment = relationship("CaseAssignment")
    case_study = relationship("CaseStudy")

    @property
    def case_title(self):
        if self.assignment and self.assignment.case_title:
            return self.assignment.case_title
        if self.case_study:
            return self.case_study.title
        return None

    @property
    def assignee_name(self):
        if self.assignment:
            return self.assignment.assignee_name
        return self.student_name

    @property
    def assignee_type(self):
        if self.assignment:
            return self.assignment.assignee_type
        return "legacy"

    @property
    def assignment_status(self):
        if self.assignment:
            return self.assignment.status
        return None
