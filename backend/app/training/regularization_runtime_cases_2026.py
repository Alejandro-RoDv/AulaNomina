"""Casos runtime del bloque B07 · Regularizaciones y retroactivos."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.agreement_seniority import AgreementSeniorityRule
from app.models.case_assignment import CaseAssignment
from app.models.case_study import CaseStudy, CaseTask
from app.models.collective_agreement import (
    CollectiveAgreement,
    ProfessionalCategory,
    ProfessionalGroup,
    SalaryTable,
    SalaryTableRow,
)
from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollItem
from app.models.student import Student
from app.models.work_center import WorkCenter
from app.schemas.case_study import CaseStudyCreate, CaseTaskCreate
from app.services.case_scenario_service import ensure_assignment_progress


COURSE_CODE = "AN-GL-2026"
COURSE_VERSION = "2026.1-phase-a"
DEMO_COMPANY_CIF = "G14999999"
DEMO_CENTER_CODE = "1.1"
REGULARIZATION_AGREEMENT_CODE = "SIM-RETRO-2026"
REGULARIZATION_EMPLOYEE_DNI = "20000006F"
REGULARIZATION_EMPLOYEE_NAME = "Elena Navarro Gil"
REGULARIZATION_CATEGORY_CODE = "RETROADM"
REGULARIZATION_SOURCE_TABLE_NAME = "Tabla salarial original 2026 · retroactivos"
REGULARIZATION_TARGET_TABLE_NAME = "Revisión salarial 2026 · efectos 01/01"
REGULARIZATION_SENIORITY_RULE_CODE = "TRIENIO_RETRO_2026"
BASELINE_SALARY = Decimal("1400.00")
CORRECTED_SALARY = Decimal("1430.00")
SALARY_CORRECTION_DELTA = Decimal("30.00")
REVISED_TABLE_SALARY = Decimal("1450.00")
TABLE_MONTHLY_DELTA = Decimal("50.00")
SENIORITY_MONTHLY_AMOUNT = Decimal("32.00")
SENIORITY_RETROACTIVE_TOTAL = Decimal("192.00")
SALARY_TABLE_ARREARS_TOTAL = Decimal("300.00")
RECOGNIZED_SENIORITY_DATE = date(2022, 9, 1)
REGULARIZATION_SCENARIO_CODES = {
    "TRAIN-2026-REG-A42",
    "TRAIN-2026-REG-A43",
    "TRAIN-2026-REG-A44",
    "TRAIN-2026-REG-A45",
}


def _task(
    *,
    title: str,
    description: str,
    module: str,
    expected_result: str,
    expected_action: str,
    task_order: int,
    training_code: str | None = None,
) -> CaseTaskCreate:
    condition = {
        "course_code": COURSE_CODE,
        "course_version": COURSE_VERSION,
        "validation_interaction": "explicit_review",
    }
    if training_code:
        condition["training_code"] = training_code
    return CaseTaskCreate(
        title=title,
        description=description,
        module=module,
        expected_result=expected_result,
        expected_action=expected_action,
        trigger_type="system",
        trigger_condition=condition,
        validation_rules=[],
        task_order=task_order,
        is_required=True,
        blocking=True,
        status="pending",
    )


def build_regularization_runtime_cases_2026() -> list[CaseStudyCreate]:
    return [
        CaseStudyCreate(
            scenario_code="TRAIN-2026-REG-A42",
            title="Corrección salarial con diferencia trazable",
            description="Práctica A42: corregir la causa permanente de un salario base erróneo y regularizar después una nómina ya calculada sin reabrir el original.",
            difficulty="intermediate",
            category="regularizations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A42"],
                "employee": REGULARIZATION_EMPLOYEE_NAME,
                "company_name": "Fundación AulaNomina",
                "effective_date": "2026-07-01",
                "payroll_period": "2026-07",
                "regularization_data": {
                    "concept": "Salario base",
                    "original_amount": float(BASELINE_SALARY),
                    "correct_amount": float(CORRECTED_SALARY),
                    "origin_period": "2026-06",
                    "target_period": "2026-07",
                    "expected_gross_delta": float(SALARY_CORRECTION_DELTA),
                    "reason": "CAMBIO_SALARIAL",
                },
            },
            completion_message="La causa salarial está corregida y la diferencia queda separada del cálculo original mediante una regularización trazable.",
            tasks=[
                _task(
                    title="Corregir la causa permanente",
                    description="Localiza el contrato de Elena y corrige el salario base de 1.400,00 € a 1.430,00 €. No modifiques la nómina histórica de junio.",
                    module="contracts",
                    expected_result="Contrato actualizado a 1.430,00 € y nómina de junio intacta",
                    expected_action="review_salary_correction_origin",
                    task_order=1,
                ),
                _task(
                    title="Aplicar la diferencia en una nómina abierta",
                    description="Sobre la nómina de julio aplica una regularización CAMBIO_SALARIAL de +30,00 €, vinculando como origen la nómina de junio y documentando el motivo.",
                    module="regularizations",
                    expected_result="Regularización de +30,00 € aplicada en julio y enlazada con junio",
                    expected_action="review_salary_correction_regularization",
                    task_order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-REG-A43",
            title="Antigüedad con efectos retroactivos",
            description="Práctica A43: reconocer una fecha de antigüedad omitida, comprobar el complemento resultante y liquidar las diferencias de meses ya pagados.",
            difficulty="intermediate",
            category="regularizations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A43"],
                "employee": REGULARIZATION_EMPLOYEE_NAME,
                "company_name": "Fundación AulaNomina",
                "effective_date": RECOGNIZED_SENIORITY_DATE.isoformat(),
                "payroll_period": "2026-08",
                "seniority_regularization_data": {
                    "recognized_seniority_date": RECOGNIZED_SENIORITY_DATE.isoformat(),
                    "monthly_amount": float(SENIORITY_MONTHLY_AMOUNT),
                    "affected_period_from": "2026-01",
                    "affected_period_to": "2026-06",
                    "affected_months": 6,
                    "expected_gross_delta": float(SENIORITY_RETROACTIVE_TOTAL),
                    "target_period": "2026-08",
                    "reason": "ANTIGUEDAD",
                },
            },
            completion_message="La antigüedad reconocida produce el complemento esperado y los seis meses anteriores quedan regularizados sin alterar sus nóminas originales.",
            tasks=[
                _task(
                    title="Reconocer la antigüedad y comprobar el complemento",
                    description="Informa como antigüedad reconocida el 01/09/2022 y revisa la vista previa: en junio de 2026 debe existir un módulo consolidado de 32,00 € mensuales.",
                    module="contracts",
                    expected_result="Fecha reconocida 01/09/2022 y complemento mensual de 32,00 €",
                    expected_action="review_seniority_retroactive_origin",
                    task_order=1,
                ),
                _task(
                    title="Liquidar el retroactivo de antigüedad",
                    description="Regulariza en agosto los seis meses enero-junio: 6 × 32,00 € = 192,00 €, con motivo ANTIGUEDAD y referencia a una nómina histórica del periodo afectado.",
                    module="regularizations",
                    expected_result="Retroactivo de antigüedad de 192,00 € aplicado y trazable",
                    expected_action="review_seniority_retroactive_regularization",
                    task_order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-REG-A44",
            title="Atrasos por revisión salarial de convenio",
            description="Práctica A44: comparar la tabla pagada con una revisión salarial publicada después, activar la nueva escala y generar atrasos solo desde su fecha de efectos.",
            difficulty="intermediate",
            category="regularizations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A44"],
                "employee": REGULARIZATION_EMPLOYEE_NAME,
                "company_name": "Fundación AulaNomina",
                "effective_date": "2026-01-01",
                "payroll_period": "2026-06",
                "salary_revision_data": {
                    "agreement_code": REGULARIZATION_AGREEMENT_CODE,
                    "source_table": REGULARIZATION_SOURCE_TABLE_NAME,
                    "target_table": REGULARIZATION_TARGET_TABLE_NAME,
                    "source_base_salary": float(BASELINE_SALARY),
                    "target_base_salary": float(REVISED_TABLE_SALARY),
                    "effective_from": "2026-01-01",
                    "period_from": "2026-01-01",
                    "period_to": "2026-06-30",
                    "monthly_difference": float(TABLE_MONTHLY_DELTA),
                    "expected_months": 6,
                    "expected_total": float(SALARY_TABLE_ARREARS_TOTAL),
                },
            },
            completion_message="La nueva tabla queda vigente y existe una complementaria de atrasos por 300,00 € limitada a enero-junio de 2026.",
            tasks=[
                _task(
                    title="Activar la revisión salarial",
                    description="En el convenio SIM-RETRO-2026 revisa la nueva tabla con salario base 1.450,00 € y efectos 01/01/2026. Actívala; la tabla original de 1.400,00 € debe quedar histórica.",
                    module="agreements",
                    expected_result="Tabla revisada activa y tabla original conservada como histórica",
                    expected_action="review_salary_table_revision",
                    task_order=1,
                ),
                _task(
                    title="Generar los atrasos del periodo afectado",
                    description="Compara la tabla original con la revisada desde 01/01/2026 hasta 30/06/2026 y genera la complementaria. La diferencia esperada es 6 × 50,00 € = 300,00 €.",
                    module="regularizations",
                    expected_result="Complementaria periodo 15 por 300,00 € con seis meses de origen",
                    expected_action="review_salary_table_arrears",
                    task_order=2,
                ),
            ],
        ),
        CaseStudyCreate(
            scenario_code="TRAIN-2026-REG-A45",
            title="Trazabilidad de una regularización",
            description="Práctica A45: reconstruir una regularización desde las nóminas originales hasta la complementaria y justificar cada diferencia con su evidencia.",
            difficulty="intermediate",
            category="regularizations",
            status="active",
            created_by="Profesor demo",
            initial_state={
                "training_sequence": ["A45"],
                "employee": REGULARIZATION_EMPLOYEE_NAME,
                "company_name": "Fundación AulaNomina",
                "effective_date": "2026-01-01",
                "payroll_period": "2026-15",
                "traceability_data": {
                    "original_period_from": "2026-01",
                    "original_period_to": "2026-06",
                    "original_monthly_base": float(BASELINE_SALARY),
                    "regularized_monthly_base": float(REVISED_TABLE_SALARY),
                    "expected_difference": float(SALARY_TABLE_ARREARS_TOTAL),
                    "complementary_period": 15,
                    "expected_source_months": [1, 2, 3, 4, 5, 6],
                },
            },
            completion_message="La trazabilidad demuestra qué importes eran originales, qué cambió, desde cuándo y cómo se forma la diferencia de 300,00 €.",
            tasks=[
                _task(
                    title="Reconstruir y justificar la diferencia",
                    description="Revisa las nóminas enero-junio y la complementaria del periodo 15. Comprueba que los originales siguen a 1.400,00 €, que cada mes aporta 50,00 € y que el total regularizado suma 300,00 €.",
                    module="regularizations",
                    expected_result="Origen, causa, seis líneas mensuales y diferencia total completamente trazables",
                    expected_action="review_regularization_trace",
                    task_order=1,
                    training_code="A45",
                )
            ],
        ),
    ]


def _task_values(task: CaseTaskCreate) -> dict[str, Any]:
    return task.model_dump()


def _reset_case_progress(case_study: CaseStudy) -> None:
    for assignment in case_study.assignments:
        assignment.progress_entries.clear()
        assignment.current_task_order = 1
        assignment.completion_percentage = 0
        assignment.started_at = None
        assignment.completed_at = None
        assignment.status = "assigned"


def seed_regularization_runtime_cases_2026(db: Session) -> None:
    for definition in build_regularization_runtime_cases_2026():
        case_study = db.query(CaseStudy).filter(CaseStudy.scenario_code == definition.scenario_code).first()
        if case_study is None:
            case_study = CaseStudy(**definition.model_dump(exclude={"tasks"}))
            db.add(case_study)
            db.flush()
            for task in definition.tasks:
                db.add(CaseTask(case_study_id=case_study.id, **_task_values(task)))
            db.commit()
            continue

        changed = False
        for field, value in definition.model_dump(exclude={"tasks"}).items():
            if getattr(case_study, field) != value:
                setattr(case_study, field, value)
                changed = True

        existing_by_order = {task.task_order: task for task in case_study.tasks}
        defined_orders = {task.task_order for task in definition.tasks}
        for task_definition in definition.tasks:
            values = _task_values(task_definition)
            existing = existing_by_order.get(task_definition.task_order)
            if existing is None:
                db.add(CaseTask(case_study_id=case_study.id, **values))
                changed = True
                continue
            for field, value in values.items():
                if getattr(existing, field) != value:
                    setattr(existing, field, value)
                    changed = True
        for stale in list(case_study.tasks):
            if stale.task_order not in defined_orders:
                db.delete(stale)
                changed = True
        if changed:
            _reset_case_progress(case_study)
        db.commit()


def _update(instance, **values):
    for field, value in values.items():
        setattr(instance, field, value)
    return instance


def _get_or_create_agreement(db: Session) -> CollectiveAgreement:
    agreement = db.query(CollectiveAgreement).filter(CollectiveAgreement.agreement_code == REGULARIZATION_AGREEMENT_CODE).first()
    values = {
        "name": "Convenio formativo de regularizaciones y retroactivos",
        "agreement_code": REGULARIZATION_AGREEMENT_CODE,
        "sector": "Servicios administrativos simulados",
        "territorial_scope": "Ámbito formativo",
        "functional_scope": "Convenio ficticio aislado para prácticas de corrección salarial y atrasos.",
        "personal_scope": "Persona trabajadora del itinerario B07.",
        "publication_date": date(2026, 1, 1),
        "effective_from": date(2026, 1, 1),
        "effective_to": date(2026, 12, 31),
        "status": "active",
        "notes": "Dataset formativo aislado. No representa un convenio real.",
        "is_active": True,
    }
    if agreement:
        return _update(agreement, **values)
    agreement = CollectiveAgreement(**values)
    db.add(agreement)
    db.flush()
    return agreement


def _get_or_create_group(db: Session, agreement: CollectiveAgreement) -> ProfessionalGroup:
    group = db.query(ProfessionalGroup).filter(
        ProfessionalGroup.collective_agreement_id == agreement.id,
        ProfessionalGroup.code == "RG1",
    ).first()
    values = {
        "collective_agreement_id": agreement.id,
        "code": "RG1",
        "name": "Grupo administrativo retroactivos",
        "description": "Grupo formativo del bloque B07.",
        "display_order": 1,
    }
    if group:
        return _update(group, **values)
    group = ProfessionalGroup(**values)
    db.add(group)
    db.flush()
    return group


def _get_or_create_category(db: Session, agreement: CollectiveAgreement, group: ProfessionalGroup) -> ProfessionalCategory:
    category = db.query(ProfessionalCategory).filter(
        ProfessionalCategory.collective_agreement_id == agreement.id,
        ProfessionalCategory.code == REGULARIZATION_CATEGORY_CODE,
    ).first()
    values = {
        "collective_agreement_id": agreement.id,
        "professional_group_id": group.id,
        "code": REGULARIZATION_CATEGORY_CODE,
        "name": "Administrativa de gestión",
        "subgroup": "Gestión laboral",
        "level": "Nivel II",
        "functional_description": "Categoría ficticia para practicar correcciones y atrasos.",
        "display_order": 1,
    }
    if category:
        return _update(category, **values)
    category = ProfessionalCategory(**values)
    db.add(category)
    db.flush()
    return category


def _get_or_create_table(db: Session, agreement: CollectiveAgreement, name: str, **values) -> SalaryTable:
    table = db.query(SalaryTable).filter(
        SalaryTable.collective_agreement_id == agreement.id,
        SalaryTable.name == name,
    ).first()
    fields = {"collective_agreement_id": agreement.id, "name": name, **values}
    if table:
        return _update(table, **fields)
    table = SalaryTable(**fields)
    db.add(table)
    db.flush()
    return table


def _get_or_create_row(
    db: Session,
    table: SalaryTable,
    category: ProfessionalCategory,
    group: ProfessionalGroup,
    *,
    base_salary: Decimal,
) -> SalaryTableRow:
    row = db.query(SalaryTableRow).filter(
        SalaryTableRow.salary_table_id == table.id,
        SalaryTableRow.professional_category_id == category.id,
    ).first()
    values = {
        "salary_table_id": table.id,
        "professional_category_id": category.id,
        "professional_group_id": group.id,
        "category_name": category.name,
        "group_name": group.name,
        "base_salary": base_salary,
        "seniority_amount": SENIORITY_MONTHLY_AMOUNT,
        "specific_complement": Decimal("0.00"),
        "agreement_plus": Decimal("0.00"),
        "total_amount": base_salary,
        "amount_unit": "monthly",
        "notes": "Fila salarial del caso B07.",
    }
    if row:
        return _update(row, **values)
    row = SalaryTableRow(**values)
    db.add(row)
    db.flush()
    return row


def _get_or_create_seniority_rule(db: Session, agreement: CollectiveAgreement) -> AgreementSeniorityRule:
    rule = db.query(AgreementSeniorityRule).filter(
        AgreementSeniorityRule.collective_agreement_id == agreement.id,
        AgreementSeniorityRule.code == REGULARIZATION_SENIORITY_RULE_CODE,
    ).first()
    values = {
        "collective_agreement_id": agreement.id,
        "salary_table_id": None,
        "professional_category_id": None,
        "code": REGULARIZATION_SENIORITY_RULE_CODE,
        "name": "Trienio formativo B07",
        "module_years": 3,
        "calculation_mode": "fixed_amount",
        "fixed_amount": SENIORITY_MONTHLY_AMOUNT,
        "percentage": None,
        "percentage_base": "salary_base",
        "max_modules": None,
        "applies_partiality": True,
        "daily_proration_on_maturity": False,
        "contributes": True,
        "taxable": True,
        "affects_extra_payments": True,
        "effective_from": date(2026, 1, 1),
        "effective_to": None,
        "is_active": True,
        "display_order": 10,
        "notes": "Regla determinista para A43: 32,00 € por cada trienio consolidado.",
    }
    if rule:
        return _update(rule, **values)
    rule = AgreementSeniorityRule(**values)
    db.add(rule)
    db.flush()
    return rule


def _get_or_create_employee(db: Session, company: Company, center: WorkCenter) -> Employee:
    employee = db.query(Employee).filter(Employee.dni == REGULARIZATION_EMPLOYEE_DNI).first()
    values = {
        "employee_code": "R.1",
        "company_id": company.id,
        "center_id": center.id,
        "dni": REGULARIZATION_EMPLOYEE_DNI,
        "naf": "142000000006",
        "first_name": "Elena",
        "last_name": "Navarro Gil",
        "birth_date": date(1990, 2, 16),
        "nationality": "Española",
        "email": "elena.navarro@aulanomina.demo",
        "address": "Calle Retroactivo, 7",
        "city": "Córdoba",
        "province": "Córdoba",
        "postal_code": "14007",
        "is_active": True,
        "status": "active",
    }
    if employee:
        return _update(employee, **values)
    employee = Employee(**values)
    db.add(employee)
    db.flush()
    return employee


def _get_or_create_contract(
    db: Session,
    employee: Employee,
    company: Company,
    center: WorkCenter,
    agreement: CollectiveAgreement,
    category: ProfessionalCategory,
    source_row: SalaryTableRow,
) -> Contract:
    contract = db.query(Contract).filter(
        Contract.employee_id == employee.id,
        Contract.start_date == date(2025, 1, 1),
    ).first()
    values = {
        "employee_id": employee.id,
        "company_id": company.id,
        "center_id": center.id,
        "contract_type": "Indefinido",
        "contract_family": "indefinite",
        "contract_code": "100",
        "start_date": date(2025, 1, 1),
        "end_date": None,
        "status": "active",
        "collective_agreement_code": REGULARIZATION_AGREEMENT_CODE,
        "collective_agreement_id": agreement.id,
        "professional_category": category.name,
        "professional_category_id": category.id,
        "salary_table_row_id": source_row.id,
        "working_day_type": "full_time",
        "weekly_hours": 40,
        "full_time_weekly_hours": 40,
        "partiality_coefficient": 100,
        "salary_base": BASELINE_SALARY,
        "gross_annual_salary": BASELINE_SALARY * Decimal("14"),
        "pay_schedule": "not_prorated_14",
        "seniority_date": None,
        "recognized_seniority_date": None,
        "seniority_criterion": None,
    }
    if contract:
        return _update(contract, **values)
    contract = Contract(**values)
    db.add(contract)
    db.flush()
    return contract


def _reset_training_payrolls(db: Session, employee: Employee, contract: Contract, company: Company, center: WorkCenter) -> None:
    existing = db.query(Payroll).filter(Payroll.employee_id == employee.id).all()
    payroll_ids = [item.id for item in existing]
    if payroll_ids:
        db.query(PayrollItem).filter(PayrollItem.payroll_id.in_(payroll_ids)).delete(synchronize_session=False)
        db.query(Payroll).filter(
            Payroll.employee_id == employee.id,
            Payroll.period_year == 2026,
            Payroll.period_month == 15,
        ).delete(synchronize_session=False)

    for month in range(1, 9):
        payroll = db.query(Payroll).filter(
            Payroll.employee_id == employee.id,
            Payroll.contract_id == contract.id,
            Payroll.period_year == 2026,
            Payroll.period_month == month,
        ).first()
        values = {
            "employee_id": employee.id,
            "contract_id": contract.id,
            "company_id": company.id,
            "center_id": center.id,
            "period_month": month,
            "period_year": 2026,
            "base_salary": BASELINE_SALARY,
            "worked_base_salary": BASELINE_SALARY,
            "temporary_disability_benefit": Decimal("0.00"),
            "company_disability_complement": Decimal("0.00"),
            "salary_supplements": Decimal("0.00"),
            "seniority_amount": Decimal("0.00"),
            "variable_incentives": Decimal("0.00"),
            "extra_pay_proration": Decimal("0.00"),
            "gross_salary": BASELINE_SALARY,
            "contribution_days": 30,
            "worked_days": 30,
            "incident_days": 0,
            "it_days": 0,
            "non_contribution_days": 0,
            "common_contingencies_base": BASELINE_SALARY,
            "professional_contingencies_base": BASELINE_SALARY,
            "unemployment_training_fogasa_base": BASELINE_SALARY,
            "irpf_base": BASELINE_SALARY,
            "daily_common_base": BASELINE_SALARY / Decimal("30"),
            "daily_professional_base": BASELINE_SALARY / Decimal("30"),
            "employee_common_contingencies": Decimal("0.00"),
            "employee_unemployment": Decimal("0.00"),
            "employee_training": Decimal("0.00"),
            "employee_mei": Decimal("0.00"),
            "employee_social_security": Decimal("0.00"),
            "irpf_mode": "manual",
            "irpf_percentage": Decimal("0.00"),
            "suggested_irpf_percentage": Decimal("0.00"),
            "irpf": Decimal("0.00"),
            "total_deductions": Decimal("0.00"),
            "net_salary": BASELINE_SALARY,
            "company_common_contingencies": Decimal("0.00"),
            "company_unemployment": Decimal("0.00"),
            "company_fogasa": Decimal("0.00"),
            "company_training": Decimal("0.00"),
            "company_at_ep": Decimal("0.00"),
            "company_mei": Decimal("0.00"),
            "company_total_social_security": Decimal("0.00"),
            "company_total_cost": BASELINE_SALARY,
            "calculation_version": 1,
            "calculation_engine_version": "training-b07-baseline",
            "status": "reviewed" if month <= 6 else "pending",
        }
        if payroll:
            _update(payroll, **values)
        else:
            db.add(Payroll(**values))
    db.flush()


def prepare_regularization_training_data_2026(db: Session) -> dict[str, Any] | None:
    """Restaura un dataset aislado para A42-A45 sin alterar los casos anteriores."""
    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()
    if company is None:
        return None
    center = db.query(WorkCenter).filter(
        WorkCenter.company_id == company.id,
        WorkCenter.center_code == DEMO_CENTER_CODE,
    ).first()
    if center is None:
        return None

    agreement = _get_or_create_agreement(db)
    group = _get_or_create_group(db, agreement)
    category = _get_or_create_category(db, agreement, group)
    source_table = _get_or_create_table(
        db,
        agreement,
        REGULARIZATION_SOURCE_TABLE_NAME,
        year=2026,
        effective_from=date(2026, 1, 1),
        effective_to=date(2026, 12, 31),
        number_of_payments=14,
        amount_type="monthly",
        status="active",
        notes="Tabla efectivamente aplicada a las nóminas enero-junio antes de conocerse la revisión.",
    )
    target_table = _get_or_create_table(
        db,
        agreement,
        REGULARIZATION_TARGET_TABLE_NAME,
        year=2026,
        effective_from=date(2026, 1, 1),
        effective_to=date(2026, 12, 31),
        number_of_payments=14,
        amount_type="monthly",
        status="draft",
        notes="Revisión publicada posteriormente con efectos económicos desde 01/01/2026.",
    )
    source_row = _get_or_create_row(db, source_table, category, group, base_salary=BASELINE_SALARY)
    _get_or_create_row(db, target_table, category, group, base_salary=REVISED_TABLE_SALARY)
    _get_or_create_seniority_rule(db, agreement)

    # El punto de partida pedagógico siempre es tabla original activa y revisión pendiente.
    target_table.status = "draft"
    source_table.status = "active"
    db.flush()

    employee = _get_or_create_employee(db, company, center)
    contract = _get_or_create_contract(db, employee, company, center, agreement, category, source_row)
    _reset_training_payrolls(db, employee, contract, company, center)
    db.commit()

    return {
        "agreement_id": agreement.id,
        "source_table_id": source_table.id,
        "target_table_id": target_table.id,
        "employee_id": employee.id,
        "contract_id": contract.id,
    }


def seed_regularization_runtime_assignments_2026(db: Session) -> None:
    student = db.query(Student).order_by(Student.id.asc()).first()
    if student is None:
        return
    cases = (
        db.query(CaseStudy)
        .filter(CaseStudy.scenario_code.in_(sorted(REGULARIZATION_SCENARIO_CODES)))
        .order_by(CaseStudy.id.asc())
        .all()
    )
    for case_study in cases:
        assignment = (
            db.query(CaseAssignment)
            .filter(CaseAssignment.case_study_id == case_study.id)
            .order_by(CaseAssignment.id.asc())
            .first()
        )
        if assignment is None:
            assignment = CaseAssignment(
                case_study_id=case_study.id,
                student_id=student.id,
                assigned_by="Profesor demo",
                status="assigned",
                notes="Práctica guiada del bloque de regularizaciones y retroactivos del Temario Maestro 2026.",
            )
            db.add(assignment)
            db.commit()
        ensure_assignment_progress(db, assignment.id)
