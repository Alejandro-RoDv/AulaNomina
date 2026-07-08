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
        "period": {
            "label": "Mayo 2026",
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
        "earnings": [
            {"code": "SALARIO_BASE", "name": "Salario base", "description": "Salario ordinario", "source_type": "contract", "amount": Decimal("1063.33")},
            {"code": "PRESTACION_IT", "name": "Prestación IT", "description": "Pago delegado", "source_type": "incident", "amount": Decimal("232.00")},
        ],
        "deductions": [
            {"code": "IRPF", "name": "IRPF", "description": "Retención", "source_type": "system", "amount": Decimal("145.00")},
        ],
        "base_lines": [
            {"code": "BASE_CC", "name": "Base CC", "description": "Base común", "source_type": "system", "amount": Decimal("1450.00")},
        ],
        "company_cost_lines": [
            {"code": "COSTE_EMPRESA_TOTAL", "name": "Coste total", "description": "Coste", "source_type": "system", "amount": Decimal("1915.02")},
        ],
        "base_explanations": [
            {
                "code": "BASE_CC",
                "title": "Base de contingencias comunes",
                "amount": Decimal("1450.00"),
                "formula": "Devengos cotizables comunes del periodo.",
                "affected_by_incident": True,
                "explanation": "Se mantiene cotización durante la IT.",
                "learning_points": ["La IT puede mantener base de cotización."],
            }
        ],
        "incident_explanations": [
            {
                "title": "Incapacidad temporal",
                "net_effect": Decimal("386.67"),
                "explanation": "Se incorpora prestación y complemento.",
                "learning_points": ["Diferencia salario y prestación."],
            }
        ],
        "line_explanations": [
            {
                "code": "PRESTACION_IT",
                "name": "Prestación IT",
                "amount": Decimal("232.00"),
                "section": "Devengo",
                "source_type": "incident",
                "affects_gross": True,
                "affects_net": True,
                "contribution_base": True,
                "taxable": True,
                "explanation": "Aparece por una incidencia procesada.",
                "learning_points": ["Aparece por una incidencia."],
            }
        ],
        "legal_footer": "Recibo de salarios simulado generado por AulaNomina.",
    }


def test_payroll_receipt_filename_is_safe_and_stable():
    assert payroll_receipt_filename(sample_receipt()) == "recibo-nom-2026-05-00012.html"
    assert payroll_receipt_filename({"payroll_code": "NOM 2026/05 <x>"}) == "recibo-nom-2026-05-x.html"


def test_build_payroll_receipt_print_html_contains_printable_sections():
    html = build_payroll_receipt_print_html(sample_receipt())

    assert "<!doctype html>" in html
    assert "Imprimir / Guardar como PDF" in html
    assert "RECIBO INDIVIDUAL DE SALARIOS SIMULADO" in html
    assert "Fundación AulaNomina" in html
    assert "Javier Romero Sánchez" in html
    assert "Devengos" in html
    assert "Bases y cotización" in html
    assert "LECTURA LÍNEA POR LÍNEA" in html
    assert "@page" in html
    assert "1.211,03 €" in html


def test_build_payroll_receipt_print_html_escapes_user_content():
    receipt = sample_receipt()
    receipt["employee"]["name"] = "<script>alert('x')</script>"

    html = build_payroll_receipt_print_html(receipt)

    assert "<script>alert" not in html
    assert "&lt;script&gt;alert" in html
