import json
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class WageGarnishment(Base):
    __tablename__ = "wage_garnishments"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    reference = Column(String(120), nullable=False)
    issuing_body = Column(String(200), nullable=False)
    creditor = Column(String(200), nullable=True)
    status = Column(String(30), default="active", nullable=False, index=True)
    notification_date = Column(Date, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)

    total_debt = Column(Numeric(12, 2), nullable=True)
    withheld_to_date = Column(Numeric(12, 2), default=0, nullable=False)
    monthly_net = Column(Numeric(12, 2), nullable=False)
    smi_annual = Column(Numeric(12, 2), nullable=False)
    reduction_percentage = Column(Numeric(5, 2), default=0, nullable=False)
    extra_pay_prorated = Column(Boolean, default=False, nullable=False)
    includes_full_extra_pay = Column(Boolean, default=False, nullable=False)
    extra_pay_amount = Column(Numeric(12, 2), default=0, nullable=False)
    family_burdens = Column(Boolean, default=False, nullable=False)
    monthly_garnishable = Column(Numeric(12, 2), nullable=False)
    calculation_detail = Column(Text, nullable=False)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    employee = relationship("Employee")
    contract = relationship("Contract")
    company = relationship("Company")

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
    def remaining_debt(self):
        if self.total_debt is None:
            return None
        return max(Decimal("0.00"), self.total_debt - (self.withheld_to_date or Decimal("0.00")))

    @property
    def calculation_snapshot(self):
        try:
            return json.loads(self.calculation_detail or "{}")
        except (TypeError, ValueError):
            return {}
