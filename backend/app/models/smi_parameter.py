from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Integer, Numeric, String

from app.db import Base


class SmiParameter(Base):
    __tablename__ = "smi_parameters"

    id = Column(Integer, primary_key=True, index=True)
    effective_from = Column(Date, nullable=False, index=True)
    effective_to = Column(Date, nullable=True, index=True)
    daily_amount = Column(Numeric(10, 2), nullable=False)
    monthly_amount = Column(Numeric(10, 2), nullable=False)
    annual_amount = Column(Numeric(12, 2), nullable=False)
    source_reference = Column(String(250), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def applies_on(self, target_date: date) -> bool:
        return self.effective_from <= target_date and (self.effective_to is None or self.effective_to >= target_date)
