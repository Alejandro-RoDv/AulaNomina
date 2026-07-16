from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class AffiliationWorkerState(Base):
    """Estado externo simulado que conserva SILTRA/TGSS por trabajador y CCC.

    El estado no se deduce de la ficha del trabajador después del primer movimiento
    aceptado. De este modo el simulador puede rechazar altas duplicadas, bajas de
    personas que no constan de alta y modificaciones sobre relaciones inexistentes.
    """

    __tablename__ = "affiliation_worker_states"
    __table_args__ = (
        UniqueConstraint("employee_id", "ccc", name="uq_affiliation_worker_state_employee_ccc"),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True, index=True)
    ccc = Column(String(32), nullable=False, index=True)
    status = Column(String(20), default="INACTIVE", nullable=False, index=True)

    last_movement_type = Column(String(20), nullable=True)
    last_movement_date = Column(Date, nullable=True)
    last_movement_key = Column(String(120), nullable=True, index=True)
    source_submission_id = Column(
        Integer,
        ForeignKey("communication_submissions.id"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    employee = relationship("Employee")
    company = relationship("Company")
    contract = relationship("Contract")
    source_submission = relationship("CommunicationSubmission")

    @property
    def is_active(self) -> bool:
        return self.status == "ACTIVE"
