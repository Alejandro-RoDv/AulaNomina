from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.payroll import Payroll
from app.models.payroll_salary_structure import PayrollConcept, PayrollItem
from app.services.payroll_amounts import money


DEMO_PAYROLL_CONCEPTS = [
    {
        "code": "SALARIO_BASE",
        "name": "Salario base",
        "category": "BASE",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 10,
    },
    {
        "code": "COMPLEMENTO_CONVENIO",
        "name": "Complemento convenio",
        "category": "COMPLEMENTO",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 20,
    },
    {
        "code": "MEJORA_VOLUNTARIA",
        "name": "Mejora voluntaria",
        "category": "COMPLEMENTO",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 30,
    },
    {
        "code": "PLUS_TRANSPORTE",
        "name": "Plus transporte",
        "category": "PLUS",
        "concept_type": "DEVENGO",
        "salary_nature": "EXTRASALARIAL",
        "is_taxable": True,
        "is_contribution_base": False,
        "display_order": 40,
    },
    {
        "code": "PLUS_DISTANCIA",
        "name": "Plus distancia",
        "category": "PLUS",
        "concept_type": "DEVENGO",
        "salary_nature": "EXTRASALARIAL",
        "is_taxable": True,
        "is_contribution_base": False,
        "display_order": 50,
    },
    {
        "code": "PELIGROSIDAD",
        "name": "Peligrosidad",
        "category": "PLUS",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 60,
    },
    {
        "code": "NOCTURNIDAD",
        "name": "Nocturnidad",
        "category": "PLUS",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 70,
    },
    {
        "code": "HORAS_EXTRA",
        "name": "Horas extra",
        "category": "EXTRA",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 80,
    },
    {
        "code": "DIETAS",
        "name": "Dietas",
        "category": "DIETA",
        "concept_type": "DEVENGO",
        "salary_nature": "EXTRASALARIAL",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 90,
    },
    {
        "code": "KILOMETRAJE",
        "name": "Kilometraje",
        "category": "KILOMETRAJE",
        "concept_type": "DEVENGO",
        "salary_nature": "EXTRASALARIAL",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 100,
    },
    {
        "code": "PAGA_EXTRA",
        "name": "Paga extra",
        "category": "PAGA_EXTRA",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 110,
    },
    {
        "code": "PRORRATA_EXTRAS",
        "name": "Prorrata pagas extra",
        "category": "PAGA_EXTRA",
        "concept_type": "DEVENGO",
        "salary_nature": "SALARIAL",
        "is_taxable": True,
        "is_contribution_base": True,
        "display_order": 120,
    },
    {
        "code": "ANTICIPO",
        "name": "Anticipo",
        "category": "ANTICIPO",
        "concept_type": "DEDUCCION",
        "salary_nature": "INFORMATIVA",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 210,
    },
    {
        "code": "EMBARGO",
        "name": "Embargo",
        "category": "EMBARGO",
        "concept_type": "DEDUCCION",
        "salary_nature": "INFORMATIVA",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 220,
    },
    {
        "code": "BASE_CC",
        "name": "Base contingencias comunes",
        "category": "BASE_INFORMATIVA",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "INFORMATIVA",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 310,
    },
    {
        "code": "BASE_CP",
        "name": "Base contingencias profesionales",
        "category": "BASE_INFORMATIVA",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "INFORMATIVA",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 320,
    },
    {
        "code": "BASE_IRPF",
        "name": "Base IRPF",
        "category": "BASE_INFORMATIVA",
        "concept_type": "BASE_INFORMATIVA",
        "salary_nature": "INFORMATIVA",
        "is_taxable": False,
        "is_contribution_base": False,
        "display_order": 330,
    },
]


DEMO_EXTRA_ITEMS_BY_EMPLOYEE = {
    "Laura Martín Ruiz": [
        {"code": "COMPLEMENTO_CONVENIO", "amount": Decimal("85.00")},
        {"code": "PLUS_TRANSPORTE", "amount": Decimal("62.00")},
    ],
    "Javier Romero Sánchez": [
        {"code": "DIETAS", "amount": Decimal("35.00")},
        {"code": "ANTICIPO", "amount": Decimal("120.00")},
    ],
    "Carmen López Torres": [
        {"code": "MEJORA_VOLUNTARIA", "amount": Decimal("120.00")},
        {"code": "NOCTURNIDAD", "amount": Decimal("75.00")},
        {"code": "KILOMETRAJE", "quantity": Decimal("110.00"), "unit_price": Decimal("0.26")},
    ],
    "Ana Pérez Navarro": [
        {"code": "COMPLEMENTO_CONVENIO", "amount": Decimal("40.00")},
        {"code": "EMBARGO", "amount": Decimal("90.00")},
    ],
}


def get_or_create_payroll_concept(db: Session, concept_data: dict):
    concept = db.query(PayrollConcept).filter(PayrollConcept.code == concept_data["code"]).first()
    if concept:
        for key, value in concept_data.items():
            setattr(concept, key, value)
        concept.is_active = True
        return concept

    concept = PayrollConcept(**concept_data, is_active=True)
    db.add(concept)
    db.flush()
    return concept


def get_or_create_payroll_item(
    db: Session,
    payroll: Payroll,
    concept: PayrollConcept,
    amount: Decimal | None = None,
    quantity: Decimal = Decimal("1.00"),
    unit_price: Decimal = Decimal("0.00"),
    description: str | None = None,
):
    item = db.query(PayrollItem).filter(
        PayrollItem.payroll_id == payroll.id,
        PayrollItem.concept_id == concept.id,
    ).first()

    quantity = money(quantity)
    unit_price = money(unit_price)
    amount = money(amount) if amount is not None else money(quantity * unit_price)

    fields = {
        "payroll_id": payroll.id,
        "concept_id": concept.id,
        "description": description,
        "quantity": quantity,
        "unit_price": unit_price,
        "amount": amount,
        "display_order": concept.display_order,
    }

    if item:
        for key, value in fields.items():
            setattr(item, key, value)
        return item

    item = PayrollItem(**fields)
    db.add(item)
    db.flush()
    return item


def seed_demo_payroll_concepts(db: Session):
    concepts = {}
    for concept_data in DEMO_PAYROLL_CONCEPTS:
        concept = get_or_create_payroll_concept(db, concept_data)
        concepts[concept.code] = concept
    return concepts


def seed_demo_payroll_items(db: Session):
    concepts = seed_demo_payroll_concepts(db)
    payrolls = db.query(Payroll).all()

    for payroll in payrolls:
        employee_name = payroll.employee_name
        if concepts.get("SALARIO_BASE"):
            get_or_create_payroll_item(
                db,
                payroll,
                concepts["SALARIO_BASE"],
                amount=payroll.base_salary,
                description="Importe base tomado de la nómina simulada",
            )

        for item_data in DEMO_EXTRA_ITEMS_BY_EMPLOYEE.get(employee_name, []):
            concept = concepts.get(item_data["code"])
            if not concept:
                continue
            get_or_create_payroll_item(
                db,
                payroll,
                concept,
                amount=item_data.get("amount"),
                quantity=item_data.get("quantity", Decimal("1.00")),
                unit_price=item_data.get("unit_price", Decimal("0.00")),
                description="Línea manual demo",
            )

        if concepts.get("BASE_CC"):
            get_or_create_payroll_item(
                db,
                payroll,
                concepts["BASE_CC"],
                amount=payroll.common_contingencies_base,
                description="Base informativa de contingencias comunes",
            )
        if concepts.get("BASE_CP"):
            get_or_create_payroll_item(
                db,
                payroll,
                concepts["BASE_CP"],
                amount=payroll.professional_contingencies_base,
                description="Base informativa de contingencias profesionales",
            )
        if concepts.get("BASE_IRPF"):
            get_or_create_payroll_item(
                db,
                payroll,
                concepts["BASE_IRPF"],
                amount=payroll.irpf_base,
                description="Base informativa de IRPF",
            )

    return {"concepts": len(concepts), "payrolls": len(payrolls)}
