from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.contract import Contract
from app.models.employee import Employee
from app.models.model111 import (
    Model111Declaration,
    Professional,
    ProfessionalInvoice,
    TaxWithholdingAdjustment,
)
from app.models.model190 import (
    Model190Declaration,
    Model190RecipientOverride,
)
from app.models.payroll import Payroll
from app.schemas.model111 import Model111GenerateRequest, Model111PresentationRequest
from app.services.model111_service import (
    generate_model111_declaration,
    present_model111_declaration,
)
from app.services.model190_calculator import (
    Model190DomainError,
    build_model190_preview,
    money,
)
from app.services.model190_reconciliation import build_model190_reconciliation
from app.services.model190_validation import build_model190_validations


DEMO_YEAR = 2026
DEMO_COMPANY_NIF = "B19000026"
DEMO_COMPANY_NAME = "AulaNomina Demo Modelo 190 SL"
DEMO_EMPLOYEE_CODES = {
    "ana": "M190-DEMO-ANA",
    "luis": "M190-DEMO-LUIS",
    "carla": "M190-DEMO-CARLA",
}
DEMO_PROFESSIONAL_NIF = "B19000017"
DEMO_LATE_ADJUSTMENT_NOTE = "DEMO190-LATE-2T-DIFFERENCE"
DEMO_ARREARS_NOTE = "DEMO190-ARREARS-2025"
DEMO_REGULARIZATION_NOTE = "DEMO190-NEGATIVE-REGULARIZATION"
DEMO_OVERRIDE_NOTE = "DEMO190-CLASSIFICATION-ERROR"


def _company_response(company: Company) -> dict:
    return {
        "id": company.id,
        "name": company.name,
        "cif": company.cif,
        "is_active": getattr(company, "is_active", True),
    }


def _resolve_company(db: Session, company_id: int | None) -> tuple[Company, bool]:
    if company_id is not None:
        company = db.query(Company).filter(Company.id == company_id).first()
        if company is None:
            raise Model190DomainError(
                "COMPANY_NOT_FOUND",
                "Empresa no encontrada.",
                status_code=404,
            )
        return company, False

    company = db.query(Company).filter(Company.cif == DEMO_COMPANY_NIF).first()
    if company is not None:
        return company, False

    company = Company(
        name=DEMO_COMPANY_NAME,
        cif=DEMO_COMPANY_NIF,
        address="Avenida de la Formación, 190",
        city="Córdoba",
        province="14",
    )
    db.add(company)
    db.flush()
    return company, True


def _get_or_create_employee(
    db: Session,
    company: Company,
    *,
    code: str,
    dni: str,
    first_name: str,
    last_name: str,
    second_last_name: str | None = None,
) -> tuple[Employee, bool]:
    employee = (
        db.query(Employee)
        .filter(
            Employee.company_id == company.id,
            Employee.employee_code == code,
        )
        .first()
    )
    created = employee is None
    if employee is None:
        employee = Employee(
            employee_code=code,
            company_id=company.id,
            dni=dni,
            first_name=first_name,
            last_name=last_name,
            second_last_name=second_last_name,
            province="14",
        )
        db.add(employee)
        db.flush()
    else:
        employee.dni = dni
        employee.first_name = first_name
        employee.last_name = last_name
        employee.second_last_name = second_last_name
        employee.province = "14"
    return employee, created


def _get_or_create_contract(
    db: Session,
    company: Company,
    employee: Employee,
    *,
    contract_type: str,
    start_date: date,
) -> tuple[Contract, bool]:
    contract = (
        db.query(Contract)
        .filter(
            Contract.company_id == company.id,
            Contract.employee_id == employee.id,
            Contract.contract_type == contract_type,
            Contract.start_date == start_date,
        )
        .first()
    )
    created = contract is None
    if contract is None:
        contract = Contract(
            employee_id=employee.id,
            company_id=company.id,
            contract_type=contract_type,
            start_date=start_date,
            status="active",
        )
        db.add(contract)
        db.flush()
    else:
        contract.status = "active"
    return contract, created


def _upsert_payroll(
    db: Session,
    company: Company,
    employee: Employee,
    contract: Contract,
    *,
    month: int,
    gross: Decimal,
    withholding: Decimal,
    social_security: Decimal,
) -> bool:
    payroll = (
        db.query(Payroll)
        .filter(
            Payroll.company_id == company.id,
            Payroll.employee_id == employee.id,
            Payroll.contract_id == contract.id,
            Payroll.period_year == DEMO_YEAR,
            Payroll.period_month == month,
            Payroll.status != "cancelled",
        )
        .order_by(Payroll.id)
        .first()
    )
    created = payroll is None
    values = {
        "gross_salary": money(gross),
        "irpf_base": money(gross),
        "irpf": money(withholding),
        "employee_social_security": money(social_security),
        "status": "reviewed",
    }
    if payroll is None:
        payroll = Payroll(
            employee_id=employee.id,
            contract_id=contract.id,
            company_id=company.id,
            period_month=month,
            period_year=DEMO_YEAR,
            **values,
        )
        db.add(payroll)
    else:
        for field, value in values.items():
            setattr(payroll, field, value)
    return created


def _seed_employees_and_payrolls(db: Session, company: Company) -> dict:
    ana, ana_created = _get_or_create_employee(
        db,
        company,
        code=DEMO_EMPLOYEE_CODES["ana"],
        dni="30000001A",
        first_name="Ana",
        last_name="Martín",
        second_last_name="Demo",
    )
    luis, luis_created = _get_or_create_employee(
        db,
        company,
        code=DEMO_EMPLOYEE_CODES["luis"],
        dni="30000002B",
        first_name="Luis",
        last_name="Serrano",
        second_last_name="Demo",
    )
    carla, carla_created = _get_or_create_employee(
        db,
        company,
        code=DEMO_EMPLOYEE_CODES["carla"],
        dni="30000003C",
        first_name="Carla",
        last_name="Ramos",
        second_last_name="Demo",
    )

    ana_first, contract_1_created = _get_or_create_contract(
        db,
        company,
        ana,
        contract_type="100-DEMO190-PRIMER-CONTRATO",
        start_date=date(2025, 9, 1),
    )
    ana_second, contract_2_created = _get_or_create_contract(
        db,
        company,
        ana,
        contract_type="189-DEMO190-SEGUNDO-CONTRATO",
        start_date=date(2026, 7, 1),
    )
    luis_contract, contract_3_created = _get_or_create_contract(
        db,
        company,
        luis,
        contract_type="100-DEMO190",
        start_date=date(2025, 1, 1),
    )
    carla_contract, contract_4_created = _get_or_create_contract(
        db,
        company,
        carla,
        contract_type="200-DEMO190",
        start_date=date(2026, 4, 1),
    )

    payrolls_created = 0
    for month in range(1, 13):
        ana_contract = ana_first if month <= 6 else ana_second
        payrolls_created += int(
            _upsert_payroll(
                db,
                company,
                ana,
                ana_contract,
                month=month,
                gross=Decimal("2000.00") if month <= 6 else Decimal("2100.00"),
                withholding=Decimal("240.00") if month <= 6 else Decimal("252.00"),
                social_security=Decimal("130.00") if month <= 6 else Decimal("137.00"),
            )
        )
        payrolls_created += int(
            _upsert_payroll(
                db,
                company,
                luis,
                luis_contract,
                month=month,
                gross=Decimal("1800.00"),
                withholding=Decimal("180.00"),
                social_security=Decimal("120.00"),
            )
        )
        if month >= 4:
            payrolls_created += int(
                _upsert_payroll(
                    db,
                    company,
                    carla,
                    carla_contract,
                    month=month,
                    gross=Decimal("1600.00"),
                    withholding=Decimal("128.00"),
                    social_security=Decimal("105.00"),
                )
            )

    return {
        "employees": {"ana": ana, "luis": luis, "carla": carla},
        "employees_created": sum((ana_created, luis_created, carla_created)),
        "contracts_created": sum(
            (
                contract_1_created,
                contract_2_created,
                contract_3_created,
                contract_4_created,
            )
        ),
        "payrolls_created": payrolls_created,
    }


def _seed_professional(db: Session, company: Company) -> tuple[Professional, dict]:
    professional = (
        db.query(Professional)
        .filter(
            Professional.company_id == company.id,
            Professional.nif == DEMO_PROFESSIONAL_NIF,
        )
        .first()
    )
    professional_created = professional is None
    if professional is None:
        professional = Professional(
            company_id=company.id,
            nif=DEMO_PROFESSIONAL_NIF,
            name="Marta",
            surname="Consultoría Demo 190",
            activity_type="professional",
            withholding_rate=Decimal("15.00"),
            address="Calle Fiscal, 17",
            province_code="14",
            active=True,
        )
        db.add(professional)
        db.flush()
    else:
        professional.name = "Marta"
        professional.surname = "Consultoría Demo 190"
        professional.activity_type = "professional"
        professional.withholding_rate = Decimal("15.00")
        professional.province_code = "14"
        professional.active = True

    invoice_payloads = (
        (
            "M190-DEMO-PRO-2T",
            date(2026, 5, 10),
            date(2026, 5, 20),
            Decimal("1600.00"),
            Decimal("15.00"),
        ),
        (
            "M190-DEMO-PRO-4T",
            date(2026, 11, 10),
            date(2026, 11, 18),
            Decimal("900.00"),
            Decimal("7.00"),
        ),
    )
    invoices_created = 0
    for number, invoice_date, payment_date, base, rate in invoice_payloads:
        invoice = (
            db.query(ProfessionalInvoice)
            .filter(
                ProfessionalInvoice.company_id == company.id,
                ProfessionalInvoice.invoice_number == number,
            )
            .first()
        )
        withholding = money(base * rate / Decimal("100"))
        values = {
            "professional_id": professional.id,
            "company_id": company.id,
            "invoice_number": number,
            "invoice_date": invoice_date,
            "payment_date": payment_date,
            "tax_base": money(base),
            "withholding_rate": money(rate),
            "withholding_amount": withholding,
            "total_amount": money(base - withholding),
            "status": "paid",
            "notes": "Factura del caso demo integral del Modelo 190",
        }
        if invoice is None:
            db.add(ProfessionalInvoice(**values))
            invoices_created += 1
        else:
            for field, value in values.items():
                setattr(invoice, field, value)

    return professional, {
        "professional_created": professional_created,
        "invoices_created": invoices_created,
    }


def _upsert_adjustment(
    db: Session,
    company: Company,
    *,
    note: str,
    category: str,
    adjustment_type: str,
    source_date: date,
    recipient_nif: str,
    recipient_name: str,
    base_amount: Decimal,
    withholding_amount: Decimal,
    accrual_year: int,
    model190_key: str,
    model190_subkey: str | None = None,
    deductible_expense_amount: Decimal = Decimal("0.00"),
) -> tuple[TaxWithholdingAdjustment, bool]:
    item = (
        db.query(TaxWithholdingAdjustment)
        .filter(
            TaxWithholdingAdjustment.company_id == company.id,
            TaxWithholdingAdjustment.notes == note,
        )
        .first()
    )
    created = item is None
    values = {
        "category": category,
        "adjustment_type": adjustment_type,
        "source_date": source_date,
        "recipient_nif": recipient_nif,
        "recipient_name": recipient_name,
        "base_amount": money(base_amount),
        "withholding_amount": money(withholding_amount),
        "model190_key": model190_key,
        "model190_subkey": model190_subkey,
        "accrual_year": accrual_year,
        "deductible_expense_amount": money(deductible_expense_amount),
        "status": "confirmed",
        "notes": note,
    }
    if item is None:
        item = TaxWithholdingAdjustment(company_id=company.id, **values)
        db.add(item)
        db.flush()
    else:
        for field, value in values.items():
            setattr(item, field, value)
    return item, created


def _seed_core_adjustments(db: Session, company: Company) -> dict:
    arrears, arrears_created = _upsert_adjustment(
        db,
        company,
        note=DEMO_ARREARS_NOTE,
        category="work",
        adjustment_type="arrears",
        source_date=date(2026, 9, 15),
        recipient_nif="30000001A",
        recipient_name="Ana Martín Demo",
        base_amount=Decimal("500.00"),
        withholding_amount=Decimal("75.00"),
        accrual_year=2025,
        model190_key="A",
        deductible_expense_amount=Decimal("20.00"),
    )
    regularization, regularization_created = _upsert_adjustment(
        db,
        company,
        note=DEMO_REGULARIZATION_NOTE,
        category="work",
        adjustment_type="regularization",
        source_date=date(2026, 12, 20),
        recipient_nif="30000002B",
        recipient_name="Luis Serrano Demo",
        base_amount=Decimal("-200.00"),
        withholding_amount=Decimal("-20.00"),
        accrual_year=2026,
        model190_key="A",
    )
    return {
        "arrears": arrears,
        "regularization": regularization,
        "adjustments_created": int(arrears_created) + int(regularization_created),
    }


def _latest_presented_model111(
    db: Session,
    company_id: int,
    period: str,
) -> Model111Declaration | None:
    return (
        db.query(Model111Declaration)
        .filter(
            Model111Declaration.company_id == company_id,
            Model111Declaration.year == DEMO_YEAR,
            Model111Declaration.period == period,
            Model111Declaration.status == "presented",
        )
        .order_by(Model111Declaration.presented_at.desc(), Model111Declaration.id.desc())
        .first()
    )


def _ensure_presented_model111(
    db: Session,
    company: Company,
    period: str,
) -> Model111Declaration:
    existing = _latest_presented_model111(db, company.id, period)
    if existing is not None:
        return existing

    generated = generate_model111_declaration(
        db,
        Model111GenerateRequest(
            company_id=company.id,
            year=DEMO_YEAR,
            period=period,
            declaration_type="ordinary",
        ),
    )
    present_model111_declaration(
        db,
        generated["id"],
        Model111PresentationRequest(payment_method="simulated_nrc"),
    )
    return (
        db.query(Model111Declaration)
        .filter(Model111Declaration.id == generated["id"])
        .one()
    )


def _ensure_quarterly_model111(db: Session, company: Company) -> dict[str, int]:
    declarations = {}
    for period in ("1T", "2T", "3T", "4T"):
        declarations[period] = _ensure_presented_model111(db, company, period).id
    return declarations


def _seed_deliberate_difference(
    db: Session,
    company: Company,
) -> tuple[TaxWithholdingAdjustment, bool]:
    return _upsert_adjustment(
        db,
        company,
        note=DEMO_LATE_ADJUSTMENT_NOTE,
        category="work",
        adjustment_type="manual",
        source_date=date(2026, 6, 28),
        recipient_nif="30000003C",
        recipient_name="Carla Ramos Demo",
        base_amount=Decimal("300.00"),
        withholding_amount=Decimal("45.00"),
        accrual_year=2026,
        model190_key="A",
    )


def _seed_deliberate_override(
    db: Session,
    company: Company,
    professional: Professional,
) -> tuple[Model190RecipientOverride, bool]:
    override = (
        db.query(Model190RecipientOverride)
        .filter(
            Model190RecipientOverride.company_id == company.id,
            Model190RecipientOverride.year == DEMO_YEAR,
            Model190RecipientOverride.recipient_type == "professional",
            Model190RecipientOverride.recipient_id == professional.id,
        )
        .first()
    )
    created = override is None
    if override is None:
        override = Model190RecipientOverride(
            company_id=company.id,
            year=DEMO_YEAR,
            recipient_type="professional",
            recipient_id=professional.id,
            key="G",
            subkey="99",
            accrual_year=DEMO_YEAR,
            province_code="14",
            notes=DEMO_OVERRIDE_NOTE,
            confirmed=True,
        )
        db.add(override)
    return override, created


def _scenario_markers(db: Session, company_id: int) -> dict:
    employees = (
        db.query(Employee)
        .filter(
            Employee.company_id == company_id,
            Employee.employee_code.in_(tuple(DEMO_EMPLOYEE_CODES.values())),
        )
        .all()
    )
    professional = (
        db.query(Professional)
        .filter(
            Professional.company_id == company_id,
            Professional.nif == DEMO_PROFESSIONAL_NIF,
        )
        .first()
    )
    adjustments = {
        item.notes: item
        for item in db.query(TaxWithholdingAdjustment)
        .filter(
            TaxWithholdingAdjustment.company_id == company_id,
            TaxWithholdingAdjustment.notes.in_(
                (
                    DEMO_ARREARS_NOTE,
                    DEMO_REGULARIZATION_NOTE,
                    DEMO_LATE_ADJUSTMENT_NOTE,
                )
            ),
        )
        .all()
    }
    override = None
    if professional is not None:
        override = (
            db.query(Model190RecipientOverride)
            .filter(
                Model190RecipientOverride.company_id == company_id,
                Model190RecipientOverride.year == DEMO_YEAR,
                Model190RecipientOverride.recipient_type == "professional",
                Model190RecipientOverride.recipient_id == professional.id,
            )
            .first()
        )
    ana = next(
        (
            employee
            for employee in employees
            if employee.employee_code == DEMO_EMPLOYEE_CODES["ana"]
        ),
        None,
    )
    ana_contracts = (
        db.query(Contract).filter(Contract.employee_id == ana.id).count()
        if ana is not None
        else 0
    )
    presented_111 = {
        period: _latest_presented_model111(db, company_id, period)
        for period in ("1T", "2T", "3T", "4T")
    }
    latest_190 = (
        db.query(Model190Declaration)
        .filter(
            Model190Declaration.company_id == company_id,
            Model190Declaration.year == DEMO_YEAR,
            Model190Declaration.status != "cancelled",
        )
        .order_by(Model190Declaration.id.desc())
        .first()
    )
    return {
        "employees": employees,
        "professional": professional,
        "adjustments": adjustments,
        "override": override,
        "ana_contracts": ana_contracts,
        "presented_111": presented_111,
        "latest_190": latest_190,
    }


def _status_payload(db: Session, company: Company) -> dict:
    markers = _scenario_markers(db, company.id)
    prepared = (
        len(markers["employees"]) == 3
        and markers["professional"] is not None
        and DEMO_ARREARS_NOTE in markers["adjustments"]
        and DEMO_REGULARIZATION_NOTE in markers["adjustments"]
        and DEMO_LATE_ADJUSTMENT_NOTE in markers["adjustments"]
    )
    base = {
        "ok": True,
        "company_id": company.id,
        "company": _company_response(company),
        "year": DEMO_YEAR,
        "prepared": prepared,
        "stage": "not_prepared",
        "next_action": "Prepara el caso demo integral.",
        "checks": [],
        "validation": None,
        "reconciliation": None,
        "declaration": None,
    }
    if not prepared:
        return base

    preview = build_model190_preview(db, company.id, DEMO_YEAR)
    reconciliation = build_model190_reconciliation(db, company.id, DEMO_YEAR)
    validations = build_model190_validations(db, preview, reconciliation)
    latest_190 = markers["latest_190"]

    if latest_190 is not None and latest_190.status == "presented":
        stage = "presented"
        next_action = "Revisa el justificante, los documentos y los certificados."
    elif latest_190 is not None:
        stage = "generated"
        next_action = "Importa, firma y presenta el fichero en la AEAT simulada."
    elif not validations["is_valid"] or not reconciliation["annual"]["is_balanced"]:
        stage = "needs_correction"
        next_action = (
            "Corrige la subclave profesional y presenta la complementaria del 2T."
        )
    else:
        stage = "ready_to_generate"
        next_action = "Genera y congela la declaración ordinaria del Modelo 190."

    checks = [
        {
            "id": "workers",
            "label": "Tres trabajadores con nóminas anuales",
            "completed": len(markers["employees"]) == 3,
        },
        {
            "id": "multiple_contracts",
            "label": "Trabajador con dos contratos",
            "completed": markers["ana_contracts"] >= 2,
        },
        {
            "id": "professional",
            "label": "Profesional con facturas al 15 % y al 7 %",
            "completed": markers["professional"] is not None,
        },
        {
            "id": "arrears",
            "label": "Atrasos de un ejercicio anterior",
            "completed": DEMO_ARREARS_NOTE in markers["adjustments"],
        },
        {
            "id": "regularization",
            "label": "Regularización negativa",
            "completed": DEMO_REGULARIZATION_NOTE in markers["adjustments"],
        },
        {
            "id": "quarterly_111",
            "label": "Cuatro Modelos 111 presentados",
            "completed": all(markers["presented_111"].values()),
        },
        {
            "id": "classification_control",
            "label": "Clasificación fiscal deliberadamente errónea y corregible",
            "completed": markers["override"] is not None,
            "state": (
                "pending"
                if markers["override"] is not None
                and markers["override"].subkey == "99"
                else "corrected"
            ),
        },
        {
            "id": "reconciliation",
            "label": "Conciliación anual 111/190",
            "completed": bool(reconciliation["annual"]["is_balanced"]),
        },
    ]

    return {
        **base,
        "stage": stage,
        "next_action": next_action,
        "checks": checks,
        "preview": {
            "recipients": preview["totals"]["total_recipients"],
            "unique_nifs": preview["totals"]["unique_nifs"],
            "cash_income": preview["totals"]["total_cash_income"],
            "withholding": preview["totals"]["total_withholding"],
            "source_count": preview["source_count"],
        },
        "validation": {
            "is_valid": validations["is_valid"],
            "counts": validations["counts"],
            "codes": [item["code"] for item in validations["items"]],
        },
        "reconciliation": {
            "is_balanced": reconciliation["annual"]["is_balanced"],
            "alerts": reconciliation.get("alert_summary") or {},
            "quarter_status": {
                item["quarter"]: item["is_balanced"]
                for item in reconciliation.get("quarters") or []
            },
        },
        "declaration": (
            {
                "id": latest_190.id,
                "status": latest_190.status,
                "receipt_number": latest_190.receipt_number,
            }
            if latest_190 is not None
            else None
        ),
        "demo_ids": {
            "professional_id": markers["professional"].id,
            "override_id": markers["override"].id if markers["override"] else None,
            "late_adjustment_id": markers["adjustments"][
                DEMO_LATE_ADJUSTMENT_NOTE
            ].id,
            "model111": {
                period: item.id if item is not None else None
                for period, item in markers["presented_111"].items()
            },
        },
    }


def get_model190_demo_status(db: Session, company_id: int) -> dict:
    company, _ = _resolve_company(db, company_id)
    return _status_payload(db, company)


def seed_model190_demo(db: Session, company_id: int | None = None) -> dict:
    company, company_created = _resolve_company(db, company_id)
    markers = _scenario_markers(db, company.id)
    if (
        len(markers["employees"]) == 3
        and markers["professional"] is not None
        and DEMO_LATE_ADJUSTMENT_NOTE in markers["adjustments"]
    ):
        return {
            **_status_payload(db, company),
            "message": "El caso demo integral ya estaba preparado.",
            "created": {"company": False},
        }

    if markers["latest_190"] is not None:
        raise Model190DomainError(
            "MODEL190_DEMO_DECLARATION_CONFLICT",
            "La empresa ya contiene una declaración del Modelo 190 para 2026.",
            status_code=409,
        )

    employee_result = _seed_employees_and_payrolls(db, company)
    professional, professional_result = _seed_professional(db, company)
    adjustment_result = _seed_core_adjustments(db, company)
    db.commit()

    model111_ids = _ensure_quarterly_model111(db, company)
    late_adjustment, late_created = _seed_deliberate_difference(db, company)
    override, override_created = _seed_deliberate_override(
        db,
        company,
        professional,
    )
    db.commit()

    return {
        **_status_payload(db, company),
        "message": (
            "Caso demo cargado con un error de clasificación y una diferencia "
            "deliberada en el 2T."
        ),
        "created": {
            "company": company_created,
            "employees": employee_result["employees_created"],
            "contracts": employee_result["contracts_created"],
            "payrolls": employee_result["payrolls_created"],
            "professional": professional_result["professional_created"],
            "invoices": professional_result["invoices_created"],
            "adjustments": adjustment_result["adjustments_created"]
            + int(late_created),
            "override": override_created,
        },
        "model111_ids": model111_ids,
        "late_adjustment_id": late_adjustment.id,
        "override_id": override.id,
    }


def correct_model190_demo(db: Session, company_id: int) -> dict:
    company, _ = _resolve_company(db, company_id)
    markers = _scenario_markers(db, company.id)
    if markers["professional"] is None or DEMO_LATE_ADJUSTMENT_NOTE not in markers["adjustments"]:
        raise Model190DomainError(
            "MODEL190_DEMO_NOT_PREPARED",
            "Primero debes preparar el caso demo integral.",
            status_code=409,
        )
    if markers["latest_190"] is not None:
        return {
            **_status_payload(db, company),
            "message": "La declaración ya está generada; no se modifica el snapshot.",
        }

    override = markers["override"]
    if override is None:
        override = Model190RecipientOverride(
            company_id=company.id,
            year=DEMO_YEAR,
            recipient_type="professional",
            recipient_id=markers["professional"].id,
        )
        db.add(override)
    override.key = None
    override.subkey = None
    override.accrual_year = None
    override.province_code = None
    override.confirmed = True
    override.notes = "DEMO190-CLASSIFICATION-CORRECTED"
    db.commit()

    original = (
        db.query(Model111Declaration)
        .filter(
            Model111Declaration.company_id == company.id,
            Model111Declaration.year == DEMO_YEAR,
            Model111Declaration.period == "2T",
            Model111Declaration.declaration_type == "ordinary",
            Model111Declaration.status == "presented",
        )
        .order_by(Model111Declaration.id)
        .first()
    )
    if original is None:
        raise Model190DomainError(
            "MODEL190_DEMO_MODEL111_ORIGINAL_MISSING",
            "No se encuentra la declaración ordinaria presentada del 2T.",
            status_code=409,
        )

    complementary = (
        db.query(Model111Declaration)
        .filter(
            Model111Declaration.company_id == company.id,
            Model111Declaration.year == DEMO_YEAR,
            Model111Declaration.period == "2T",
            Model111Declaration.declaration_type == "complementary",
            Model111Declaration.original_declaration_id == original.id,
            Model111Declaration.status == "presented",
        )
        .order_by(Model111Declaration.id.desc())
        .first()
    )
    if complementary is None:
        generated = generate_model111_declaration(
            db,
            Model111GenerateRequest(
                company_id=company.id,
                year=DEMO_YEAR,
                period="2T",
                declaration_type="complementary",
                original_declaration_id=original.id,
            ),
        )
        presented = present_model111_declaration(
            db,
            generated["id"],
            Model111PresentationRequest(payment_method="simulated_nrc"),
        )
        complementary_id = presented["id"]
    else:
        complementary_id = complementary.id

    result = _status_payload(db, company)
    if not result["validation"]["is_valid"] or not result["reconciliation"]["is_balanced"]:
        raise Model190DomainError(
            "MODEL190_DEMO_CORRECTION_INCOMPLETE",
            "La corrección no ha dejado el caso preparado para generar.",
            status_code=422,
            context={"status": result},
        )
    return {
        **result,
        "message": (
            "Clasificación corregida y complementaria del 2T presentada. "
            "El caso está listo para generar el Modelo 190."
        ),
        "complementary_declaration_id": complementary_id,
    }
