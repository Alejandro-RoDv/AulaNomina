from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class AgreementExtraPay(Base):
    __tablename__ = "agreement_extra_pays"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False, index=True)
    salary_table_id = Column(Integer, ForeignKey("salary_tables.id"), nullable=True, index=True)
    code = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    payment_month = Column(Integer, nullable=False)
    accrual_start_month = Column(Integer, nullable=False)
    accrual_end_month = Column(Integer, nullable=False)
    accrual_months = Column(Integer, nullable=False, default=6)
    proration_allowed = Column(Boolean, nullable=False, default=True)
    proration_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement")
    salary_table = relationship("SalaryTable")
    concept_lines = relationship(
        "AgreementExtraPayConcept",
        back_populates="extra_pay",
        cascade="all, delete-orphan",
        order_by="AgreementExtraPayConcept.display_order",
    )


class AgreementExtraPayConcept(Base):
    __tablename__ = "agreement_extra_pay_concepts"

    id = Column(Integer, primary_key=True, index=True)
    extra_pay_id = Column(Integer, ForeignKey("agreement_extra_pays.id"), nullable=False, index=True)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True, index=True)
    concept_key = Column(String, nullable=False, index=True)
    concept_name = Column(String, nullable=False)
    calculation_mode = Column(String, nullable=False, default="percentage")
    percentage = Column(Numeric(7, 4), nullable=True, default=100)
    fixed_amount = Column(Numeric(10, 2), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=10)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    extra_pay = relationship("AgreementExtraPay", back_populates="concept_lines")
    professional_category = relationship("ProfessionalCategory")
