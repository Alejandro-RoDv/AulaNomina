from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException

from app.models.collective_agreement import CollectiveAgreement, ProfessionalCategory, SalaryTableRow
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.company import Company
from app.models.work_center import WorkCenter
from app.schemas.contract import ContractCreate, ContractUpdate


CONTRACT_FIELD_NAMES = [
    "id",
    "employee_id",
    "company_id",
    "center_id",
    "contract_type",
    "contract_code",
    "contract_code_description",
    "contract_family",
    "start_date",
    "seniority_date",
    "seniority_criterion",
    "end_date",
    "termination_reason",
    "status",
    "transformation_from_contract_id",
    "transformation_date",
    "transformation_reason",
    "bonus_type",
    "bonus_start_date",
    "bonus_end_date",
    "bonus_fixed_fee",
    "bonus_observations",
    "contribution_group",
    "professional_category",
    "job_position",
    "collective_agreement_code",
    "collective_agreement_id",
    "professional_category_id",
    "salary_table_row_id",
    "working_day_type",
    "weekly_hours",
    "full_time_weekly_hours",
    "annual_agreement_hours",
    "monthly_hours",
    "annual_hours",
    "partiality_coefficient",
    "ordinary_hours",
    "ordinary_hours_period",
    "comparison_reference_type",
    "comparison_hours",
    "work_distribution",
    "pay_accrual_mode",
    "contribution_hours_mode",
    "legal_workday_reduction_cause",
    "legal_workday_reduction_start",
    "legal_workday_reduction_end",
    "legal_workday_reduction_percentage",
    "inactivity_start_date",
    "inactivity_return_date",
    "inactivity_start_communication_date",
    "inactivity_return_communication_date",
    "works_holidays",
    "holiday_scope",
    "holiday_only_service_days",
    "schedule_notes",
    "health_card_number",
    "subrogation",
    "subrogation_company_origin",
    "subrogation_date",
    "recognized_seniority_date",
    "affects_extra_payments",
    "relation_type",
    "representation_type",
    "relation_subtype",
    "registration_number",
    "authorization_number",
    "red_key",
    "red_cont",
    "cno_code",
    "cno_description",
    "company_cnae",
    "occupation",
    "it_rate",
    "ims_rate",
    "function_description",
    "section",
    "group_name",
    "contract_registry_number",
    "contract_registry_date",
    "contract_registry_office",
    "monthly_or_daily_contribution",
    "red_occupation_code",
    "red_reduction_code",
    "salary_base",
    "gross_annual_salary",
    "pay_schedule",
    "created_at",
]

CONTRACT_RESPONSE_FIELDS = CONTRACT_FIELD_NAMES
CONTRACT_CREATE_FIELDS = [field for field in CONTRACT_FIELD_NAMES if field not in {"id", "company_id", "center_id", "status", "created_at"}]


def contract_to_response(contract: Contract):
    data = {field: getattr(contract, field) for field in CONTRACT_RESPONSE_FIELDS}
    data["employee_name"] = contract.employee_name
    data["company_name"] = contract.company_name
    data["collective_agreement_name"] = contract.collective_agreement_name
    return data


def _resolve_company_and_center(db: Session, employee: Employee, company_id: int | None, center_id: int | None):
    resolved_company_id = company_id if company_id is not None else employee.company_id
    resolved_center_id = center_id if center_id is not None else employee.center_id

    if resolved_company_id is None:
        raise HTTPException(status_code=400, detail="El trabajador no tiene empresa asociada. Asigna una empresa antes de crear el contrato.")

    company = db.query(Company).filter(Company.id == resolved_company_id, Company.is_active == True).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    if resolved_center_id is not None:
        center = db.query(WorkCenter).filter(WorkCenter.id == resolved_center_id, WorkCenter.is_active == True).first()
        if not center:
            raise HTTPException(status_code=404, detail="Centro no encontrado")
        if center.company_id != resolved_company_id:
            raise HTTPException(status_code=400, detail="El centro no pertenece a la empresa indicada")

    return resolved_company_id, resolved_center_id


def _validate_contract_red_coherence(contract_data):
    contract_code = getattr(contract_data, "contract_code", None)
    working_day_type = getattr(contract_data, "working_day_type", None)

    if contract_code and contract_code.startswith("5") and working_day_type and working_day_type != "part_time":
        raise HTTPException(status_code=400, detail="Los contratos con código 5xx deben ser de jornada parcial")
    if contract_code and contract_code.startswith("4") and working_day_type and working_day_type != "full_time":
        raise HTTPException(status_code=400, detail="Los contratos con código 4xx deben ser de jornada completa")
    if contract_code == "300" and working_day_type and working_day_type != "fixed_discontinuous":
        raise HTTPException(status_code=400, detail="El contrato 300 debe ser fijo discontinuo")


def _validate_split_26_dates(contract_data):
    start_date = getattr(contract_data, "start_date", None)
    end_date = getattr(contract_data, "end_date", None)
    bonus_start = getattr(contract_data, "bonus_start_date", None)
    bonus_end = getattr(contract_data, "bonus_end_date", None)
    reduction_start = getattr(contract_data, "legal_workday_reduction_start", None)
    reduction_end = getattr(contract_data, "legal_workday_reduction_end", None)

    if end_date and start_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date no puede ser menor que start_date")
    if bonus_end and bonus_start and bonus_end < bonus_start:
        raise HTTPException(status_code=400, detail="La fecha fin de bonificación no puede ser anterior a la fecha inicio")
    if reduction_end and reduction_start and reduction_end < reduction_start:
        raise HTTPException(status_code=400, detail="La fecha fin de reducción no puede ser anterior a la fecha inicio")


def _complete_workday_fields(payload: dict):
    weekly_hours = payload.get("weekly_hours")
    full_time_weekly_hours = payload.get("full_time_weekly_hours") or 40
    annual_agreement_hours = payload.get("annual_agreement_hours")
    partiality_coefficient = payload.get("partiality_coefficient")
    working_day_type = payload.get("working_day_type")

    if working_day_type == "full_time" and partiality_coefficient in (None, ""):
        partiality_coefficient = 100
        payload["partiality_coefficient"] = 100
    if partiality_coefficient is None and weekly_hours and full_time_weekly_hours:
        partiality_coefficient = round((float(weekly_hours) / float(full_time_weekly_hours)) * 100, 2)
        payload["partiality_coefficient"] = partiality_coefficient
    if weekly_hours and payload.get("monthly_hours") is None:
        payload["monthly_hours"] = round(float(weekly_hours) * 52 / 12, 2)
    if weekly_hours and payload.get("annual_hours") is None:
        payload["annual_hours"] = round(float(weekly_hours) * 52, 2)
    if annual_agreement_hours and partiality_coefficient is not None and payload.get("annual_hours") is None:
        payload["annual_hours"] = round(float(annual_agreement_hours) * float(partiality_coefficient) / 100, 2)
    return payload


def _apply_agreement_salary_reference(db: Session, payload: dict):
    agreement_id = payload.get("collective_agreement_id")
    category_id = payload.get("professional_category_id")
    salary_row_id = payload.get("salary_table_row_id")

    if agreement_id is not None:
        agreement = db.query(CollectiveAgreement).filter(CollectiveAgreement.id == agreement_id, CollectiveAgreement.is_active == True).first()
        if not agreement:
            raise HTTPException(status_code=404, detail="Convenio no encontrado")
        payload["collective_agreement_code"] = agreement.agreement_code

    if category_id is not None:
        category = db.query(ProfessionalCategory).filter(ProfessionalCategory.id == category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Categoría profesional de convenio no encontrada")
        if agreement_id is not None and category.collective_agreement_id != agreement_id:
            raise HTTPException(status_code=400, detail="La categoría profesional no pertenece al convenio indicado")
        payload["professional_category"] = category.name

    if salary_row_id is not None:
        salary_row = db.query(SalaryTableRow).filter(SalaryTableRow.id == salary_row_id).first()
        if not salary_row:
            raise HTTPException(status_code=404, detail="Fila salarial de convenio no encontrada")
        salary_table = salary_row.salary_table
        if agreement_id is not None and salary_table.collective_agreement_id != agreement_id:
            raise HTTPException(status_code=400, detail="La fila salarial no pertenece al convenio indicado")
        if category_id is not None and salary_row.professional_category_id != category_id:
            raise HTTPException(status_code=400, detail="La fila salarial no corresponde a la categoría profesional indicada")
        if payload.get("salary_base") is None and salary_row.base_salary is not None:
            payload["salary_base"] = salary_row.base_salary
        if payload.get("professional_category") is None:
            payload["professional_category"] = salary_row.category_name
        if payload.get("collective_agreement_id") is None:
            payload["collective_agreement_id"] = salary_table.collective_agreement_id
            agreement = salary_table.collective_agreement
            payload["collective_agreement_code"] = agreement.agreement_code if agreement else payload.get("collective_agreement_code")
        if payload.get("professional_category_id") is None:
            payload["professional_category_id"] = salary_row.professional_category_id
    return payload


def _prepare_contract_payload(db: Session, payload: dict):
    payload = _complete_workday_fields(payload)
    payload = _apply_agreement_salary_reference(db, payload)
    return payload


def create_contract(db: Session, contract: ContractCreate):
    employee = db.query(Employee).filter(Employee.id == contract.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    company_id, center_id = _resolve_company_and_center(db, employee, contract.company_id, contract.center_id)
    _validate_contract_red_coherence(contract)
    _validate_split_26_dates(contract)

    status = contract.status or "active"
    if status == "active":
        active_contract = db.query(Contract).filter(Contract.employee_id == contract.employee_id, Contract.status == "active").first()
        if active_contract:
            raise HTTPException(status_code=400, detail="El empleado ya tiene un contrato activo")

    payload = {field: getattr(contract, field) for field in CONTRACT_CREATE_FIELDS}
    payload = _prepare_contract_payload(db, payload)

    db_contract = Contract(**payload, company_id=company_id, center_id=center_id, status=status)
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return get_contract(db, db_contract.id)


def get_contracts(db: Session):
    return db.query(Contract).options(joinedload(Contract.employee), joinedload(Contract.company), joinedload(Contract.work_center), joinedload(Contract.collective_agreement), joinedload(Contract.salary_table_row), joinedload(Contract.ss_registration)).all()


def get_contract(db: Session, contract_id: int):
    return db.query(Contract).options(joinedload(Contract.employee), joinedload(Contract.company), joinedload(Contract.work_center), joinedload(Contract.collective_agreement), joinedload(Contract.salary_table_row), joinedload(Contract.ss_registration)).filter(Contract.id == contract_id).first()


def get_contracts_by_employee(db: Session, employee_id: int):
    return db.query(Contract).options(joinedload(Contract.employee), joinedload(Contract.company), joinedload(Contract.work_center), joinedload(Contract.collective_agreement), joinedload(Contract.salary_table_row), joinedload(Contract.ss_registration)).filter(Contract.employee_id == employee_id).all()


def update_contract(db: Session, contract_id: int, contract_data: ContractUpdate):
    db_contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not db_contract:
        return None

    employee = db.query(Employee).filter(Employee.id == db_contract.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    company_id = contract_data.company_id if contract_data.company_id is not None else db_contract.company_id
    center_id = contract_data.center_id if contract_data.center_id is not None else db_contract.center_id
    _resolve_company_and_center(db, employee, company_id, center_id)

    update_data = contract_data.model_dump(exclude_unset=True)
    update_data.pop("employee_id", None)

    merged = {field: getattr(db_contract, field, None) for field in CONTRACT_CREATE_FIELDS if field != "employee_id"}
    merged.update(update_data)
    pseudo = type("ContractData", (), merged)()
    _validate_contract_red_coherence(pseudo)
    _validate_split_26_dates(pseudo)

    new_status = update_data.get("status", db_contract.status)
    if new_status == "active":
        active_contract = db.query(Contract).filter(Contract.employee_id == db_contract.employee_id, Contract.status == "active", Contract.id != contract_id).first()
        if active_contract:
            raise HTTPException(status_code=400, detail="El empleado ya tiene otro contrato activo")

    merged = _prepare_contract_payload(db, merged)
    for key, value in update_data.items():
        setattr(db_contract, key, value)
    for key, value in merged.items():
        if key in CONTRACT_CREATE_FIELDS and key != "employee_id":
            setattr(db_contract, key, value)

    db_contract.status = new_status
    db.commit()
    db.refresh(db_contract)
    return get_contract(db, db_contract.id)


def soft_delete_contract(db: Session, contract_id: int):
    db_contract = db.query(Contract).options(joinedload(Contract.employee), joinedload(Contract.company), joinedload(Contract.work_center), joinedload(Contract.collective_agreement), joinedload(Contract.salary_table_row)).filter(Contract.id == contract_id).first()
    if not db_contract:
        return None
    deleted_contract_response = contract_to_response(db_contract)
    db.delete(db_contract)
    db.commit()
    return deleted_contract_response
