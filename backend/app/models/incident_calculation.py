from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class IncidentCalculationRule(Base):
    """Versioned legal or agreement rule used by the incident payroll engine."""

    __tablename__ = "incident_calculation_rules"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    incident_type = Column(String, nullable=False, index=True)
    process_type = Column(String, nullable=True, index=True)
    agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=True, index=True)
    valid_from = Column(Date, nullable=False, index=True)
    valid_to = Column(Date, nullable=True, index=True)
    priority = Column(Integer, default=100, nullable=False)
    configuration = Column(JSON, default=dict, nullable=False)
    legal_reference = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    agreement = relationship("CollectiveAgreement")
    segments = relationship("PayrollSegment", back_populates="rule")


class PayrollSegment(Base):
    """Auditable intramonth segment produced before PayrollItem synchronization."""

    __tablename__ = "payroll_segments"

    id = Column(Integer, primary_key=True, index=True)
    payroll_id = Column(Integer, ForeignKey("payrolls.id", ondelete="CASCADE"), nullable=False, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    rule_id = Column(Integer, ForeignKey("incident_calculation_rules.id", ondelete="SET NULL"), nullable=True)
    segment_key = Column(String, unique=True, nullable=False, index=True)
    segment_type = Column(String, nullable=False, index=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    calendar_days = Column(Integer, nullable=False)
    payroll_days = Column(Numeric(10, 4), nullable=False)
    process_day_from = Column(Integer, nullable=True)
    process_day_to = Column(Integer, nullable=True)
    salary_percentage = Column(Numeric(7, 4), default=0, nullable=False)
    benefit_percentage = Column(Numeric(7, 4), default=0, nullable=False)
    complement_percentage = Column(Numeric(7, 4), default=0, nullable=False)
    contribution_treatment = Column(String, default="maintain", nullable=False)
    daily_salary_base = Column(Numeric(12, 4), default=0, nullable=False)
    daily_regulatory_base = Column(Numeric(12, 4), default=0, nullable=False)
    salary_amount = Column(Numeric(12, 2), default=0, nullable=False)
    benefit_amount = Column(Numeric(12, 2), default=0, nullable=False)
    complement_amount = Column(Numeric(12, 2), default=0, nullable=False)
    deduction_amount = Column(Numeric(12, 2), default=0, nullable=False)
    calculation_trace = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    payroll = relationship("Payroll", back_populates="segments")
    incident = relationship("Incident")
    rule = relationship("IncidentCalculationRule", back_populates="segments")
    payroll_items = relationship("PayrollItem", back_populates="segment")
