from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, event, inspect
from sqlalchemy.orm import Session, relationship

from app.db import Base


class CollectiveAgreement(Base):
    __tablename__ = "collective_agreements"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    official_name = Column(String, nullable=True)
    internal_name = Column(String, nullable=True)
    agreement_code = Column(String, nullable=True, index=True)
    sector = Column(String, nullable=True)
    territorial_scope = Column(String, nullable=True)
    functional_scope = Column(Text, nullable=True)
    personal_scope = Column(Text, nullable=True)
    publication_date = Column(Date, nullable=True)
    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)
    is_extendable = Column(Boolean, default=False, nullable=False)
    boe_alerts_enabled = Column(Boolean, default=False, nullable=False)
    boe_search_terms = Column(Text, nullable=True)
    status = Column(String, default="draft", nullable=False)
    source_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    professional_groups = relationship(
        "ProfessionalGroup",
        back_populates="collective_agreement",
        cascade="all, delete-orphan",
        order_by="ProfessionalGroup.display_order",
    )
    professional_categories = relationship(
        "ProfessionalCategory",
        back_populates="collective_agreement",
        cascade="all, delete-orphan",
        order_by="ProfessionalCategory.display_order",
    )
    salary_tables = relationship(
        "SalaryTable",
        back_populates="collective_agreement",
        cascade="all, delete-orphan",
        order_by="SalaryTable.year",
    )
    complements = relationship(
        "AgreementComplement",
        back_populates="collective_agreement",
        cascade="all, delete-orphan",
    )
    work_time_rules = relationship(
        "WorkTimeRule",
        back_populates="collective_agreement",
        cascade="all, delete-orphan",
    )
    vacation_rules = relationship(
        "VacationRule",
        back_populates="collective_agreement",
        cascade="all, delete-orphan",
    )
    leave_rules = relationship(
        "LeaveRule",
        back_populates="collective_agreement",
        cascade="all, delete-orphan",
    )
    parameterized_rules = relationship("AgreementRuleHeader", cascade="all, delete-orphan")
    concept_catalog = relationship("AgreementConceptCatalog", cascade="all, delete-orphan")
    salary_concepts = relationship("AgreementSalaryConcept", cascade="all, delete-orphan")


class ProfessionalGroup(Base):
    __tablename__ = "professional_groups"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False)
    code = Column(String, nullable=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement", back_populates="professional_groups")
    categories = relationship(
        "ProfessionalCategory",
        back_populates="professional_group",
        cascade="all, delete-orphan",
        order_by="ProfessionalCategory.display_order",
    )


class ProfessionalCategory(Base):
    __tablename__ = "professional_categories"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False)
    professional_group_id = Column(Integer, ForeignKey("professional_groups.id"), nullable=True)
    code = Column(String, nullable=True)
    name = Column(String, nullable=False)
    subgroup = Column(String, nullable=True)
    level = Column(String, nullable=True)
    functional_description = Column(Text, nullable=True)
    required_qualification = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    display_order = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement", back_populates="professional_categories")
    professional_group = relationship("ProfessionalGroup", back_populates="categories")
    salary_rows = relationship("SalaryTableRow", back_populates="professional_category")


class SalaryTable(Base):
    __tablename__ = "salary_tables"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False)
    name = Column(String, nullable=False)
    year = Column(Integer, nullable=True, index=True)
    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)
    number_of_payments = Column(Integer, default=14, nullable=False)
    amount_type = Column(String, default="monthly", nullable=False)
    status = Column(String, default="active", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement", back_populates="salary_tables")
    rows = relationship(
        "SalaryTableRow",
        back_populates="salary_table",
        cascade="all, delete-orphan",
        order_by="SalaryTableRow.id",
    )


class SalaryTableRow(Base):
    __tablename__ = "salary_table_rows"

    id = Column(Integer, primary_key=True, index=True)
    salary_table_id = Column(Integer, ForeignKey("salary_tables.id"), nullable=False)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True)
    professional_group_id = Column(Integer, ForeignKey("professional_groups.id"), nullable=True)
    category_name = Column(String, nullable=True)
    group_name = Column(String, nullable=True)
    level = Column(String, nullable=True)
    base_salary = Column(Numeric(10, 2), nullable=True)
    seniority_amount = Column(Numeric(10, 2), nullable=True)
    specific_complement = Column(Numeric(10, 2), nullable=True)
    agreement_plus = Column(Numeric(10, 2), nullable=True)
    total_amount = Column(Numeric(10, 2), nullable=True)
    amount_unit = Column(String, default="monthly", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    salary_table = relationship("SalaryTable", back_populates="rows")
    professional_category = relationship("ProfessionalCategory", back_populates="salary_rows")
    professional_group = relationship("ProfessionalGroup")


class AgreementComplement(Base):
    __tablename__ = "agreement_complements"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True)
    name = Column(String, nullable=False)
    complement_type = Column(String, nullable=True)
    amount = Column(Numeric(10, 2), nullable=True)
    percentage = Column(Numeric(5, 2), nullable=True)
    periodicity = Column(String, nullable=True)
    number_of_payments = Column(Integer, nullable=True)
    contribution_treatment = Column(String, nullable=True)
    tax_treatment = Column(String, nullable=True)
    application_conditions = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement", back_populates="complements")
    professional_category = relationship("ProfessionalCategory")


class WorkTimeRule(Base):
    __tablename__ = "work_time_rules"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False)
    professional_group_id = Column(Integer, ForeignKey("professional_groups.id"), nullable=True)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True)
    name = Column(String, nullable=False)
    annual_hours = Column(Numeric(8, 2), nullable=True)
    weekly_hours = Column(Numeric(6, 2), nullable=True)
    daily_max_hours = Column(Numeric(6, 2), nullable=True)
    distribution_type = Column(String, nullable=True)
    rest_between_shifts_hours = Column(Numeric(6, 2), nullable=True)
    weekly_rest = Column(String, nullable=True)
    special_periods = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement", back_populates="work_time_rules")
    professional_group = relationship("ProfessionalGroup")
    professional_category = relationship("ProfessionalCategory")


class VacationRule(Base):
    __tablename__ = "vacation_rules"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False)
    professional_group_id = Column(Integer, ForeignKey("professional_groups.id"), nullable=True)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True)
    name = Column(String, nullable=False)
    natural_days = Column(Integer, nullable=True)
    working_days = Column(Integer, nullable=True)
    preferred_period = Column(String, nullable=True)
    accrual_period = Column(String, nullable=True)
    proportional_rule = Column(Text, nullable=True)
    it_overlap_rule = Column(Text, nullable=True)
    termination_compensation_rule = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement", back_populates="vacation_rules")
    professional_group = relationship("ProfessionalGroup")
    professional_category = relationship("ProfessionalCategory")


class LeaveRule(Base):
    __tablename__ = "leave_rules"

    id = Column(Integer, primary_key=True, index=True)
    collective_agreement_id = Column(Integer, ForeignKey("collective_agreements.id"), nullable=False)
    professional_group_id = Column(Integer, ForeignKey("professional_groups.id"), nullable=True)
    professional_category_id = Column(Integer, ForeignKey("professional_categories.id"), nullable=True)
    name = Column(String, nullable=False)
    leave_type = Column(String, nullable=False)
    cause = Column(String, nullable=True)
    duration = Column(Numeric(8, 2), nullable=True)
    duration_unit = Column(String, nullable=True)
    paid = Column(Boolean, default=True, nullable=False)
    requires_notice = Column(Boolean, default=False, nullable=False)
    requires_justification = Column(Boolean, default=True, nullable=False)
    displacement_extension = Column(Text, nullable=True)
    salary_treatment = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    collective_agreement = relationship("CollectiveAgreement", back_populates="leave_rules")
    professional_group = relationship("ProfessionalGroup")
    professional_category = relationship("ProfessionalCategory")


@event.listens_for(Session, "before_flush")
def enforce_single_active_salary_table(session, flush_context, instances):
    changed_objects = set(session.new).union(session.dirty)
    candidates = [
        item
        for item in changed_objects
        if isinstance(item, SalaryTable)
        and item.status == "active"
        and (item in session.new or inspect(item).attrs.status.history.has_changes())
    ]
    if not candidates:
        return

    candidates_by_agreement = {}
    for candidate in candidates:
        candidates_by_agreement.setdefault(candidate.collective_agreement_id, []).append(candidate)

    for agreement_id, agreement_candidates in candidates_by_agreement.items():
        if agreement_id is None:
            continue
        if len(agreement_candidates) > 1:
            raise HTTPException(
                status_code=409,
                detail="Solo puede existir una tabla salarial activa por convenio. Utiliza el flujo de activación controlada.",
            )

        candidate = agreement_candidates[0]
        with session.no_autoflush:
            persisted_active = (
                session.query(SalaryTable)
                .filter(
                    SalaryTable.collective_agreement_id == agreement_id,
                    SalaryTable.status == "active",
                )
                .all()
            )

        conflicts = [
            table
            for table in persisted_active
            if table not in session.deleted
            and table is not candidate
            and table.id != candidate.id
            and table.status == "active"
        ]
        if conflicts:
            raise HTTPException(
                status_code=409,
                detail="Ya existe una tabla salarial activa para este convenio. Utiliza el flujo de activación controlada.",
            )
