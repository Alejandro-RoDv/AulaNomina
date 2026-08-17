"""Validación pedagógica bajo demanda para IRPF y fiscalidad laboral."""

from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any
import unicodedata

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.document import Document
from app.models.employee import Employee
from app.models.model111 import Model111Declaration, Professional, ProfessionalInvoice
from app.models.model190 import Model190Declaration
from app.models.tax_profile import TaxProfile
from app.schemas.case_scenario import CaseTaskProgressUpdate
from app.services.case_scenario_service import (
    CaseScenarioError,
    ensure_assignment_progress,
    update_assignment_step,
)
from app.services.irpf_calculator import calculate_irpf_2026
from app.services.model111_service import build_model111_preview
from app.services.model190_calculator import build_model190_preview
from app.services.model190_reconciliation import build_model190_reconciliation
from app.training.fiscal_runtime_cases_2026 import (
    DEMO_COMPANY_CIF,
    FISCAL_INVOICE_NUMBER,
    FISCAL_PROFESSIONAL_NIF,
    MODEL145_DOCUMENT_TYPE,
)


FISCAL_SCENARIO_CODES = {
    "TRAIN-2026-TAX-A36": "A36",
    "TRAIN-2026-TAX-A37": "A37",
    "TRAIN-2026-TAX-A38": "A38",
    "TRAIN-2026-TAX-A39": "A39",
    "TRAIN-2026-TAX-A40": "A40",
    "TRAIN-2026-TAX-A41": "A41",
}
MONEY_TOLERANCE = Decimal("0.05")
RATE_TOLERANCE = Decimal("0.01")


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(character for character in text if not unicodedata.combining(character)).casefold().strip()


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _close(left: Any, right: Any, tolerance: Decimal = MONEY_TOLERANCE) -> bool:
    return abs(_money(left) - _money(right)) <= tolerance


def _json_load(value: Any, fallback: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _check(passed: bool, message: str, evidence: dict[str, Any], *, rule_type: str) -> dict[str, Any]:
    return {
        "rule_type": rule_type,
        "supported": True,
        "passed": bool(passed),
        "message": message,
        "evidence": evidence,
    }


def _activity_code(assignment) -> str | None:
    scenario = str(assignment.case_study.scenario_code or "").strip().upper()
    return FISCAL_SCENARIO_CODES.get(scenario)


def _employee_name(employee: Employee) -> str:
    return " ".join(part for part in [employee.first_name, employee.last_name, employee.second_last_name] if part)


def _find_employee(db: Session, name: str | None) -> Employee | None:
    expected = _normalize(name)
    if not expected:
        return None
    return next(
        (employee for employee in db.query(Employee).all() if _normalize(_employee_name(employee)) == expected),
        None,
    )


def _demo_company(db: Session) -> Company | None:
    return db.query(Company).filter(Company.cif == DEMO_COMPANY_CIF).first()


def _tax_profile_payload(profile: TaxProfile) -> dict[str, Any]:
    return {
        "birth_year": profile.birth_year,
        "autonomous_community": profile.autonomous_community,
        "family_situation": profile.family_situation,
        "spouse_nif": profile.spouse_nif,
        "employment_situation": profile.employment_situation,
        "contract_category": profile.contract_category,
        "children_count": profile.children_count,
        "descendants": profile.descendants or [],
        "ascendants_in_care": profile.ascendants_in_care,
        "ascendants": profile.ascendants or [],
        "employee_disability": profile.employee_disability,
        "disability_degree": profile.disability_degree,
        "reduced_mobility": profile.reduced_mobility,
        "descendants_disability": profile.descendants_disability,
        "geographic_mobility": profile.geographic_mobility,
        "ceuta_melilla_residence": profile.ceuta_melilla_residence,
        "ceuta_melilla_income": profile.ceuta_melilla_income,
        "home_loan": profile.home_loan,
        "compensatory_pension": profile.compensatory_pension,
        "child_support_annuity": profile.child_support_annuity,
        "irregular_income_18_2": profile.irregular_income_18_2,
        "irregular_income_18_3": profile.irregular_income_18_3,
        "social_security_contributions": profile.social_security_contributions,
        "contract_type": profile.contract_type,
        "contract_start_date": profile.contract_start_date,
        "expected_annual_salary": profile.expected_annual_salary,
        "manual_regularization": profile.manual_regularization,
        "voluntary_irpf": profile.voluntary_irpf,
        "notes": profile.notes,
    }


def _review_a36(db: Session, assignment, task_order: int) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    employee = _find_employee(db, state.get("employee"))
    if task_order == 1:
        expected = state.get("model145_data") or {}
        document = (
            db.query(Document)
            .filter(
                Document.employee_id == employee.id,
                Document.document_type == expected.get("document_type", MODEL145_DOCUMENT_TYPE),
            )
            .first()
            if employee
            else None
        )
        status_ok = bool(document and document.status == expected.get("required_status"))
        issue_ok = bool(document and str(document.issue_date or "") == str(expected.get("issue_date") or ""))
        passed = status_ok and issue_ok
        return _check(
            passed,
            (
                "El Modelo 145 consta recibido con la fecha indicada y queda como evidencia del perfil fiscal."
                if passed
                else "Actualiza el Modelo 145 a recibido y comprueba la fecha de recepción indicada en el caso."
            ),
            {
                "document_id": document.id if document else None,
                "status": document.status if document else None,
                "issue_date": str(document.issue_date) if document and document.issue_date else None,
                "status_ok": status_ok,
                "issue_ok": issue_ok,
            },
            rule_type="training_a36_model145_document",
        )

    expected = state.get("tax_profile_data") or {}
    profile = db.query(TaxProfile).filter(TaxProfile.employee_id == employee.id).first() if employee else None
    comparisons: dict[str, bool] = {}
    actual: dict[str, Any] = {}
    for field, expected_value in expected.items():
        actual_value = getattr(profile, field, None) if profile else None
        if hasattr(actual_value, "isoformat"):
            actual_value = actual_value.isoformat()
        comparisons[field] = (
            _close(actual_value, expected_value, Decimal("0.01"))
            if isinstance(expected_value, float)
            else str(actual_value) == str(expected_value)
        )
        actual[field] = actual_value
    document = (
        db.query(Document)
        .filter(Document.employee_id == employee.id, Document.document_type == MODEL145_DOCUMENT_TYPE)
        .first()
        if employee
        else None
    )
    document_ok = bool(document and document.status == "received")
    passed = bool(profile and comparisons and all(comparisons.values()) and document_ok)
    return _check(
        passed,
        (
            "El perfil fiscal coincide con los datos comunicados en el Modelo 145 y está listo para calcular la retención."
            if passed
            else "Revisa el perfil fiscal: algún dato no coincide con el Modelo 145 o el documento aún no consta recibido."
        ),
        {
            "employee_id": employee.id if employee else None,
            "tax_profile_id": profile.id if profile else None,
            "field_matches": comparisons,
            "expected": expected,
            "actual": actual,
            "model145_document_id": document.id if document else None,
            "document_ok": document_ok,
        },
        rule_type="training_a36_tax_profile",
    )


def _expected_irpf(profile: TaxProfile | None) -> dict[str, Any] | None:
    if profile is None:
        return None
    return calculate_irpf_2026(_tax_profile_payload(profile))


def _review_a37(db: Session, assignment) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    employee = _find_employee(db, state.get("employee"))
    profile = db.query(TaxProfile).filter(TaxProfile.employee_id == employee.id).first() if employee else None
    calculation = _expected_irpf(profile)
    expected_rate = Decimal(str(calculation.get("suggested_irpf") or 0)) if calculation else None
    applied_rate = Decimal(str(profile.voluntary_irpf)) if profile and profile.voluntary_irpf is not None else None
    rate_ok = bool(
        expected_rate is not None
        and applied_rate is not None
        and abs(expected_rate - applied_rate) <= RATE_TOLERANCE
    )
    passed = bool(profile and calculation and rate_ok)
    return _check(
        passed,
        (
            "El porcentaje aplicado coincide con el resultado reproducible del motor IRPF 2026."
            if passed
            else "Recalcula el IRPF con el perfil guardado y aplica exactamente el tipo sugerido."
        ),
        {
            "employee_id": employee.id if employee else None,
            "tax_profile_id": profile.id if profile else None,
            "expected_rate": float(expected_rate) if expected_rate is not None else None,
            "applied_rate": float(applied_rate) if applied_rate is not None else None,
            "annual_withholding": calculation.get("annual_withholding") if calculation else None,
            "calculation_base": calculation.get("base") if calculation else None,
            "rate_ok": rate_ok,
        },
        rule_type="training_a37_irpf_calculation",
    )


def _review_a38(db: Session, assignment, task_order: int) -> dict[str, Any]:
    state = assignment.case_study.initial_state or {}
    expected = state.get("irpf_regularization_data") or {}
    employee = _find_employee(db, state.get("employee"))
    profile = db.query(TaxProfile).filter(TaxProfile.employee_id == employee.id).first() if employee else None
    children_ok = bool(profile and int(profile.children_count or 0) == int(expected.get("children_count") or 0))
    if task_order == 1:
        return _check(
            children_ok,
            (
                "La nueva circunstancia familiar está registrada sin alterar otros datos del perfil."
                if children_ok
                else "Registra el descendiente comunicado antes de recalcular el tipo."
            ),
            {
                "employee_id": employee.id if employee else None,
                "tax_profile_id": profile.id if profile else None,
                "children_count": profile.children_count if profile else None,
                "expected_children_count": expected.get("children_count"),
                "children_ok": children_ok,
            },
            rule_type="training_a38_profile_change",
        )

    calculation = _expected_irpf(profile)
    expected_rate = Decimal(str(calculation.get("suggested_irpf") or 0)) if calculation else None
    applied_rate = Decimal(str(profile.voluntary_irpf)) if profile and profile.voluntary_irpf is not None else None
    rate_ok = bool(
        expected_rate is not None
        and applied_rate is not None
        and abs(expected_rate - applied_rate) <= RATE_TOLERANCE
    )
    regularization_ok = bool(profile and profile.manual_regularization is True)
    passed = children_ok and rate_ok and regularization_ok
    return _check(
        passed,
        (
            "La circunstancia está actualizada y el nuevo tipo calculado queda aplicado como regularización para periodos posteriores."
            if passed
            else "Recalcula con la nueva circunstancia, aplica el tipo sugerido y deja activada la regularización."
        ),
        {
            "employee_id": employee.id if employee else None,
            "tax_profile_id": profile.id if profile else None,
            "reason": expected.get("reason"),
            "effective_date": expected.get("effective_date"),
            "children_ok": children_ok,
            "manual_regularization": profile.manual_regularization if profile else None,
            "expected_rate": float(expected_rate) if expected_rate is not None else None,
            "applied_rate": float(applied_rate) if applied_rate is not None else None,
            "rate_ok": rate_ok,
            "regularization_ok": regularization_ok,
        },
        rule_type="training_a38_irpf_regularization",
    )


def _professional(db: Session) -> Professional | None:
    company = _demo_company(db)
    if company is None:
        return None
    return (
        db.query(Professional)
        .filter(Professional.company_id == company.id, Professional.nif == FISCAL_PROFESSIONAL_NIF)
        .first()
    )


def _professional_invoice(db: Session, professional: Professional | None) -> ProfessionalInvoice | None:
    if professional is None:
        return None
    return (
        db.query(ProfessionalInvoice)
        .filter(
            ProfessionalInvoice.professional_id == professional.id,
            ProfessionalInvoice.invoice_number == FISCAL_INVOICE_NUMBER,
        )
        .first()
    )


def _review_a39(db: Session, assignment, task_order: int) -> dict[str, Any]:
    expected = (assignment.case_study.initial_state or {}).get("professional_data") or {}
    professional = _professional(db)
    identity_ok = bool(
        professional
        and professional.active
        and professional.nif == expected.get("nif")
        and _normalize(professional.full_name) == _normalize(f"{expected.get('name')} {expected.get('surname')}")
    )
    rate_ok = bool(professional and _close(professional.withholding_rate, expected.get("withholding_rate"), Decimal("0.01")))
    activity_ok = bool(professional and professional.activity_type == expected.get("activity_type"))
    if task_order == 1:
        passed = identity_ok and rate_ok and activity_ok and bool(professional and professional.province_code == expected.get("province_code"))
        return _check(
            passed,
            (
                "El profesional está identificado como perceptor económico independiente de la plantilla y con su retención configurada."
                if passed
                else "Revisa NIF, nombre, actividad, provincia y porcentaje de retención del profesional."
            ),
            {
                "professional_id": professional.id if professional else None,
                "nif": professional.nif if professional else None,
                "full_name": professional.full_name if professional else None,
                "activity_type": professional.activity_type if professional else None,
                "withholding_rate": float(professional.withholding_rate) if professional else None,
                "province_code": professional.province_code if professional else None,
                "identity_ok": identity_ok,
                "rate_ok": rate_ok,
                "activity_ok": activity_ok,
            },
            rule_type="training_a39_professional",
        )

    invoice = _professional_invoice(db, professional)
    base_ok = bool(invoice and _close(invoice.tax_base, expected.get("tax_base")))
    withholding_ok = bool(invoice and _close(invoice.withholding_amount, expected.get("withholding_amount")))
    total_ok = bool(invoice and _close(invoice.total_amount, expected.get("total_amount")))
    date_ok = bool(
        invoice
        and str(invoice.invoice_date) == str(expected.get("invoice_date"))
        and str(invoice.payment_date or "") == str(expected.get("payment_date"))
    )
    status_ok = bool(invoice and invoice.status == expected.get("status"))
    passed = identity_ok and invoice is not None and base_ok and withholding_ok and total_ok and date_ok and status_ok
    return _check(
        passed,
        (
            "La factura pagada contiene base, retención y fechas correctas y queda disponible para 111/190."
            if passed
            else "Revisa la factura profesional: base, retención, total, fechas o estado no coinciden con el caso."
        ),
        {
            "professional_id": professional.id if professional else None,
            "invoice_id": invoice.id if invoice else None,
            "invoice_number": invoice.invoice_number if invoice else None,
            "tax_base": float(invoice.tax_base) if invoice else None,
            "withholding_amount": float(invoice.withholding_amount) if invoice else None,
            "total_amount": float(invoice.total_amount) if invoice else None,
            "invoice_date": str(invoice.invoice_date) if invoice else None,
            "payment_date": str(invoice.payment_date) if invoice and invoice.payment_date else None,
            "status": invoice.status if invoice else None,
            "base_ok": base_ok,
            "withholding_ok": withholding_ok,
            "total_ok": total_ok,
            "date_ok": date_ok,
            "status_ok": status_ok,
        },
        rule_type="training_a39_professional_invoice",
    )


def _model111_declaration(db: Session, company_id: int, year: int, period: str) -> Model111Declaration | None:
    return (
        db.query(Model111Declaration)
        .filter(
            Model111Declaration.company_id == company_id,
            Model111Declaration.year == year,
            Model111Declaration.period == period,
            Model111Declaration.declaration_type == "ordinary",
            Model111Declaration.status != "cancelled",
        )
        .order_by(Model111Declaration.id.desc())
        .first()
    )


def _review_a40(db: Session, assignment, task_order: int) -> dict[str, Any]:
    expected = (assignment.case_study.initial_state or {}).get("model111_data") or {}
    company = _demo_company(db)
    year = int(expected.get("year") or 0)
    period = str(expected.get("period") or "")
    if task_order == 1:
        preview = build_model111_preview(db, company.id, year, period) if company else None
        validations = preview.get("validations") if preview else {}
        professional_lines = [
            line
            for line in (preview.get("lines") or [])
            if line.get("category") == "economic_activity"
            and line.get("recipient_nif") == expected.get("professional_nif")
        ] if preview else []
        passed = bool(preview and validations.get("is_valid") and professional_lines)
        return _check(
            passed,
            (
                "Las fuentes del 2T son declarables, están conciliadas y contienen la factura profesional esperada."
                if passed
                else "Revisa las nóminas del trimestre y la factura profesional hasta eliminar los errores bloqueantes de la vista previa."
            ),
            {
                "year": year,
                "period": period,
                "is_valid": validations.get("is_valid") if validations else False,
                "errors": validations.get("errors") if validations else [],
                "warnings": validations.get("warnings") if validations else [],
                "source_count": len(preview.get("lines") or []) if preview else 0,
                "professional_line_count": len(professional_lines),
                "total_withholding": float(preview.get("total_withholding") or 0) if preview else None,
            },
            rule_type="training_a40_sources",
        )

    declaration = _model111_declaration(db, company.id, year, period) if company else None
    if task_order == 2:
        lines = list(declaration.lines or []) if declaration else []
        work_base = sum((_money(line.base_amount) for line in lines if line.category == "work"), Decimal("0.00"))
        work_withholding = sum((_money(line.withholding_amount) for line in lines if line.category == "work"), Decimal("0.00"))
        professional_base = sum((_money(line.base_amount) for line in lines if line.category == "economic_activity"), Decimal("0.00"))
        professional_withholding = sum((_money(line.withholding_amount) for line in lines if line.category == "economic_activity"), Decimal("0.00"))
        totals_ok = bool(
            declaration
            and _close(declaration.work_base, work_base)
            and _close(declaration.work_withholding, work_withholding)
            and _close(declaration.professional_base, professional_base)
            and _close(declaration.professional_withholding, professional_withholding)
            and _close(declaration.total_withholding, work_withholding + professional_withholding)
        )
        professional_present = any(line.recipient_nif == expected.get("professional_nif") for line in lines)
        generated = bool(declaration and declaration.status in {"generated", "presented"})
        passed = generated and totals_ok and professional_present
        return _check(
            passed,
            (
                "El Modelo 111 está generado y sus cajas cuadran con las líneas de trabajo y actividades económicas."
                if passed
                else "Genera el Modelo 111 y revisa que bases y retenciones coincidan con el detalle de perceptores."
            ),
            {
                "declaration_id": declaration.id if declaration else None,
                "status": declaration.status if declaration else None,
                "line_count": len(lines),
                "work_base": float(work_base),
                "professional_base": float(professional_base),
                "work_withholding": float(work_withholding),
                "professional_withholding": float(professional_withholding),
                "total_withholding": float(declaration.total_withholding) if declaration else None,
                "professional_present": professional_present,
                "totals_ok": totals_ok,
            },
            rule_type="training_a40_generated",
        )

    presented = bool(
        declaration
        and declaration.status == "presented"
        and declaration.locked
        and declaration.presented_at
        and declaration.receipt_number
        and declaration.csv
    )
    return _check(
        presented,
        (
            "La declaración consta presentada y bloqueada con justificante y CSV de la simulación AEAT."
            if presented
            else "Completa la presentación simulada del Modelo 111 y comprueba justificante, CSV y bloqueo."
        ),
        {
            "declaration_id": declaration.id if declaration else None,
            "status": declaration.status if declaration else None,
            "locked": declaration.locked if declaration else None,
            "presented_at": declaration.presented_at.isoformat() if declaration and declaration.presented_at else None,
            "receipt_number": declaration.receipt_number if declaration else None,
            "csv": declaration.csv if declaration else None,
            "payment_method": declaration.payment_method if declaration else None,
        },
        rule_type="training_a40_presented",
    )


def _model190_declaration(db: Session, company_id: int, year: int) -> Model190Declaration | None:
    return (
        db.query(Model190Declaration)
        .filter(
            Model190Declaration.company_id == company_id,
            Model190Declaration.year == year,
            Model190Declaration.declaration_type == "ordinary",
            Model190Declaration.status != "cancelled",
        )
        .order_by(Model190Declaration.id.desc())
        .first()
    )


def _review_a41(db: Session, assignment, task_order: int) -> dict[str, Any]:
    expected = (assignment.case_study.initial_state or {}).get("model190_data") or {}
    company = _demo_company(db)
    year = int(expected.get("year") or 0)
    declaration = _model190_declaration(db, company.id, year) if company else None
    if task_order == 1:
        validations = _json_load(declaration.validation_result if declaration else None, {})
        professional_present = bool(
            declaration
            and any(recipient.nif == expected.get("professional_nif") for recipient in declaration.recipients)
        )
        generated = bool(
            declaration
            and declaration.status in {"generated", "validated", "presented"}
            and declaration.locked
            and declaration.generated_at
        )
        passed = generated and bool(validations.get("is_valid")) and professional_present and int(declaration.total_recipients or 0) > 0
        return _check(
            passed,
            (
                "El Modelo 190 está generado y congelado con perceptores válidos, incluido el profesional del caso."
                if passed
                else "Genera el Modelo 190 tras revisar perceptores, claves y errores bloqueantes."
            ),
            {
                "declaration_id": declaration.id if declaration else None,
                "status": declaration.status if declaration else None,
                "locked": declaration.locked if declaration else None,
                "total_recipients": declaration.total_recipients if declaration else 0,
                "total_cash_income": float(declaration.total_cash_income) if declaration else None,
                "total_withholding": float(declaration.total_withholding) if declaration else None,
                "validations": validations,
                "professional_present": professional_present,
            },
            rule_type="training_a41_generated",
        )

    reconciliation = build_model190_reconciliation(db, company.id, year) if company else None
    preview = build_model190_preview(db, company.id, year) if company else None
    reference_period = str(expected.get("reference_model111_period") or "")
    quarter = next(
        (item for item in (reconciliation.get("quarters") or []) if item.get("quarter") == reference_period),
        None,
    ) if reconciliation else None
    reference_declaration = quarter.get("declaration") if quarter else None
    quarter_balanced = bool(quarter and quarter.get("is_balanced") and reference_declaration)
    annual_totals_ok = bool(
        declaration
        and preview
        and int(declaration.total_recipients or 0) == int((preview.get("totals") or {}).get("total_recipients") or 0)
        and _close(declaration.total_cash_income, (preview.get("totals") or {}).get("total_cash_income"))
        and _close(declaration.total_withholding, (preview.get("totals") or {}).get("total_withholding"))
    )
    passed = bool(declaration and quarter_balanced and annual_totals_ok)
    return _check(
        passed,
        (
            "Los acumulados anuales son coherentes y el 2T presentado queda conciliado con las operaciones del Modelo 190."
            if passed
            else "Revisa la conciliación anual: el 2T debe cuadrar y los totales congelados deben coincidir con los perceptores actuales."
        ),
        {
            "declaration_id": declaration.id if declaration else None,
            "reference_period": reference_period,
            "reference_model111_declaration_id": reference_declaration.get("id") if reference_declaration else None,
            "quarter_balanced": quarter_balanced,
            "annual_totals_ok": annual_totals_ok,
            "annual": reconciliation.get("annual") if reconciliation else None,
            "alerts": reconciliation.get("alerts") if reconciliation else [],
        },
        rule_type="training_a41_reconciliation",
    )


def handles_training_fiscal_review(assignment, task) -> bool:
    return _activity_code(assignment) in {"A36", "A37", "A38", "A39", "A40", "A41"}


def validate_training_fiscal_review(
    db: Session,
    assignment_id: int,
    task_id: int,
) -> dict[str, Any]:
    assignment = ensure_assignment_progress(db, assignment_id)
    task = next((item for item in assignment.case_study.tasks if item.id == task_id), None)
    if not task:
        raise CaseScenarioError("Paso del caso no encontrado", code="TASK_NOT_IN_ASSIGNMENT", status_code=404)
    code = _activity_code(assignment)
    if not code:
        raise CaseScenarioError("El paso no pertenece al bloque formativo fiscal", code="UNSUPPORTED_TRAINING_REVIEW", status_code=400)

    progress = next((entry for entry in assignment.progress_entries if entry.task_id == task.id), None)
    if not progress:
        raise CaseScenarioError("Progreso de paso no encontrado", code="PROGRESS_NOT_FOUND", status_code=404)

    order = int(task.task_order or 1)
    if code == "A36":
        check = _review_a36(db, assignment, order)
    elif code == "A37":
        check = _review_a37(db, assignment)
    elif code == "A38":
        check = _review_a38(db, assignment, order)
    elif code == "A39":
        check = _review_a39(db, assignment, order)
    elif code == "A40":
        check = _review_a40(db, assignment, order)
    else:
        check = _review_a41(db, assignment, order)

    previous = dict(progress.validation_result or {})
    validation_result = {
        **previous,
        "mode": "explicit_review",
        "validated_at": datetime.utcnow().isoformat(),
        "passed": bool(check["passed"]),
        "manual_required": False,
        "checks": [check],
    }
    scenario = update_assignment_step(
        db,
        assignment_id,
        task.id,
        CaseTaskProgressUpdate(
            status="completed" if check["passed"] else "in_progress",
            student_notes=progress.student_notes,
            validation_result=validation_result,
        ),
    )
    return {
        "passed": bool(check["passed"]),
        "manual_required": False,
        "message": (
            "Comprobación superada. El resultado fiscal es coherente con la evidencia del ERP."
            if check["passed"]
            else "La comprobación no se ha superado. Revisa los datos fiscales y la evidencia generada antes de continuar."
        ),
        "checks": [check],
        "scenario": scenario,
    }
