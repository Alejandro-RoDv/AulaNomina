from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class AgreementSeniorityRule(Base):
    __tablename__ = "agreement_seniority_rules"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False, index=True)
    salary_table_id = Column(Integer, ForeignKey("salary_tables.id"), nullable=True, index=True)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True, index=True)

    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    module_years = Column(Integer, default=3, nullable=False)
    calculation_mode = Column(String, default="table_amount", nullable=False)
    fixed_amount = Column(Numeric(10, 2), nullable=True)
    percentage = Column(Numeric(7, 4), nullable=True)
    percentage_base = Column(String, default="salary_base", nullable=False)
    max_modules = Column(Integer, nullable=True)

    applies_partiality = Column(Boolean, default=True, nullable=False)
    daily_proration_on_maturity = Column(Boolean, default=True, nullable=False)
    contributes = Column(Boolean, default=True, nullable=False)
    taxable = Column(Boolean, default=True, nullable=False)
    affects_extra_payments = Column(Boolean, default=True, nullable=False)

    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=10, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement")
    salary_table = relationship("SalaryTable")
    professional_category = relationship("ProfessionalCategory")
