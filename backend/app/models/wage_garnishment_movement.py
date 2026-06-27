from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class WageGarnishmentMovement(Base):
    __tablename__ = "wage_garnishment_movements"
    __table_args__ = (
        UniqueConstraint("wage_garnishment_id", "period_year", "period_month", name="uq_garnishment_period"),
    )

    id = Column(Integer, primary_key=True, index=True)
    wage_garnishment_id = Column(Integer, ForeignKey("wage_garnishments.id"), nullable=False, index=True)
    payroll_id = Column(Integer, ForeignKey("payrolls.id"), nullable=True, index=True)
    period_year = Column(Integer, nullable=False, index=True)
    period_month = Column(Integer, nullable=False, index=True)
    payroll_date = Column(Date, nullable=True)
    monthly_net = Column(Numeric(12, 2), nullable=False)
    smi_annual = Column(Numeric(12, 2), nullable=False)
    calculated_amount = Column(Numeric(12, 2), nullable=False)
    withheld_amount = Column(Numeric(12, 2), nullable=False)
    paid_date = Column(Date, nullable=True)
    payment_status = Column(String(30), default="pending", nullable=False, index=True)
    balance_after = Column(Numeric(12, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(String(120), default="usuario-demo", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    wage_garnishment = relationship("WageGarnishment", back_populates="movements")
    payroll = relationship("Payroll")
