from decimal import Decimal

from app.services.payroll_receipt_print import build_payroll_receipt_print_html, payroll_receipt_filename


def sample_receipt():
    return {
        "payroll_id": 12,
        "payroll_code": "NOM-2026-05-00012",
        "status": "calculated",
        "company": {
            "name": "Fundación AulaNomina",
            "tax_id": "G14999999",
            "contribution_account": "14000000001",
            "address": "Avenida Demo, 10",
            "city": "Córdoba",
            "province": "Córdoba",
        },
        "work_center": {
            "name": "Colegio San Rafael",
            "code": "1.1",
            "contribution_account": "14000000011",
            "city": "Córdoba",
        },
        "employee": {
            "name": "Javier Romero Sánchez",
            "code": "1.2",
            "tax_id": "10000002B",
            "social_security_number": "141000000002",
        },
        "contract": {
            "code": "100",
            "professional_category": "Administrativo",
            "contribution_group": "5",
            "seniority_date": "2025-01-01",
        },
        "period": {
            "label": "Mayo 2026",
            "period_start": "2026-05-01",
            "period_end": "2026-05-31",
            "period_days": 31,
            "contribution_days": 30,
            "worked_days": 22,
            "incident_days": 8,
        },
        "totals": {
            "total_earnings": Decimal("1450.00"),
            "total_deductions": Decimal("238.97"),
            "net_salary": Decimal("1211.03"),
            "company_total_cost": Decimal("1915.02"),
        },
        "bases": {
            "common_contingencies": Decimal("1450.00"),
            "professional_contingencies": Decimal("1450.00"),
            "unemployment_training_fogasa": Decimal("1450.00"),
            "irpf": Decimal("1450.00"),
        },
        "earnings": [
            {
                "code": "SALARIO_BASE",
                "name": "Salario base",
                "description": "Salario ordinario",
                "source_type": "contract",
                "salary_nature": "SALARIAL",
                "quantity": Decimal("22"),
                "unit_price": Decimal("48.3332"),
                "amount": Decimal("1063.33"),
            },
            {
                "code": "PRESTACION_IT",
                "name": "Prestación IT",
                "description": "Pago delegado",
                "source_type": "incident",
                "salary_nature": "EXTRASALARIAL",
                "quantity": Decimal("8"),
                "unit_price": Decimal("29"),
                "amount": Decimal("232.00"),
            },
        ],
        "deductions": [
            {"code": "IRPF", "name": "IRPF", "description": "Retención", "source_type": "system", "amount": Decimal("145.00")},
        ],
        "legal_footer": "Recibo de salarios simulado generado por AulaNomina.",
    }


def test_payroll_receipt_filename_is_safe_and_stable():
    assert payroll_receipt_filename(sample_receipt()) == "recibo-nom-2026-05-00012.html"
    assert payroll_receipt_filename({"payroll_code": "NOM 2026/05 <x>"}) == "recibo-nom-2026-05-x.html"


def test_build_payroll_receipt_print_html_contains_spanish_payslip_sections():
    html = build_payroll_receipt_print_html(sample_receipt())

    assert "<!doctype html>" in html
    assert "Imprimir / Guardar como PDF" in html
    assert "RECIBO INDIVIDUAL DE SALARIOS" in html
    assert "EMPRESA" in html
    assert "TRABAJADOR/A" in html
    assert "Fundación AulaNomina" in html
    assert "Javier Romero Sánchez" in html
    assert "DEVENGOS" in html
    assert "TOTAL DEVENGADO" in html
    assert "DEDUCCIONES" in html
    assert "TOTAL A DEDUCIR" in html
    assert "LÍQUIDO A PERCIBIR" in html
    assert "DETERMINACIÓN BASES COTIZACIÓN A LA SEGURIDAD SOCIAL" in html
    assert "Base sujeta a retención del IRPF" in html
    assert "1.211,03 €" in html
    assert "@page" in html


def test_build_payroll_receipt_print_html_escapes_user_content():
    receipt = sample_receipt()
    receipt["employee"]["name"] = "<script>alert('x')</script>"

    html = build_payroll_receipt_print_html(receipt)

    assert "<script>alert" not in html
    assert "&lt;script&gt;alert" in html
