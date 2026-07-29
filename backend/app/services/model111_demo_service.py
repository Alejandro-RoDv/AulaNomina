from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.model111 import Professional, ProfessionalInvoice
from app.models.payroll import Payroll
from app.services.model111_calculator import money
from app.services.model111_service import Model111DomainError, build_model111_preview


DEMO_YEAR = 2026
DEMO_PERIOD = "2T"
DEMO_PROFESSIONALS = (
    {
        "nif": "B56000011",
        "name": "Marta",
        "surname": "Vega Consultoría",
        "activity_type": "professional",
        "withholding_rate": Decimal("15.00"),
        "address": "Calle Formación, 11",
        "province_code": "14",
    },
    {
        "nif": "B56000022",
        "name": "Javier",
        "surname": "Ruiz Prevención",
        "activity_type": "professional",
        "withholding_rate": Decimal("15.00"),
        "address": "Avenida del Trabajo, 22",
        "province_code": "14",
    },
    {
        "nif": "B56000033",
        "name": "Lucía",
        "surname": "Santos Formación",
        "activity_type": "professional",
        "withholding_rate": Decimal("15.00"),
        "address": "Plaza de la Empresa, 3",
        "province_code": "14",
    },
)
DEMO_INVOICES = (
    {
        "nif": "B56000011",
        "invoice_number": "PRO-2026-041",
        "invoice_date": date(2026, 4, 15),
        "payment_date": date(2026, 4, 20),
        "tax_base": Decimal("1600.00"),
    },
    {
        "nif": "B56000022",
        "invoice_number": "PRO-2026-052",
        "invoice_date": date(2026, 5, 12),
        "payment_date": date(2026, 5, 19),
        "tax_base": Decimal("1800.00"),
    },
    {
        "nif": "B56000033",
        "invoice_number": "PRO-2026-063",
        "invoice_date": date(2026, 6, 10),
        "payment_date": date(2026, 6, 18),
        "tax_base": Decimal("1400.00"),
    },
)


def _clone_payroll_values(source: Payroll, month: int) -> dict:
    values = {
        column.name: getattr(source, column.name)
        for column in Payroll.__table__.columns
        if column.name not in {"id", "created_at"}
    }
    values.update(
        period_month=month,
        period_year=DEMO_YEAR,
        status="reviewed",
        calculation_fingerprint=None,
    )
    return values


def _seed_quarter_payrolls(db: Session, company_id: int) -> dict:
    source_payrolls = (
        db.query(Payroll)
        .filter(
            Payroll.company_id == company_id,
            Payroll.period_year == DEMO_YEAR,
            Payroll.period_month == 5,
            Payroll.status != "cancelled",
        )
        .order_by(Payroll.employee_id, Payroll.id)
        .all()
    )
    if not source_payrolls:
        source_payrolls = (
            db.query(Payroll)
            .filter(Payroll.company_id == company_id, Payroll.status != "cancelled")
            .order_by(Payroll.period_year.desc(), Payroll.period_month.desc(), Payroll.id.desc())
            .all()
        )

    unique_sources: dict[tuple[int, int], Payroll] = {}
    for payroll in source_payrolls:
        unique_sources.setdefault((payroll.employee_id, payroll.contract_id), payroll)

    created = 0
    updated = 0
    for source in unique_sources.values():
        for month in (4, 5, 6):
            existing = (
                db.query(Payroll)
                .filter(
                    Payroll.company_id == company_id,
                    Payroll.employee_id == source.employee_id,
                    Payroll.contract_id == source.contract_id,
                    Payroll.period_year == DEMO_YEAR,
                    Payroll.period_month == month,
                    Payroll.status != "cancelled",
                )
                .order_by(Payroll.id)
                .first()
            )
            if existing:
                if existing.status != "reviewed":
                    existing.status = "reviewed"
                    updated += 1
                continue
            db.add(Payroll(**_clone_payroll_values(source, month)))
            created += 1

    return {
        "source_payrolls": len(unique_sources),
        "payrolls_created": created,
        "payrolls_reviewed": updated,
    }


def _seed_professionals(db: Session, company_id: int) -> tuple[dict[str, Professional], int]:
    result: dict[str, Professional] = {}
    created = 0
    for payload in DEMO_PROFESSIONALS:
        professional = (
            db.query(Professional)
            .filter(Professional.company_id == company_id, Professional.nif == payload["nif"])
            .first()
        )
        if professional is None:
            professional = Professional(company_id=company_id, **payload)
            db.add(professional)
            db.flush()
            created += 1
        else:
            for field, value in payload.items():
                setattr(professional, field, value)
            professional.active = True
        result[payload["nif"]] = professional
    return result, created


def _seed_invoices(db: Session, company_id: int, professionals: dict[str, Professional]) -> int:
    created = 0
    for payload in DEMO_INVOICES:
        professional = professionals[payload["nif"]]
        invoice = (
            db.query(ProfessionalInvoice)
            .filter(
                ProfessionalInvoice.company_id == company_id,
                ProfessionalInvoice.invoice_number == payload["invoice_number"],
            )
            .first()
        )
        withholding = money(payload["tax_base"] * Decimal("0.15"))
        values = {
            "professional_id": professional.id,
            "company_id": company_id,
            "invoice_number": payload["invoice_number"],
            "invoice_date": payload["invoice_date"],
            "payment_date": payload["payment_date"],
            "tax_base": money(payload["tax_base"]),
            "withholding_rate": Decimal("15.00"),
            "withholding_amount": withholding,
            "total_amount": money(payload["tax_base"] - withholding),
            "status": "paid",
            "notes": "Factura creada por el caso demostrativo del Modelo 111 · 2T 2026",
        }
        if invoice is None:
            db.add(ProfessionalInvoice(**values))
            created += 1
        else:
            for field, value in values.items():
                setattr(invoice, field, value)
    return created


def seed_model111_demo(db: Session, company_id: int) -> dict:
    company = db.query(Company).filter(Company.id == company_id).first()
    if company is None:
        raise Model111DomainError("COMPANY_NOT_FOUND", "Empresa no encontrada", status_code=404)

    payroll_result = _seed_quarter_payrolls(db, company_id)
    professionals, professionals_created = _seed_professionals(db, company_id)
    invoices_created = _seed_invoices(db, company_id, professionals)
    db.commit()

    preview = build_model111_preview(db, company_id, DEMO_YEAR, DEMO_PERIOD)
    return {
        "ok": True,
        "message": "Caso demostrativo del Modelo 111 cargado para el 2T de 2026",
        "company_id": company_id,
        "year": DEMO_YEAR,
        "period": DEMO_PERIOD,
        "professionals_created": professionals_created,
        "invoices_created": invoices_created,
        **payroll_result,
        "preview": preview,
    }
