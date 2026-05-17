from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class TaxProfile(Base):
    __tablename__ = "tax_profiles"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), unique=True, nullable=False, index=True)

    family_situation = Column(String, default="general", nullable=False)
    children_count = Column(Integer, default=0, nullable=False)
    employee_disability = Column(Boolean, default=False, nullable=False)
    descendants_disability = Column(Boolean, default=False, nullable=False)
    ascendants_in_care = Column(Integer, default=0, nullable=False)
    geographic_mobility = Column(Boolean, default=False, nullable=False)
    compensatory_pension = Column(Float, default=0, nullable=False)
    child_support_annuity = Column(Float, default=0, nullable=False)

    contract_type = Column(String, nullable=True)
    contract_start_date = Column(Date, nullable=True)
    expected_annual_salary = Column(Float, default=0, nullable=False)

    manual_regularization = Column(Boolean, default=False, nullable=False)
    voluntary_irpf = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    employee = relationship("Employee", back_populates="tax_profile")
