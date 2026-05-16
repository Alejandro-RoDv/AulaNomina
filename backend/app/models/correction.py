from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class Correction(Base):
    __tablename__ = "corrections"

    id = Column(Integer, primary_key=True, index=True)
    case_study_id = Column(Integer, ForeignKey("case_studies.id"), nullable=False)
    student_name = Column(String, nullable=False)
    student_group = Column(String, nullable=True)
    status = Column(String, default="pending_review", nullable=False)
    grade = Column(Float, nullable=True)
    teacher_feedback = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case_study = relationship("CaseStudy")

    @property
    def case_title(self):
        if not self.case_study:
            return None
        return self.case_study.title
