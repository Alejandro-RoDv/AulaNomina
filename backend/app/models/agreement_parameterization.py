from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.db import Base


class AgreementConceptCatalog(Base):
    __tablename__ = "agreement_concept_catalog"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False, index=True)
    catalog_type = Column(String, nullable=False, index=True)  # salary, non_salary, deduction
    code = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    default_nature = Column(String, nullable=True)  # salarial, no_salarial, deduccion
    default_payment_type = Column(String, nullable=True)
    default_calculation_type = Column(String, nullable=True)
    default_contributes = Column(Boolean, default=True, nullable=False)
    default_taxable = Column(Boolean, default=True, nullable=False)
    default_cra_code = Column(String, nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgreementSalaryConcept(Base):
    __tablename__ = "agreement_salary_concepts"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False, index=True)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True, index=True)
    concept_catalog_id = Column(Integer, ForeignKey("agreement_concept_catalog.id"), nullable=True)
    character = Column(String, nullable=False, default="salarial")  # salarial, no_salarial, deduccion
    name = Column(String, nullable=False)
    scope = Column(String, nullable=False, default="global")  # global, specific
    amount = Column(Numeric(10, 2), nullable=True)
    payment_type = Column(String, nullable=True)  # mensual, anual, julio, diciembre, diario, trienio, otro
    calculation_type = Column(String, nullable=False, default="manual")  # automatico, manual, sin_definir
    contributes = Column(Boolean, default=True, nullable=False)
    taxable = Column(Boolean, default=True, nullable=False)
    cra_code = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    catalog_concept = relationship("AgreementConceptCatalog")
    professional_category = relationship("ProfessionalCategory")


class AgreementRuleHeader(Base):
    __tablename__ = "agreement_rule_headers"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False, index=True)
    rule_type = Column(String, nullable=False, index=True)
    code = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    scope = Column(String, nullable=False, default="global")
    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    options = Column(JSON, default=dict, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    details = relationship(
        "AgreementRuleDetail",
        back_populates="rule_header",
        cascade="all, delete-orphan",
        order_by="AgreementRuleDetail.display_order",
    )


class AgreementRuleDetail(Base):
    __tablename__ = "agreement_rule_details"

    id = Column(Integer, primary_key=True, index=True)
    rule_header_id = Column(Integer, ForeignKey("agreement_rule_headers.id"), nullable=False, index=True)
    detail_type = Column(String, nullable=False, default="line")
    code = Column(String, nullable=True, index=True)
    name = Column(String, nullable=False)
    display_order = Column(Integer, default=1, nullable=False)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True)
    concept_catalog_id = Column(Integer, ForeignKey("agreement_concept_catalog.id"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=True)
    percentage = Column(Numeric(7, 4), nullable=True)
    company_percentage = Column(Numeric(7, 4), nullable=True)
    worker_percentage = Column(Numeric(7, 4), nullable=True)
    total_percentage = Column(Numeric(7, 4), nullable=True)
    date_from = Column(Date, nullable=True)
    date_to = Column(Date, nullable=True)
    options = Column(JSON, default=dict, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    rule_header = relationship("AgreementRuleHeader", back_populates="details")
    professional_category = relationship("ProfessionalCategory")
    catalog_concept = relationship("AgreementConceptCatalog")
