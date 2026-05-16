from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    student_code = Column(String, nullable=True, unique=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=True, unique=True, index=True)
    group_id = Column(Integer, ForeignKey("student_groups.id"), nullable=True)
    group_name = Column(String, nullable=True)
    education_center = Column(String, nullable=True)
    status = Column(String, default="active", nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("StudentGroup", back_populates="students")

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def group_display_name(self):
        if self.group:
            return self.group.name
        return self.group_name
