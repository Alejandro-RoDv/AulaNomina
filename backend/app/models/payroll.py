from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db import Base


class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    base_salary = Column(Numeric(10, 2), default=0, nullable=False)
    salary_supplements = Column(Numeric(10, 2), default=0, nullable=False)
    extra_pay_proration = Column(Numeric(10, 2), default=0, nullable=False)
    gross_salary = Column(Numeric(10, 2), default=0, nullable=False)
    employee_social_security = Column(Numeric(10, 2), default=0, nullable=False)
    irpf = Column(Numeric(10, 2), default=0, nullable=False)
    total_deductions = Column(Numeric(10, 2), default=0, nullable=False)
    net_salary = Column(Numeric(10, 2), default=0, nullable=False)
    status = Column(String, default="draft", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="payrolls")
    contract = relationship("Contract", back_populates="payrolls")
    company = relationship("Company", back_populates="payrolls")

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
    def period_label(self):
        return f"{self.period_month:02d}/{self.period_year}"
