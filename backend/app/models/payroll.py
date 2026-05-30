from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db import Base


SPECIAL_PERIOD_LABELS = {
    13: "Paga extra julio",
    14: "Paga extra diciembre",
    15: "Paga extra complementaria",
}


class Payroll(Base):
    __tablename__ = "payrolls"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)
    period_month = Column(Integer, nullable=False)
    period_year = Column(Integer, nullable=False)
    base_salary = Column(Numeric(10, 2), default=0, nullable=False)
    worked_base_salary = Column(Numeric(10, 2), default=0, nullable=False)
    temporary_disability_benefit = Column(Numeric(10, 2), default=0, nullable=False)
    company_disability_complement = Column(Numeric(10, 2), default=0, nullable=False)
    salary_supplements = Column(Numeric(10, 2), default=0, nullable=False)
    variable_incentives = Column(Numeric(10, 2), default=0, nullable=False)
    extra_pay_proration = Column(Numeric(10, 2), default=0, nullable=False)
    gross_salary = Column(Numeric(10, 2), default=0, nullable=False)
    contribution_days = Column(Integer, default=30, nullable=False)
    worked_days = Column(Integer, default=30, nullable=False)
    incident_days = Column(Integer, default=0, nullable=False)
    it_days = Column(Integer, default=0, nullable=False)
    non_contribution_days = Column(Integer, default=0, nullable=False)
    common_contingencies_base = Column(Numeric(10, 2), default=0, nullable=False)
    professional_contingencies_base = Column(Numeric(10, 2), default=0, nullable=False)
    unemployment_training_fogasa_base = Column(Numeric(10, 2), default=0, nullable=False)
    irpf_base = Column(Numeric(10, 2), default=0, nullable=False)
    daily_common_base = Column(Numeric(10, 2), default=0, nullable=False)
    daily_professional_base = Column(Numeric(10, 2), default=0, nullable=False)
    employee_common_contingencies = Column(Numeric(10, 2), default=0, nullable=False)
    employee_unemployment = Column(Numeric(10, 2), default=0, nullable=False)
    employee_training = Column(Numeric(10, 2), default=0, nullable=False)
    employee_mei = Column(Numeric(10, 2), default=0, nullable=False)
    employee_social_security = Column(Numeric(10, 2), default=0, nullable=False)
    irpf_mode = Column(String, default="auto", nullable=False)
    irpf_percentage = Column(Numeric(5, 2), default=0, nullable=False)
    suggested_irpf_percentage = Column(Numeric(5, 2), default=0, nullable=False)
    irpf = Column(Numeric(10, 2), default=0, nullable=False)
    total_deductions = Column(Numeric(10, 2), default=0, nullable=False)
    net_salary = Column(Numeric(10, 2), default=0, nullable=False)
    company_common_contingencies = Column(Numeric(10, 2), default=0, nullable=False)
    company_unemployment = Column(Numeric(10, 2), default=0, nullable=False)
    company_fogasa = Column(Numeric(10, 2), default=0, nullable=False)
    company_training = Column(Numeric(10, 2), default=0, nullable=False)
    company_at_ep = Column(Numeric(10, 2), default=0, nullable=False)
    company_mei = Column(Numeric(10, 2), default=0, nullable=False)
    company_total_social_security = Column(Numeric(10, 2), default=0, nullable=False)
    company_total_cost = Column(Numeric(10, 2), default=0, nullable=False)
    status = Column(String, default="draft", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="payrolls")
    contract = relationship("Contract", back_populates="payrolls")
    company = relationship("Company", back_populates="payrolls")
    work_center = relationship("WorkCenter", back_populates="payrolls")
    items = relationship("PayrollItem", back_populates="payroll")

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
        if self.period_month in SPECIAL_PERIOD_LABELS:
            return f"{SPECIAL_PERIOD_LABELS[self.period_month]} {self.period_year}"
        return f"{self.period_month:02d}/{self.period_year}"
