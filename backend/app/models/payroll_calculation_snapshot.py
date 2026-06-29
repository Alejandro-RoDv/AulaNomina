from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class PayrollCalculationSnapshot(Base):
    __tablename__ = "payroll_calculation_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "payroll_id",
            "calculation_version",
            name="uq_payroll_calculation_snapshot_version",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    payroll_id = Column(
        Integer,
        ForeignKey("payrolls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    calculation_version = Column(Integer, nullable=False)
    engine_version = Column(String, nullable=False)
    fingerprint = Column(String, nullable=False, index=True)
    actor = Column(String, nullable=True)
    rule_references = Column(JSON, default=list, nullable=False)
    input_snapshot = Column(JSON, default=dict, nullable=False)
    result_snapshot = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    payroll = relationship("Payroll", back_populates="calculation_snapshots")
