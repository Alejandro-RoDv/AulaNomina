from decimal import Decimal
from xml.etree import ElementTree as ET

from app.catalogs.cra_codes import CRA_CODE_BY_VALUE
from app.services.cra_service import build_cra_xml


def test_cra_catalog_respects_key_inclusion_rules():
    assert CRA_CODE_BY_VALUE["0001"]["allowed_indicators"] == ["I"]
    assert CRA_CODE_BY_VALUE["0042"]["allowed_indicators"] == ["I", "E"]
    assert CRA_CODE_BY_VALUE["0062"]["allowed_indicators"] == ["E"]


def test_build_cra_xml_contains_company_worker_and_concepts():
    preview = {
        "company_id": 3,
        "company_name": "Empresa Demo",
        "ccc_id": "14123456789",
        "period": "2026-06",
        "workers": [
            {
                "employee_id": 9,
                "employee_name": "Trabajadora Demo",
                "naf": "141234567890",
                "payroll_id": 44,
                "records": [
                    {
                        "cra_code": "0001",
                        "cra_name": "Retribución no incluida en otros apartados",
                        "base_indicator": "I",
                        "amount": Decimal("1500.25"),
                        "action": "A",
                    },
                    {
                        "cra_code": "0062",
                        "cra_name": "Gastos de teletrabajo",
                        "base_indicator": "E",
                        "amount": Decimal("35.00"),
                        "action": "A",
                    },
                ],
            }
        ],
    }

    xml = build_cra_xml(preview)
    root = ET.fromstring(xml)
    company = root.find("DDE")
    worker = company.find("TRB")
    concepts = worker.findall("CRE")

    assert root.tag == "CRA"
    assert root.attrib["simulated"] == "true"
    assert company.attrib["ccc"] == "14123456789"
    assert worker.attrib["naf"] == "141234567890"
    assert [(item.attrib["code"], item.attrib["indicator"], item.attrib["amount"]) for item in concepts] == [
        ("0001", "I", "1500.25"),
        ("0062", "E", "35.00"),
    ]
