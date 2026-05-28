from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.crud.collective_agreement import (
    archive_collective_agreement,
    create_agreement_complement,
    create_collective_agreement,
    create_leave_rule,
    create_professional_category,
    create_professional_group,
    create_salary_table,
    create_salary_table_row,
    create_vacation_rule,
    create_work_time_rule,
    delete_professional_category,
    delete_professional_group,
    delete_salary_table,
    delete_salary_table_row,
    get_agreement_complements,
    get_collective_agreement,
    get_collective_agreements,
    get_leave_rules,
    get_professional_categories,
    get_professional_category,
    get_professional_group,
    get_professional_groups,
    get_salary_table,
    get_salary_table_rows,
    get_salary_tables,
    get_vacation_rules,
    get_work_time_rules,
    update_agreement_complement,
    update_collective_agreement,
    update_leave_rule,
    update_professional_category,
    update_professional_group,
    update_salary_table,
    update_salary_table_row,
    update_vacation_rule,
    update_work_time_rule,
)
from app.db import SessionLocal
from app.schemas.collective_agreement import (
    AgreementComplementCreate,
    AgreementComplementResponse,
    AgreementComplementUpdate,
    CollectiveAgreementCreate,
    CollectiveAgreementDetailResponse,
    CollectiveAgreementResponse,
    CollectiveAgreementUpdate,
    LeaveRuleCreate,
    LeaveRuleResponse,
    LeaveRuleUpdate,
    ProfessionalCategoryCreate,
    ProfessionalCategoryResponse,
    ProfessionalCategoryUpdate,
    ProfessionalGroupCreate,
    ProfessionalGroupResponse,
    ProfessionalGroupUpdate,
    SalaryTableCreate,
    SalaryTableResponse,
    SalaryTableRowCreate,
    SalaryTableRowResponse,
    SalaryTableRowUpdate,
    SalaryTableUpdate,
    VacationRuleCreate,
    VacationRuleResponse,
    VacationRuleUpdate,
    WorkTimeRuleCreate,
    WorkTimeRuleResponse,
    WorkTimeRuleUpdate,
)
from app.seed_demo_agreements import seed_demo_collective_agreements

router = APIRouter(prefix="/collective-agreements", tags=["collective-agreements"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_agreement_exists(db: Session, agreement_id: int):
    agreement = get_collective_agreement(db, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")
    return agreement


def ensure_salary_table_exists(db: Session, salary_table_id: int):
    salary_table = get_salary_table(db, salary_table_id)
    if not salary_table:
        raise HTTPException(status_code=404, detail="Tabla salarial no encontrada")
    return salary_table


@router.post("/seed-demo")
def seed_demo_collective_agreements_endpoint(db: Session = Depends(get_db)):
    agreement = seed_demo_collective_agreements(db)
    return {"ok": True, "agreement_id": agreement.id, "message": "Convenio demo cargado"}


@router.get("", response_model=list[CollectiveAgreementResponse])
def list_collective_agreements(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return get_collective_agreements(db, include_inactive=include_inactive)


@router.post("", response_model=CollectiveAgreementResponse)
def create_collective_agreement_endpoint(
    agreement: CollectiveAgreementCreate,
    db: Session = Depends(get_db),
):
    return create_collective_agreement(db, agreement)


@router.get("/{agreement_id}", response_model=CollectiveAgreementDetailResponse)
def get_collective_agreement_endpoint(agreement_id: int, db: Session = Depends(get_db)):
    return ensure_agreement_exists(db, agreement_id)


@router.put("/{agreement_id}", response_model=CollectiveAgreementResponse)
def update_collective_agreement_endpoint(
    agreement_id: int,
    agreement: CollectiveAgreementUpdate,
    db: Session = Depends(get_db),
):
    updated_agreement = update_collective_agreement(db, agreement_id, agreement)
    if not updated_agreement:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")
    return updated_agreement


@router.delete("/{agreement_id}")
def archive_collective_agreement_endpoint(agreement_id: int, db: Session = Depends(get_db)):
    archived_agreement = archive_collective_agreement(db, agreement_id)
    if not archived_agreement:
        raise HTTPException(status_code=404, detail="Convenio no encontrado")
    return {"ok": True, "archived_id": agreement_id}


@router.get("/{agreement_id}/professional-groups", response_model=list[ProfessionalGroupResponse])
def list_professional_groups(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement_exists(db, agreement_id)
    return get_professional_groups(db, agreement_id)


@router.post("/{agreement_id}/professional-groups", response_model=ProfessionalGroupResponse)
def create_professional_group_endpoint(
    agreement_id: int,
    group: ProfessionalGroupCreate,
    db: Session = Depends(get_db),
):
    ensure_agreement_exists(db, agreement_id)
    return create_professional_group(db, agreement_id, group)


@router.put("/professional-groups/{group_id}", response_model=ProfessionalGroupResponse)
def update_professional_group_endpoint(
    group_id: int,
    group: ProfessionalGroupUpdate,
    db: Session = Depends(get_db),
):
    updated_group = update_professional_group(db, group_id, group)
    if not updated_group:
        raise HTTPException(status_code=404, detail="Grupo profesional no encontrado")
    return updated_group


@router.delete("/professional-groups/{group_id}")
def delete_professional_group_endpoint(group_id: int, db: Session = Depends(get_db)):
    deleted_group = delete_professional_group(db, group_id)
    if not deleted_group:
        raise HTTPException(status_code=404, detail="Grupo profesional no encontrado")
    return {"ok": True, "deleted_id": group_id}


@router.get("/{agreement_id}/professional-categories", response_model=list[ProfessionalCategoryResponse])
def list_professional_categories(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement_exists(db, agreement_id)
    return get_professional_categories(db, agreement_id)


@router.post("/{agreement_id}/professional-categories", response_model=ProfessionalCategoryResponse)
def create_professional_category_endpoint(
    agreement_id: int,
    category: ProfessionalCategoryCreate,
    db: Session = Depends(get_db),
):
    ensure_agreement_exists(db, agreement_id)
    if category.professional_group_id and not get_professional_group(db, category.professional_group_id):
        raise HTTPException(status_code=404, detail="Grupo profesional no encontrado")
    return create_professional_category(db, agreement_id, category)


@router.put("/professional-categories/{category_id}", response_model=ProfessionalCategoryResponse)
def update_professional_category_endpoint(
    category_id: int,
    category: ProfessionalCategoryUpdate,
    db: Session = Depends(get_db),
):
    if category.professional_group_id and not get_professional_group(db, category.professional_group_id):
        raise HTTPException(status_code=404, detail="Grupo profesional no encontrado")
    updated_category = update_professional_category(db, category_id, category)
    if not updated_category:
        raise HTTPException(status_code=404, detail="Categoría profesional no encontrada")
    return updated_category


@router.delete("/professional-categories/{category_id}")
def delete_professional_category_endpoint(category_id: int, db: Session = Depends(get_db)):
    deleted_category = delete_professional_category(db, category_id)
    if not deleted_category:
        raise HTTPException(status_code=404, detail="Categoría profesional no encontrada")
    return {"ok": True, "deleted_id": category_id}


@router.get("/{agreement_id}/salary-tables", response_model=list[SalaryTableResponse])
def list_salary_tables(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement_exists(db, agreement_id)
    return get_salary_tables(db, agreement_id)


@router.post("/{agreement_id}/salary-tables", response_model=SalaryTableResponse)
def create_salary_table_endpoint(
    agreement_id: int,
    salary_table: SalaryTableCreate,
    db: Session = Depends(get_db),
):
    ensure_agreement_exists(db, agreement_id)
    return create_salary_table(db, agreement_id, salary_table)


@router.put("/salary-tables/{salary_table_id}", response_model=SalaryTableResponse)
def update_salary_table_endpoint(
    salary_table_id: int,
    salary_table: SalaryTableUpdate,
    db: Session = Depends(get_db),
):
    updated_salary_table = update_salary_table(db, salary_table_id, salary_table)
    if not updated_salary_table:
        raise HTTPException(status_code=404, detail="Tabla salarial no encontrada")
    return updated_salary_table


@router.delete("/salary-tables/{salary_table_id}")
def delete_salary_table_endpoint(salary_table_id: int, db: Session = Depends(get_db)):
    deleted_salary_table = delete_salary_table(db, salary_table_id)
    if not deleted_salary_table:
        raise HTTPException(status_code=404, detail="Tabla salarial no encontrada")
    return {"ok": True, "deleted_id": salary_table_id}


@router.get("/salary-tables/{salary_table_id}/rows", response_model=list[SalaryTableRowResponse])
def list_salary_table_rows(salary_table_id: int, db: Session = Depends(get_db)):
    ensure_salary_table_exists(db, salary_table_id)
    return get_salary_table_rows(db, salary_table_id)


@router.post("/salary-tables/{salary_table_id}/rows", response_model=SalaryTableRowResponse)
def create_salary_table_row_endpoint(
    salary_table_id: int,
    row: SalaryTableRowCreate,
    db: Session = Depends(get_db),
):
    ensure_salary_table_exists(db, salary_table_id)
    if row.professional_category_id and not get_professional_category(db, row.professional_category_id):
        raise HTTPException(status_code=404, detail="Categoría profesional no encontrada")
    if row.professional_group_id and not get_professional_group(db, row.professional_group_id):
        raise HTTPException(status_code=404, detail="Grupo profesional no encontrado")
    return create_salary_table_row(db, salary_table_id, row)


@router.put("/salary-table-rows/{row_id}", response_model=SalaryTableRowResponse)
def update_salary_table_row_endpoint(
    row_id: int,
    row: SalaryTableRowUpdate,
    db: Session = Depends(get_db),
):
    if row.professional_category_id and not get_professional_category(db, row.professional_category_id):
        raise HTTPException(status_code=404, detail="Categoría profesional no encontrada")
    if row.professional_group_id and not get_professional_group(db, row.professional_group_id):
        raise HTTPException(status_code=404, detail="Grupo profesional no encontrado")
    updated_row = update_salary_table_row(db, row_id, row)
    if not updated_row:
        raise HTTPException(status_code=404, detail="Fila salarial no encontrada")
    return updated_row


@router.delete("/salary-table-rows/{row_id}")
def delete_salary_table_row_endpoint(row_id: int, db: Session = Depends(get_db)):
    deleted_row = delete_salary_table_row(db, row_id)
    if not deleted_row:
        raise HTTPException(status_code=404, detail="Fila salarial no encontrada")
    return {"ok": True, "deleted_id": row_id}


@router.get("/{agreement_id}/complements", response_model=list[AgreementComplementResponse])
def list_agreement_complements(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement_exists(db, agreement_id)
    return get_agreement_complements(db, agreement_id)


@router.post("/{agreement_id}/complements", response_model=AgreementComplementResponse)
def create_agreement_complement_endpoint(
    agreement_id: int,
    complement: AgreementComplementCreate,
    db: Session = Depends(get_db),
):
    ensure_agreement_exists(db, agreement_id)
    return create_agreement_complement(db, agreement_id, complement)


@router.put("/complements/{complement_id}", response_model=AgreementComplementResponse)
def update_agreement_complement_endpoint(
    complement_id: int,
    complement: AgreementComplementUpdate,
    db: Session = Depends(get_db),
):
    updated_complement = update_agreement_complement(db, complement_id, complement)
    if not updated_complement:
        raise HTTPException(status_code=404, detail="Complemento no encontrado")
    return updated_complement


@router.get("/{agreement_id}/work-time-rules", response_model=list[WorkTimeRuleResponse])
def list_work_time_rules(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement_exists(db, agreement_id)
    return get_work_time_rules(db, agreement_id)


@router.post("/{agreement_id}/work-time-rules", response_model=WorkTimeRuleResponse)
def create_work_time_rule_endpoint(
    agreement_id: int,
    rule: WorkTimeRuleCreate,
    db: Session = Depends(get_db),
):
    ensure_agreement_exists(db, agreement_id)
    return create_work_time_rule(db, agreement_id, rule)


@router.put("/work-time-rules/{rule_id}", response_model=WorkTimeRuleResponse)
def update_work_time_rule_endpoint(
    rule_id: int,
    rule: WorkTimeRuleUpdate,
    db: Session = Depends(get_db),
):
    updated_rule = update_work_time_rule(db, rule_id, rule)
    if not updated_rule:
        raise HTTPException(status_code=404, detail="Regla de jornada no encontrada")
    return updated_rule


@router.get("/{agreement_id}/vacation-rules", response_model=list[VacationRuleResponse])
def list_vacation_rules(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement_exists(db, agreement_id)
    return get_vacation_rules(db, agreement_id)


@router.post("/{agreement_id}/vacation-rules", response_model=VacationRuleResponse)
def create_vacation_rule_endpoint(
    agreement_id: int,
    rule: VacationRuleCreate,
    db: Session = Depends(get_db),
):
    ensure_agreement_exists(db, agreement_id)
    return create_vacation_rule(db, agreement_id, rule)


@router.put("/vacation-rules/{rule_id}", response_model=VacationRuleResponse)
def update_vacation_rule_endpoint(
    rule_id: int,
    rule: VacationRuleUpdate,
    db: Session = Depends(get_db),
):
    updated_rule = update_vacation_rule(db, rule_id, rule)
    if not updated_rule:
        raise HTTPException(status_code=404, detail="Regla de vacaciones no encontrada")
    return updated_rule


@router.get("/{agreement_id}/leave-rules", response_model=list[LeaveRuleResponse])
def list_leave_rules(agreement_id: int, db: Session = Depends(get_db)):
    ensure_agreement_exists(db, agreement_id)
    return get_leave_rules(db, agreement_id)


@router.post("/{agreement_id}/leave-rules", response_model=LeaveRuleResponse)
def create_leave_rule_endpoint(
    agreement_id: int,
    rule: LeaveRuleCreate,
    db: Session = Depends(get_db),
):
    ensure_agreement_exists(db, agreement_id)
    return create_leave_rule(db, agreement_id, rule)


@router.put("/leave-rules/{rule_id}", response_model=LeaveRuleResponse)
def update_leave_rule_endpoint(
    rule_id: int,
    rule: LeaveRuleUpdate,
    db: Session = Depends(get_db),
):
    updated_rule = update_leave_rule(db, rule_id, rule)
    if not updated_rule:
        raise HTTPException(status_code=404, detail="Regla de permiso no encontrada")
    return updated_rule
