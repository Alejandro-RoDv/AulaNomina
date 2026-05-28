from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.collective_agreement import (
    AgreementComplement,
    CollectiveAgreement,
    LeaveRule,
    ProfessionalCategory,
    ProfessionalGroup,
    SalaryTable,
    SalaryTableRow,
    VacationRule,
    WorkTimeRule,
)

DEMO_AGREEMENT_CODE = "SIM-ADM-2026"


def update_fields(instance, **fields):
    for field, value in fields.items():
        setattr(instance, field, value)
    return instance


def get_or_create_agreement(db: Session):
    agreement = db.query(CollectiveAgreement).filter(CollectiveAgreement.agreement_code == DEMO_AGREEMENT_CODE).first()
    fields = {
        "name": "Convenio Simulado de Servicios Administrativos",
        "agreement_code": DEMO_AGREEMENT_CODE,
        "sector": "Servicios administrativos y gestión empresarial",
        "territorial_scope": "Estatal simulado",
        "functional_scope": "Empresas simuladas dedicadas a administración, gestión documental, atención al cliente y soporte interno.",
        "personal_scope": "Personal laboral contratado por empresas incluidas en el ámbito funcional simulado.",
        "publication_date": date(2026, 1, 1),
        "effective_from": date(2026, 1, 1),
        "effective_to": date(2026, 12, 31),
        "status": "active",
        "source_url": None,
        "notes": (
            "Convenio ficticio para formación. No representa un convenio real. "
            "Sirve para practicar alta de contratos, selección de categoría y consulta manual de reglas laborales."
        ),
        "is_active": True,
    }
    if agreement:
        return update_fields(agreement, **fields)

    agreement = CollectiveAgreement(**fields)
    db.add(agreement)
    db.flush()
    return agreement


def get_or_create_group(db: Session, agreement: CollectiveAgreement, code: str, **fields):
    group = (
        db.query(ProfessionalGroup)
        .filter(
            ProfessionalGroup.collective_agreement_id == agreement.id,
            ProfessionalGroup.code == code,
        )
        .first()
    )
    fields = {"collective_agreement_id": agreement.id, "code": code, **fields}
    if group:
        return update_fields(group, **fields)

    group = ProfessionalGroup(**fields)
    db.add(group)
    db.flush()
    return group


def get_or_create_category(db: Session, agreement: CollectiveAgreement, code: str, **fields):
    category = (
        db.query(ProfessionalCategory)
        .filter(
            ProfessionalCategory.collective_agreement_id == agreement.id,
            ProfessionalCategory.code == code,
        )
        .first()
    )
    fields = {"collective_agreement_id": agreement.id, "code": code, **fields}
    if category:
        return update_fields(category, **fields)

    category = ProfessionalCategory(**fields)
    db.add(category)
    db.flush()
    return category


def get_or_create_salary_table(db: Session, agreement: CollectiveAgreement):
    table = (
        db.query(SalaryTable)
        .filter(
            SalaryTable.collective_agreement_id == agreement.id,
            SalaryTable.year == 2026,
            SalaryTable.name == "Tabla salarial 2026",
        )
        .first()
    )
    fields = {
        "collective_agreement_id": agreement.id,
        "name": "Tabla salarial 2026",
        "year": 2026,
        "effective_from": date(2026, 1, 1),
        "effective_to": date(2026, 12, 31),
        "number_of_payments": 14,
        "amount_type": "monthly",
        "status": "active",
        "notes": "Importes mensuales ficticios para 14 pagas. Uso didáctico.",
    }
    if table:
        return update_fields(table, **fields)

    table = SalaryTable(**fields)
    db.add(table)
    db.flush()
    return table


def get_or_create_salary_row(db: Session, salary_table: SalaryTable, category: ProfessionalCategory, **fields):
    row = (
        db.query(SalaryTableRow)
        .filter(
            SalaryTableRow.salary_table_id == salary_table.id,
            SalaryTableRow.professional_category_id == category.id,
        )
        .first()
    )
    fields = {
        "salary_table_id": salary_table.id,
        "professional_category_id": category.id,
        "professional_group_id": category.professional_group_id,
        "category_name": category.name,
        "group_name": category.professional_group.name if category.professional_group else None,
        "amount_unit": "monthly",
        **fields,
    }
    if row:
        return update_fields(row, **fields)

    row = SalaryTableRow(**fields)
    db.add(row)
    db.flush()
    return row


def get_or_create_complement(db: Session, agreement: CollectiveAgreement, name: str, **fields):
    complement = (
        db.query(AgreementComplement)
        .filter(
            AgreementComplement.collective_agreement_id == agreement.id,
            AgreementComplement.name == name,
        )
        .first()
    )
    fields = {"collective_agreement_id": agreement.id, "name": name, **fields}
    if complement:
        return update_fields(complement, **fields)

    complement = AgreementComplement(**fields)
    db.add(complement)
    db.flush()
    return complement


def get_or_create_work_time_rule(db: Session, agreement: CollectiveAgreement, name: str, **fields):
    rule = (
        db.query(WorkTimeRule)
        .filter(
            WorkTimeRule.collective_agreement_id == agreement.id,
            WorkTimeRule.name == name,
        )
        .first()
    )
    fields = {"collective_agreement_id": agreement.id, "name": name, **fields}
    if rule:
        return update_fields(rule, **fields)

    rule = WorkTimeRule(**fields)
    db.add(rule)
    db.flush()
    return rule


def get_or_create_vacation_rule(db: Session, agreement: CollectiveAgreement, name: str, **fields):
    rule = (
        db.query(VacationRule)
        .filter(
            VacationRule.collective_agreement_id == agreement.id,
            VacationRule.name == name,
        )
        .first()
    )
    fields = {"collective_agreement_id": agreement.id, "name": name, **fields}
    if rule:
        return update_fields(rule, **fields)

    rule = VacationRule(**fields)
    db.add(rule)
    db.flush()
    return rule


def get_or_create_leave_rule(db: Session, agreement: CollectiveAgreement, name: str, **fields):
    rule = (
        db.query(LeaveRule)
        .filter(
            LeaveRule.collective_agreement_id == agreement.id,
            LeaveRule.name == name,
        )
        .first()
    )
    fields = {"collective_agreement_id": agreement.id, "name": name, **fields}
    if rule:
        return update_fields(rule, **fields)

    rule = LeaveRule(**fields)
    db.add(rule)
    db.flush()
    return rule


def seed_demo_collective_agreements(db: Session):
    agreement = get_or_create_agreement(db)
    db.flush()

    groups = {
        "G1": get_or_create_group(
            db,
            agreement,
            "G1",
            name="Grupo 1 - Gestión y administración",
            description="Personal administrativo, contable y de gestión documental.",
            display_order=1,
        ),
        "G2": get_or_create_group(
            db,
            agreement,
            "G2",
            name="Grupo 2 - Atención y soporte",
            description="Personal de atención al cliente, recepción y soporte operativo.",
            display_order=2,
        ),
        "G3": get_or_create_group(
            db,
            agreement,
            "G3",
            name="Grupo 3 - Dirección y coordinación",
            description="Responsables de departamento, coordinación y mandos intermedios.",
            display_order=3,
        ),
    }
    db.flush()

    categories = {
        "AUXADM": get_or_create_category(
            db,
            agreement,
            "AUXADM",
            professional_group_id=groups["G1"].id,
            name="Auxiliar administrativo",
            subgroup="Administración básica",
            level="Nivel III",
            functional_description="Realiza tareas administrativas de apoyo, archivo, grabación de datos y atención documental.",
            required_qualification="Formación administrativa básica o experiencia equivalente.",
            display_order=1,
        ),
        "OFIADM": get_or_create_category(
            db,
            agreement,
            "OFIADM",
            professional_group_id=groups["G1"].id,
            name="Oficial administrativo",
            subgroup="Administración cualificada",
            level="Nivel II",
            functional_description="Gestiona procesos administrativos con autonomía, control documental y apoyo a nómina simulada.",
            required_qualification="FP de Administración o experiencia equivalente.",
            display_order=2,
        ),
        "CONTABLE": get_or_create_category(
            db,
            agreement,
            "CONTABLE",
            professional_group_id=groups["G1"].id,
            name="Técnico contable",
            subgroup="Gestión económica",
            level="Nivel II",
            functional_description="Registra, revisa y controla información económica y contable de la empresa simulada.",
            required_qualification="FP superior o formación equivalente en administración y finanzas.",
            display_order=3,
        ),
        "RECEPCION": get_or_create_category(
            db,
            agreement,
            "RECEPCION",
            professional_group_id=groups["G2"].id,
            name="Recepcionista",
            subgroup="Atención al cliente",
            level="Nivel III",
            functional_description="Atiende llamadas, visitas y comunicaciones básicas de la empresa.",
            required_qualification="Formación básica y competencias de atención al público.",
            display_order=4,
        ),
        "SOPORTE": get_or_create_category(
            db,
            agreement,
            "SOPORTE",
            professional_group_id=groups["G2"].id,
            name="Técnico de soporte interno",
            subgroup="Soporte operativo",
            level="Nivel II",
            functional_description="Presta soporte operativo a usuarios internos y mantiene registros de incidencias.",
            required_qualification="Formación técnica o experiencia equivalente.",
            display_order=5,
        ),
        "COORD": get_or_create_category(
            db,
            agreement,
            "COORD",
            professional_group_id=groups["G3"].id,
            name="Coordinador administrativo",
            subgroup="Coordinación",
            level="Nivel I",
            functional_description="Coordina equipos administrativos y revisa el cumplimiento de procedimientos internos.",
            required_qualification="Experiencia previa en coordinación o titulación superior relacionada.",
            display_order=6,
        ),
    }
    db.flush()

    salary_table = get_or_create_salary_table(db, agreement)
    db.flush()

    salary_rows = [
        ("AUXADM", Decimal("1325.00"), Decimal("32.00"), Decimal("45.00")),
        ("OFIADM", Decimal("1525.00"), Decimal("36.00"), Decimal("60.00")),
        ("CONTABLE", Decimal("1650.00"), Decimal("40.00"), Decimal("75.00")),
        ("RECEPCION", Decimal("1280.00"), Decimal("30.00"), Decimal("40.00")),
        ("SOPORTE", Decimal("1580.00"), Decimal("38.00"), Decimal("70.00")),
        ("COORD", Decimal("1900.00"), Decimal("45.00"), Decimal("120.00")),
    ]
    for category_code, base_salary, seniority_amount, agreement_plus in salary_rows:
        get_or_create_salary_row(
            db,
            salary_table,
            categories[category_code],
            base_salary=base_salary,
            seniority_amount=seniority_amount,
            agreement_plus=agreement_plus,
            total_amount=base_salary + agreement_plus,
            notes="Importe mínimo simulado. El alumno debe calcular manualmente complementos, pagas e incidencias.",
        )

    get_or_create_complement(
        db,
        agreement,
        "Plus convenio",
        complement_type="plus",
        amount=Decimal("45.00"),
        periodicity="monthly",
        number_of_payments=12,
        contribution_treatment="cotiza",
        tax_treatment="tributa",
        application_conditions="Aplicable según categoría y tabla salarial. Importe editable en la tabla.",
        notes="Concepto de referencia para practicar composición salarial.",
    )
    get_or_create_complement(
        db,
        agreement,
        "Complemento de nocturnidad",
        complement_type="nocturnidad",
        percentage=Decimal("25.00"),
        periodicity="hourly",
        contribution_treatment="cotiza",
        tax_treatment="tributa",
        application_conditions="Aplicar manualmente sobre horas nocturnas realizadas.",
        notes="La aplicación no calcula el recargo. Debe introducirlo el alumno.",
    )
    get_or_create_complement(
        db,
        agreement,
        "Mejora voluntaria IT",
        complement_type="it",
        percentage=Decimal("85.00"),
        periodicity="by_incident",
        contribution_treatment="según caso práctico",
        tax_treatment="según caso práctico",
        application_conditions="Complemento simulado hasta el 85% de la base reguladora durante los primeros 20 días de baja común.",
        notes="Regla informativa. No se calcula automáticamente para preservar el enfoque didáctico.",
    )

    get_or_create_work_time_rule(
        db,
        agreement,
        "Jornada ordinaria general",
        annual_hours=Decimal("1760.00"),
        weekly_hours=Decimal("40.00"),
        daily_max_hours=Decimal("9.00"),
        distribution_type="regular",
        rest_between_shifts_hours=Decimal("12.00"),
        weekly_rest="Día y medio semanal acumulable según calendario del caso práctico.",
        special_periods="Posibilidad de jornada intensiva en julio y agosto si lo establece el calendario docente.",
        notes="Regla de referencia. El alumno debe comprobar manualmente excesos y descansos.",
    )

    get_or_create_vacation_rule(
        db,
        agreement,
        "Vacaciones anuales ordinarias",
        natural_days=30,
        working_days=None,
        preferred_period="Preferentemente entre junio y septiembre.",
        accrual_period="Año natural",
        proportional_rule="Si no se trabaja el año completo, calcular proporción manual según días de alta.",
        it_overlap_rule="Si coincide con IT, revisar si procede disfrute posterior según el supuesto planteado.",
        termination_compensation_rule="Compensación en finiquito solo por días devengados y no disfrutados.",
        notes="No genera cálculo automático en nómina.",
    )

    leave_rules = [
        (
            "Matrimonio o pareja de hecho",
            {
                "leave_type": "paid",
                "cause": "matrimonio",
                "duration": Decimal("15.00"),
                "duration_unit": "natural_days",
                "paid": True,
                "requires_notice": True,
                "requires_justification": True,
                "salary_treatment": "Retribuido al 100% según salario ordinario.",
            },
        ),
        (
            "Fallecimiento de familiar hasta segundo grado",
            {
                "leave_type": "paid",
                "cause": "fallecimiento familiar",
                "duration": Decimal("2.00"),
                "duration_unit": "working_days",
                "paid": True,
                "requires_notice": True,
                "requires_justification": True,
                "displacement_extension": "Ampliable a 4 días si hay desplazamiento superior a 150 km en el caso práctico.",
                "salary_treatment": "Retribuido.",
            },
        ),
        (
            "Permiso sin sueldo",
            {
                "leave_type": "unpaid",
                "cause": "asuntos propios sin sueldo",
                "duration": Decimal("10.00"),
                "duration_unit": "working_days",
                "paid": False,
                "requires_notice": True,
                "requires_justification": False,
                "salary_treatment": "Descuento manual proporcional en nómina si el caso práctico lo exige.",
            },
        ),
    ]
    for name, fields in leave_rules:
        get_or_create_leave_rule(db, agreement, name, notes="Regla ficticia para práctica formativa.", **fields)

    db.commit()
    return agreement
