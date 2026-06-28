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
    detail = relationship(
        "IncidentDetail",
        back_populates="incident",
        uselist=False,
        cascade="all, delete-orphan",
    )
    audit_entries = relationship(
        "IncidentAudit",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentAudit.created_at.desc()",
    )
    confirmations = relationship(
        "IncidentConfirmation",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentConfirmation.confirmation_date.desc()",
    )

    @property
    def employee_name(self):
        if not self.employee:
            return None
        return f"{self.employee.first_name} {self.employee.last_name}".strip()

    @property
    def company_name(self):
        return self.company.name if self.company else None

    @property
    def contract_type(self):
        return self.contract.contract_type if self.contract else None

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

    @property
    def unit_type(self):
        return self.detail.unit_type if self.detail else None

    @property
    def hours(self):
        return self.detail.hours if self.detail else None

    @property
    def days(self):
        return self.detail.days if self.detail else None

    @property
    def paid(self):
        return self.detail.paid if self.detail else None

    @property
    def payroll_effect(self):
        return self.detail.payroll_effect if self.detail else "pending"

    @property
    def processed_payroll_id(self):
        return self.detail.processed_payroll_id if self.detail else None

    @property
    def generated_amount(self):
        return self.detail.generated_amount if self.detail else None

    @property
    def processed_at(self):
        return self.detail.processed_at if self.detail else None

    @property
    def is_cancelled(self):
        return self.detail.is_cancelled if self.detail else False

    @property
    def cancelled_at(self):
        return self.detail.cancelled_at if self.detail else None

    @property
    def cancellation_reason(self):
        return self.detail.cancellation_reason if self.detail else None

    @property
    def requires_recalculation(self):
        return self.detail.requires_recalculation if self.detail else False

    @property
    def requires_regularization(self):
        return self.detail.requires_regularization if self.detail else False

    @property
    def overlap_override(self):
        return self.detail.overlap_override if self.detail else False

    @property
    def overlap_reason(self):
        return self.detail.overlap_reason if self.detail else None

    @property
    def origin(self):
        return self.detail.origin if self.detail else "manual"

    @property
    def details(self):
        return self.detail.details if self.detail else {}

    @property
    def created_by(self):
        return self.detail.created_by if self.detail else None

    @property
    def updated_by(self):
        return self.detail.updated_by if self.detail else None

    @property
    def updated_at(self):
        return self.detail.updated_at if self.detail else self.created_at

    @property
    def version(self):
        return self.detail.version if self.detail else 1
