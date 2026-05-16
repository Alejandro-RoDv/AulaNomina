from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class StudentGroup(Base):
    __tablename__ = "student_groups"

    id = Column(Integer, primary_key=True, index=True)
    group_code = Column(String, nullable=True, unique=True, index=True)
    name = Column(String, nullable=False)
    academic_year = Column(String, nullable=True)
    education_center = Column(String, nullable=True)
    teacher_name = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    students = relationship("Student", back_populates="group")

    @property
    def student_count(self):
        return len([student for student in self.students if student.is_active])
