from decimal import Decimal

from app.schemas.payroll_salary_structure import PayrollConceptResponse


def concept_payload(**overrides):
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
    payload.update(overrides)
    return payload


def test_payroll_concept_response_accepts_regularization_source_type():
    concept = PayrollConceptResponse(**concept_payload())

    assert concept.source_type == "REGULARIZATION"
    assert concept.category == "REGULARIZACION"


def test_payroll_concept_response_accepts_incident_engine_values_from_seeded_database():
    for category in ["INCIDENCIA", "PRESTACION_IT", "COMPLEMENTO_IT", "HORAS_EXTRA", "VACACIONES", "PERMISO"]:
        concept = PayrollConceptResponse(**concept_payload(
            id=100,
            name=f"Concepto {category}",
            code=f"AUTO_{category}",
            category=category,
            source_type="INCIDENT",
            calculation_type="INCIDENT_ENGINE",
        ))

        assert concept.category == category
        assert concept.calculation_type == "INCIDENT_ENGINE"
        assert concept.source_type == "INCIDENT"
