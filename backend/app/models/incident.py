from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base
from app.services.incident_payroll_rules import resolve_incident_rule


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    center_id = Column(Integer, ForeignKey("work_centers.id"), nullable=True)
    incident_type = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String, default="open", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="incidents")
    contract = relationship("Contract", back_populates="incidents")
    company = relationship("Company", back_populates="incidents")
    work_center = relationship("WorkCenter", back_populates="incidents")

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
    def contract_type(self):
        if not self.contract:
            return None
        return self.contract.contract_type

    @property
    def payroll_effect_label(self):
        return resolve_incident_rule(self.incident_type).display_label

    @property
    def affects_payroll(self):
        return resolve_incident_rule(self.incident_type).affects_payroll

    @property
    def reduces_worked_days(self):
        return resolve_incident_rule(self.incident_type).reduces_worked_days

    @property
    def reduces_contribution_days(self):
        return resolve_incident_rule(self.incident_type).reduces_contribution_days
