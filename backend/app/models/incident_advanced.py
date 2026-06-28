from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class VacationLedgerEntry(Base):
    __tablename__ = "vacation_ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    entry_type = Column(String, nullable=False, index=True)
    unit = Column(String, default="natural_days", nullable=False)
    amount = Column(Numeric(10, 4), nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    source_incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    source_payroll_id = Column(Integer, ForeignKey("payrolls.id", ondelete="SET NULL"), nullable=True, index=True)
    source_key = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_automatic = Column(Boolean, default=True, nullable=False)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    employee = relationship("Employee")
    contract = relationship("Contract")
    incident = relationship("Incident")
    payroll = relationship("Payroll")


class IncidentRegularization(Base):
    __tablename__ = "incident_regularizations"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    source_payroll_id = Column(Integer, ForeignKey("payrolls.id"), nullable=False, index=True)
    target_payroll_id = Column(Integer, ForeignKey("payrolls.id"), nullable=True, index=True)
    target_period_month = Column(Integer, nullable=False)
    target_period_year = Column(Integer, nullable=False)
    status = Column(String, default="pending", nullable=False, index=True)
    gross_difference = Column(Numeric(12, 2), default=0, nullable=False)
    contribution_difference = Column(Numeric(12, 2), default=0, nullable=False)
    taxable_difference = Column(Numeric(12, 2), default=0, nullable=False)
    source_key = Column(String, unique=True, nullable=False, index=True)
    calculation_trace = Column(JSON, default=dict, nullable=False)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    processed_at = Column(DateTime, nullable=True)

    incident = relationship("Incident")
    source_payroll = relationship("Payroll", foreign_keys=[source_payroll_id])
    target_payroll = relationship("Payroll", foreign_keys=[target_payroll_id])
