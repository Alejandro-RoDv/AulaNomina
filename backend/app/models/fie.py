from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class FieCommunication(Base):
    __tablename__ = "fie_communications"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True, index=True)
    ccc_id = Column(String, nullable=True, index=True)
    naf = Column(String, nullable=True, index=True)
    external_message_id = Column(String, nullable=False, unique=True, index=True)
    process_reference = Column(String, nullable=False, index=True)
    previous_process_reference = Column(String, nullable=True, index=True)
    communication_type = Column(String, nullable=False, index=True)
    contingency_type = Column(String, nullable=True)
    event_date = Column(Date, nullable=False, index=True)
    sick_leave_date = Column(Date, nullable=True)
    confirmation_date = Column(Date, nullable=True)
    medical_discharge_date = Column(Date, nullable=True)
    relapse_date = Column(Date, nullable=True)
    estimated_duration = Column(Integer, nullable=True)
    source = Column(String, default="SIMULATION", nullable=False)
    received_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    status = Column(String, default="RECEIVED", nullable=False, index=True)
    reconciliation_result = Column(JSON, default=dict, nullable=False)
    payroll_impact = Column(String, default="NO_IMPACT", nullable=False)
    raw_content = Column(JSON, default=dict, nullable=False)
    notes = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    company = relationship("Company")
    employee = relationship("Employee")
    contract = relationship("Contract")
    incident = relationship("Incident")
    events = relationship(
        "FieProcessingEvent",
        back_populates="communication",
        cascade="all, delete-orphan",
        order_by="FieProcessingEvent.created_at.asc()",
    )

    @property
    def company_name(self):
        return self.company.name if self.company else None

    @property
    def employee_name(self):
        if not self.employee:
            return None
        return " ".join(
            part
            for part in [
                self.employee.first_name,
                self.employee.last_name,
                self.employee.second_last_name,
            ]
            if part
        )

    @property
    def incident_status(self):
        return self.incident.status if self.incident else None


class FieProcessingEvent(Base):
    __tablename__ = "fie_processing_events"

    id = Column(Integer, primary_key=True, index=True)
    communication_id = Column(
        Integer,
        ForeignKey("fie_communications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String, nullable=False, index=True)
    actor = Column(String, nullable=True)
    detail = Column(Text, nullable=True)
    payload = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    communication = relationship("FieCommunication", back_populates="events")
