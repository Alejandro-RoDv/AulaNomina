from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class IncidentDetail(Base):
    """Extensión versionada de una incidencia sin romper la tabla histórica existente."""

    __tablename__ = "incident_details"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    unit_type = Column(String, nullable=True)
    hours = Column(Numeric(8, 2), nullable=True)
    days = Column(Numeric(8, 2), nullable=True)
    paid = Column(Boolean, nullable=True)
    payroll_effect = Column(String, default="pending", nullable=False)
    processed_payroll_id = Column(Integer, ForeignKey("payrolls.id"), nullable=True)
    generated_amount = Column(Numeric(12, 2), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    requires_recalculation = Column(Boolean, default=False, nullable=False)
    requires_regularization = Column(Boolean, default=False, nullable=False)
    overlap_override = Column(Boolean, default=False, nullable=False)
    overlap_reason = Column(Text, nullable=True)
    origin = Column(String, default="manual", nullable=False)
    details = Column(JSON, default=dict, nullable=False)
    created_by = Column(String, nullable=True)
    updated_by = Column(String, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    incident = relationship("Incident", back_populates="detail")
    processed_payroll = relationship("Payroll")


class IncidentAudit(Base):
    __tablename__ = "incident_audits"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False)
    version = Column(Integer, nullable=False)
    actor = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    previous_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="audit_entries")


class IncidentConfirmation(Base):
    __tablename__ = "incident_confirmations"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    number = Column(String, nullable=False)
    confirmation_date = Column(Date, nullable=False)
    doctor_number = Column(String, nullable=True)
    confirmation_type = Column(String, nullable=True)
    observations = Column(Text, nullable=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    status = Column(String, default="active", nullable=False)
    is_cancelled = Column(Boolean, default=False, nullable=False)
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    version = Column(Integer, default=1, nullable=False)

    incident = relationship("Incident", back_populates="confirmations")
    document = relationship("Document")
