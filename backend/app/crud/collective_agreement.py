from sqlalchemy.orm import Session

from app.models.collective_agreement import (
    AgreementComplement,
    CollectiveAgreement,
    LeaveRule,
    ProfessionalCategory,
    ProfessionalGroup,
    SalaryTable,
    SalaryTableRow,
    VacationRule,
    WorkTimeRule,
)
from app.schemas.collective_agreement import (
    AgreementComplementCreate,
    AgreementComplementUpdate,
    CollectiveAgreementCreate,
    CollectiveAgreementUpdate,
    LeaveRuleCreate,
    LeaveRuleUpdate,
    ProfessionalCategoryCreate,
    ProfessionalCategoryUpdate,
    ProfessionalGroupCreate,
    ProfessionalGroupUpdate,
    SalaryTableCreate,
    SalaryTableRowCreate,
    SalaryTableRowUpdate,
    SalaryTableUpdate,
    VacationRuleCreate,
    VacationRuleUpdate,
    WorkTimeRuleCreate,
    WorkTimeRuleUpdate,
)


def create_collective_agreement(db: Session, agreement: CollectiveAgreementCreate):
    db_agreement = CollectiveAgreement(**agreement.model_dump())
    db.add(db_agreement)
    db.commit()
    db.refresh(db_agreement)
    return db_agreement


def get_collective_agreements(db: Session, include_inactive: bool = False):
    query = db.query(CollectiveAgreement)
    if not include_inactive:
        query = query.filter(CollectiveAgreement.is_active == True)
    return query.order_by(CollectiveAgreement.name).all()


def get_collective_agreement(db: Session, agreement_id: int):
    return db.query(CollectiveAgreement).filter(CollectiveAgreement.id == agreement_id).first()


def update_collective_agreement(db: Session, agreement_id: int, agreement_data: CollectiveAgreementUpdate):
    db_agreement = get_collective_agreement(db, agreement_id)
    if not db_agreement:
        return None

    for key, value in agreement_data.model_dump(exclude_unset=True).items():
        setattr(db_agreement, key, value)

    db.commit()
    db.refresh(db_agreement)
    return db_agreement


def archive_collective_agreement(db: Session, agreement_id: int):
    db_agreement = get_collective_agreement(db, agreement_id)
    if not db_agreement:
        return None

    db_agreement.is_active = False
    db_agreement.status = "archived"
    db.commit()
    db.refresh(db_agreement)
    return db_agreement


def create_professional_group(db: Session, agreement_id: int, group: ProfessionalGroupCreate):
    db_group = ProfessionalGroup(collective_agreement_id=agreement_id, **group.model_dump())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


def get_professional_groups(db: Session, agreement_id: int):
    return (
        db.query(ProfessionalGroup)
        .filter(ProfessionalGroup.collective_agreement_id == agreement_id)
        .order_by(ProfessionalGroup.display_order, ProfessionalGroup.name)
        .all()
    )


def get_professional_group(db: Session, group_id: int):
    return db.query(ProfessionalGroup).filter(ProfessionalGroup.id == group_id).first()


def update_professional_group(db: Session, group_id: int, group_data: ProfessionalGroupUpdate):
    db_group = get_professional_group(db, group_id)
    if not db_group:
        return None

    for key, value in group_data.model_dump(exclude_unset=True).items():
        setattr(db_group, key, value)

    db.commit()
    db.refresh(db_group)
    return db_group


def delete_professional_group(db: Session, group_id: int):
    db_group = get_professional_group(db, group_id)
    if not db_group:
        return None

    db.delete(db_group)
    db.commit()
    return db_group


def create_professional_category(db: Session, agreement_id: int, category: ProfessionalCategoryCreate):
    db_category = ProfessionalCategory(collective_agreement_id=agreement_id, **category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def get_professional_categories(db: Session, agreement_id: int):
    return (
        db.query(ProfessionalCategory)
        .filter(ProfessionalCategory.collective_agreement_id == agreement_id)
        .order_by(ProfessionalCategory.display_order, ProfessionalCategory.name)
        .all()
    )


def get_professional_category(db: Session, category_id: int):
    return db.query(ProfessionalCategory).filter(ProfessionalCategory.id == category_id).first()


def update_professional_category(db: Session, category_id: int, category_data: ProfessionalCategoryUpdate):
    db_category = get_professional_category(db, category_id)
    if not db_category:
        return None

    for key, value in category_data.model_dump(exclude_unset=True).items():
        setattr(db_category, key, value)

    db.commit()
    db.refresh(db_category)
    return db_category


def delete_professional_category(db: Session, category_id: int):
    db_category = get_professional_category(db, category_id)
    if not db_category:
        return None

    db.delete(db_category)
    db.commit()
    return db_category


def create_salary_table(db: Session, agreement_id: int, salary_table: SalaryTableCreate):
    db_salary_table = SalaryTable(collective_agreement_id=agreement_id, **salary_table.model_dump())
    db.add(db_salary_table)
    db.commit()
    db.refresh(db_salary_table)
    return db_salary_table


def get_salary_tables(db: Session, agreement_id: int):
    return (
        db.query(SalaryTable)
        .filter(SalaryTable.collective_agreement_id == agreement_id)
        .order_by(SalaryTable.year.desc().nullslast(), SalaryTable.name)
        .all()
    )


def get_salary_table(db: Session, salary_table_id: int):
    return db.query(SalaryTable).filter(SalaryTable.id == salary_table_id).first()


def update_salary_table(db: Session, salary_table_id: int, salary_table_data: SalaryTableUpdate):
    db_salary_table = get_salary_table(db, salary_table_id)
    if not db_salary_table:
        return None

    for key, value in salary_table_data.model_dump(exclude_unset=True).items():
        setattr(db_salary_table, key, value)

    db.commit()
    db.refresh(db_salary_table)
    return db_salary_table


def delete_salary_table(db: Session, salary_table_id: int):
    db_salary_table = get_salary_table(db, salary_table_id)
    if not db_salary_table:
        return None

    db.delete(db_salary_table)
    db.commit()
    return db_salary_table


def create_salary_table_row(db: Session, salary_table_id: int, row: SalaryTableRowCreate):
    db_row = SalaryTableRow(salary_table_id=salary_table_id, **row.model_dump())
    db.add(db_row)
    db.commit()
    db.refresh(db_row)
    return db_row


def get_salary_table_rows(db: Session, salary_table_id: int):
    return db.query(SalaryTableRow).filter(SalaryTableRow.salary_table_id == salary_table_id).all()


def get_salary_table_row(db: Session, row_id: int):
    return db.query(SalaryTableRow).filter(SalaryTableRow.id == row_id).first()


def update_salary_table_row(db: Session, row_id: int, row_data: SalaryTableRowUpdate):
    db_row = get_salary_table_row(db, row_id)
    if not db_row:
        return None

    for key, value in row_data.model_dump(exclude_unset=True).items():
        setattr(db_row, key, value)

    db.commit()
    db.refresh(db_row)
    return db_row


def delete_salary_table_row(db: Session, row_id: int):
    db_row = get_salary_table_row(db, row_id)
    if not db_row:
        return None

    db.delete(db_row)
    db.commit()
    return db_row


def create_agreement_complement(db: Session, agreement_id: int, complement: AgreementComplementCreate):
    db_complement = AgreementComplement(collective_agreement_id=agreement_id, **complement.model_dump())
    db.add(db_complement)
    db.commit()
    db.refresh(db_complement)
    return db_complement


def get_agreement_complements(db: Session, agreement_id: int):
    return db.query(AgreementComplement).filter(AgreementComplement.collective_agreement_id == agreement_id).all()


def update_agreement_complement(db: Session, complement_id: int, complement_data: AgreementComplementUpdate):
    db_complement = db.query(AgreementComplement).filter(AgreementComplement.id == complement_id).first()
    if not db_complement:
        return None

    for key, value in complement_data.model_dump(exclude_unset=True).items():
        setattr(db_complement, key, value)

    db.commit()
    db.refresh(db_complement)
    return db_complement


def create_work_time_rule(db: Session, agreement_id: int, rule: WorkTimeRuleCreate):
    db_rule = WorkTimeRule(collective_agreement_id=agreement_id, **rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_work_time_rules(db: Session, agreement_id: int):
    return db.query(WorkTimeRule).filter(WorkTimeRule.collective_agreement_id == agreement_id).all()


def get_work_time_rule(db: Session, rule_id: int):
    return db.query(WorkTimeRule).filter(WorkTimeRule.id == rule_id).first()


def update_work_time_rule(db: Session, rule_id: int, rule_data: WorkTimeRuleUpdate):
    db_rule = get_work_time_rule(db, rule_id)
    if not db_rule:
        return None

    for key, value in rule_data.model_dump(exclude_unset=True).items():
        setattr(db_rule, key, value)

    db.commit()
    db.refresh(db_rule)
    return db_rule


def delete_work_time_rule(db: Session, rule_id: int):
    db_rule = get_work_time_rule(db, rule_id)
    if not db_rule:
        return None

    db.delete(db_rule)
    db.commit()
    return db_rule


def create_vacation_rule(db: Session, agreement_id: int, rule: VacationRuleCreate):
    db_rule = VacationRule(collective_agreement_id=agreement_id, **rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_vacation_rules(db: Session, agreement_id: int):
    return db.query(VacationRule).filter(VacationRule.collective_agreement_id == agreement_id).all()


def get_vacation_rule(db: Session, rule_id: int):
    return db.query(VacationRule).filter(VacationRule.id == rule_id).first()


def update_vacation_rule(db: Session, rule_id: int, rule_data: VacationRuleUpdate):
    db_rule = get_vacation_rule(db, rule_id)
    if not db_rule:
        return None

    for key, value in rule_data.model_dump(exclude_unset=True).items():
        setattr(db_rule, key, value)

    db.commit()
    db.refresh(db_rule)
    return db_rule


def delete_vacation_rule(db: Session, rule_id: int):
    db_rule = get_vacation_rule(db, rule_id)
    if not db_rule:
        return None

    db.delete(db_rule)
    db.commit()
    return db_rule


def create_leave_rule(db: Session, agreement_id: int, rule: LeaveRuleCreate):
    db_rule = LeaveRule(collective_agreement_id=agreement_id, **rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_leave_rules(db: Session, agreement_id: int):
    return db.query(LeaveRule).filter(LeaveRule.collective_agreement_id == agreement_id).all()


def get_leave_rule(db: Session, rule_id: int):
    return db.query(LeaveRule).filter(LeaveRule.id == rule_id).first()


def update_leave_rule(db: Session, rule_id: int, rule_data: LeaveRuleUpdate):
    db_rule = get_leave_rule(db, rule_id)
    if not db_rule:
        return None

    for key, value in rule_data.model_dump(exclude_unset=True).items():
        setattr(db_rule, key, value)

    db.commit()
    db.refresh(db_rule)
    return db_rule


def delete_leave_rule(db: Session, rule_id: int):
    db_rule = get_leave_rule(db, rule_id)
    if not db_rule:
        return None

    db.delete(db_rule)
    db.commit()
    return db_rule
