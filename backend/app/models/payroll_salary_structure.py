from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
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
    source_type = Column(String, default="SYSTEM", nullable=False)
    agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=True)
    calculation_type = Column(String, default="FIXED_AMOUNT", nullable=False)
    default_amount = Column(Numeric(10, 2), default=0, nullable=False)
    default_unit_price = Column(Numeric(10, 2), default=0, nullable=False)
    applies_workday_percentage = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    is_taxable = Column(Boolean, default=True, nullable=False)
    is_contribution_base = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    payroll_items = relationship("PayrollItem", back_populates="concept")
    contract_concepts = relationship("ContractPayrollConcept", back_populates="concept")
    agreement = relationship("CollectiveAgreement")


class ContractPayrollConcept(Base):
    __tablename__ = "contract_payroll_concepts"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False, index=True)
    concept_id = Column(Integer, ForeignKey("payroll_concepts.id"), nullable=False)
    description = Column(String, nullable=True)
    quantity = Column(Numeric(10, 2), default=1, nullable=False)
    unit_price = Column(Numeric(10, 2), default=0, nullable=False)
    amount = Column(Numeric(10, 2), default=0, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = relationship("Contract", back_populates="payroll_concepts")
    concept = relationship("PayrollConcept", back_populates="contract_concepts")

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
    source_type = Column(String, default="manual", nullable=False, index=True)
    source_id = Column(Integer, nullable=True, index=True)
    source_key = Column(String, unique=True, nullable=True, index=True)
    segment_id = Column(Integer, ForeignKey("payroll_segments.id"), nullable=True, index=True)
    is_automatic = Column(Boolean, default=False, nullable=False)
    calculation_trace = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    payroll = relationship("Payroll", back_populates="items")
    concept = relationship("PayrollConcept", back_populates="payroll_items")
    segment = relationship("PayrollSegment", back_populates="payroll_items")

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
