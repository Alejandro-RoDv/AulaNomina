from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db import Base


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    contract_type = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    status = Column(String, default="active", nullable=False)
    salary_base = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="contracts")
    company = relationship("Company", back_populates="contracts")

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
