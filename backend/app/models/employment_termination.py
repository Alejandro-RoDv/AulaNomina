from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class EmploymentTermination(Base):
    """Expediente de extinción y liquidación final asociado a un contrato."""

    __tablename__ = "employment_terminations"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True, index=True)

    reason_code = Column(String(40), nullable=False, index=True)
    ss_situation_code = Column(String(8), nullable=False)
    effective_date = Column(Date, nullable=False, index=True)
    communication_date = Column(Date, nullable=True)
    document_reference = Column(String(255), nullable=True)
    status = Column(String(30), default="registered", nullable=False, index=True)

    annual_salary_reference = Column(Numeric(12, 2), default=0, nullable=False)
    monthly_salary_reference = Column(Numeric(12, 2), default=0, nullable=False)
    indemnity_daily_salary = Column(Numeric(12, 4), default=0, nullable=False)
    service_months = Column(Integer, default=0, nullable=False)
    indemnity_days_per_year = Column(Numeric(8, 2), default=0, nullable=False)
    indemnity_days = Column(Numeric(12, 4), default=0, nullable=False)
    indemnity_amount = Column(Numeric(12, 2), default=0, nullable=False)

    pending_salary_days = Column(Numeric(8, 2), default=0, nullable=False)
    pending_salary_amount = Column(Numeric(12, 2), default=0, nullable=False)
    unused_vacation_days = Column(Numeric(8, 2), default=0, nullable=False)
    vacation_amount = Column(Numeric(12, 2), default=0, nullable=False)
    extra_pay_amount = Column(Numeric(12, 2), default=0, nullable=False)
    other_amount = Column(Numeric(12, 2), default=0, nullable=False)
    total_settlement = Column(Numeric(12, 2), default=0, nullable=False)

    calculation_trace = Column(JSON, default=dict, nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String(120), default="usuario-demo", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    contract = relationship("Contract")
    employee = relationship("Employee")
    company = relationship("Company")
    work_center = relationship("WorkCenter")

    @property
    def employee_name(self):
        if not self.employee:
            return None
        return " ".join(
            part.strip()
            for part in (
                self.employee.first_name,
                self.employee.last_name,
                self.employee.second_last_name,
            )
            if part and part.strip()
        )

    @property
    def contract_code(self):
        if not self.contract:
            return None
        return self.contract.contract_code or self.contract.contract_type
