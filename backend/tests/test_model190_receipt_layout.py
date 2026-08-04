from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from app.services.model190_receipt_service import _sheet
from app.services.model190_receipt_styles import MODEL190_RECEIPT_CSS


def test_receipt_css_contains_real_multiline_rules():
    assert "\\n" not in MODEL190_RECEIPT_CSS
    assert "@page" in MODEL190_RECEIPT_CSS
    assert "size: A4 portrait" in MODEL190_RECEIPT_CSS
    assert ".official-header" in MODEL190_RECEIPT_CSS
    assert ".summary-box" in MODEL190_RECEIPT_CSS
    assert ".bottom-grid" in MODEL190_RECEIPT_CSS
    assert "print-color-adjust: exact" in MODEL190_RECEIPT_CSS


def test_sheet_reproduces_recognisable_model190_summary_form():
    item = SimpleNamespace(
        year=2026,
        declaration_type="complementary",
        total_recipients=10,
        total_cash_income=Decimal("120000.00"),
        total_in_kind_income=Decimal("2200.00"),
        total_withholding=Decimal("27829.60"),
        presented_at=datetime(2026, 8, 4, 18, 30),
        receipt_number="190123456789012",
        csv="ABCDEF123456",
        presentation_reference="AULANOMINA-190-2026-1",
    )

    content = _sheet(
        item=item,
        presentation={
            "correct_records": 11,
            "records_read": 11,
            "file_sha256": "a" * 64,
        },
        signature={
            "signer_name": "Responsable Demo",
            "certificate_alias": "Certificado AulaNomina",
        },
        company_name="Sur Empleo Temporal Demo",
        company_nif="B14999004",
        contact_name="Responsable Demo",
        contact_phone="646599231",
        original_identifier="1900000000001",
        copy_label="Ejemplar para la Administración",
    )

    assert 'class="official-header"' in content
    assert "Retenciones e ingresos a cuenta del IRPF" in content
    assert "Resumen anual" in content
    assert "Declarante" in content
    assert "Persona y teléfono de contacto" in content
    assert "Modalidad de presentación" in content
    assert "Resumen de los datos incluidos en la declaración" in content
    assert 'class="field-code">01<' in content
    assert 'class="field-code">02<' in content
    assert 'class="field-code">03<' in content
    assert "122.200,00" in content
    assert "Declaración complementaria o sustitutiva" in content
    assert "Espacio reservado para la Administración" in content
    assert "JUSTIFICANTE SIN VALIDEZ FISCAL" in content
    assert "Hoja Resumen. Ejemplar para la Administración" in content
