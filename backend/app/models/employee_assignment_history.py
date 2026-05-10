from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db import Base


class EmployeeAssignmentHistory(Base):
    __tablename__ = "employee_assignment_history"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)
    start_date = Column(Date, nullable=False, default=date.today)
    end_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="assignment_history")
    company = relationship("Company")
    work_center = relationship("WorkCenter")

    @property
    def employee_name(self):
        if not self.employee:
            return None
        return f"{self.employee.first_name} {self.employee.last_name}".strip()

    @property
    def company_name(self):
        if not self.company:
            return None
        return self.company.name

    @property
    def center_name(self):
        if not self.work_center:
            return None
        return self.work_center.name
