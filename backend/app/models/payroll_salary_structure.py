from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class PayrollConcept(Base):
    __tablename__ = "payroll_concepts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, default="OTRO", nullable=False)
    concept_type = Column(String, default="DEVENGO", nullable=False)
    salary_nature = Column(String, default="SALARIAL", nullable=False)
    is_taxable = Column(Boolean, default=True, nullable=False)
    is_contribution_base = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    payroll_items = relationship("PayrollItem", back_populates="concept")


class PayrollItem(Base):
    __tablename__ = "payroll_items"

    id = Column(Integer, primary_key=True, index=True)
    payroll_id = Column(Integer, ForeignKey("payrolls.id"), nullable=False, index=True)
    concept_id = Column(Integer, ForeignKey("payroll_concepts.id"), nullable=False)
    description = Column(String, nullable=True)
    quantity = Column(Numeric(10, 2), default=1, nullable=False)
    unit_price = Column(Numeric(10, 2), default=0, nullable=False)
    amount = Column(Numeric(10, 2), default=0, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    payroll = relationship("Payroll", back_populates="items")
    concept = relationship("PayrollConcept", back_populates="payroll_items")

    @property
    def concept_name(self):
        return self.concept.name if self.concept else None

    @property
    def concept_code(self):
        return self.concept.code if self.concept else None

    @property
    def concept_type(self):
        return self.concept.concept_type if self.concept else None

    @property
    def category(self):
        return self.concept.category if self.concept else None

    @property
    def salary_nature(self):
        return self.concept.salary_nature if self.concept else None
