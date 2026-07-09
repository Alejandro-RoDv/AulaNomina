from decimal import Decimal

from app.schemas.payroll_salary_structure import PayrollConceptResponse


def test_payroll_concept_response_accepts_regularization_source_type():
    payload = {
        "id": 1,
        "name": "Regularización de devengos",
        "code": "REGULARIZACION_DEVENGO",
        "category": "REGULARIZACION",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "source_type": "REGULARIZATION",
        "agreement_id": None,
        "calculation_type": "FIXED_AMOUNT",
        "default_amount": Decimal("0.00"),
        "default_unit_price": Decimal("0.00"),
        "applies_workday_percentage": False,
        "is_system": True,
        "is_taxable": True,
        "is_contribution_base": True,
        "affects_gross": True,
        "affects_net": True,
        "formula": "Importe bruto regularizado por diferencia detectada.",
        "is_active": True,
        "display_order": 9100,
        "notes": None,
        "created_at": "2026-05-01T10:00:00",
        "updated_at": None,
    }

    concept = PayrollConceptResponse(**payload)

    assert concept.source_type == "REGULARIZATION"
    assert concept.category == "REGULARIZACION"
