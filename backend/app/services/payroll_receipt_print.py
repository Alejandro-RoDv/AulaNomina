from __future__ import annotations

from decimal import Decimal
from html import escape
from typing import Any

from sqlalchemy.orm import Session

from app.services.payroll_receipt import get_payroll_receipt


def as_text(value: Any, fallback: str = "-") -> str:
    if value is None or value == "":
        return fallback
    return str(value)


def money_text(value: Any) -> str:
    try:
        amount = Decimal(str(value or "0.00"))
    except Exception:
        amount = Decimal("0.00")
    return f"{amount:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def decimal_text(value: Any, digits: int = 2) -> str:
    try:
        amount = Decimal(str(value or "0"))
    except Exception:
        amount = Decimal("0")
    return f"{amount:.{digits}f}".replace(".", ",")


def html_text(value: Any, fallback: str = "-") -> str:
    return escape(as_text(value, fallback))


def payroll_receipt_filename(receipt: dict) -> str:
    code = str(receipt.get("payroll_code") or f"nomina-{receipt.get('payroll_id', 'sin-id')}")
    safe = "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in code.lower())
    safe = "-".join(part for part in safe.split("-") if part)
    return f"recibo-{safe or 'nomina'}.html"


def address_text(party: dict | None) -> str:
    party = party or {}
    return " · ".join(
        str(part)
        for part in [party.get("address"), party.get("city"), party.get("province")]
        if part
    ) or "-"


def info_row(label: str, value: Any) -> str:
    return f"<div class='info-row'><span>{html_text(label)}</span><strong>{html_text(value)}</strong></div>"


def company_panel(company: dict) -> str:
    return (
        "<section class='party party-company'>"
        "<h2>EMPRESA</h2>"
        f"{info_row('Nombre:', company.get('name'))}"
        f"{info_row('Domicilio:', address_text(company))}"
        f"{info_row('CIF:', company.get('tax_id'))}"
        f"{info_row('Código Cuenta cotización S.S.:', company.get('contribution_account'))}"
        "</section>"
    )


def employee_panel(employee: dict, contract: dict) -> str:
    category = contract.get("professional_category") or contract.get("job_position")
    return (
        "<section class='party party-employee'>"
        "<h2>TRABAJADOR/A</h2>"
        f"{info_row('Nombre:', employee.get('name'))}"
        f"{info_row('DNI:', employee.get('tax_id'))}"
        f"{info_row('Número de afiliación a la S.S.:', employee.get('social_security_number'))}"
        f"{info_row('Categoría o grupo profesional:', category)}"
        f"{info_row('Grupo de cotización:', contract.get('contribution_group'))}"
        f"{info_row('Fecha de antigüedad:', contract.get('seniority_date'))}"
        "</section>"
    )


def earning_rows(lines: list[dict]) -> str:
    if not lines:
        return "<tr><td colspan='4' class='empty'>Sin devengos</td></tr>"

    rows: list[str] = []
    last_nature = None
    for line in lines:
        nature = str(line.get("salary_nature") or "SALARIAL").upper()
        if nature != last_nature:
            label = "Percepciones no salariales:" if nature in {"EXTRASALARIAL", "NO_SALARIAL", "NO SALARIAL"} else "Percepciones salariales:"
            rows.append(f"<tr class='subheading'><td colspan='4'>{html_text(label)}</td></tr>")
            last_nature = nature

        quantity = line.get("quantity")
        unit_price = line.get("unit_price")
        rows.append(
            "<tr>"
            f"<td>{html_text(line.get('name') or line.get('code'))}</td>"
            f"<td class='num'>{decimal_text(quantity) if quantity is not None else ''}</td>"
            f"<td class='num'>{money_text(unit_price) if unit_price is not None else ''}</td>"
            f"<td class='num'>{money_text(line.get('amount'))}</td>"
            "</tr>"
        )
    return "".join(rows)


def deduction_rows(lines: list[dict]) -> str:
    if not lines:
        return "<tr><td colspan='4' class='empty'>Sin deducciones</td></tr>"

    rows: list[str] = []
    for line in lines:
        rows.append(
            "<tr>"
            f"<td>{html_text(line.get('name') or line.get('code'))}</td>"
            "<td></td>"
            "<td></td>"
            f"<td class='num'>{money_text(line.get('amount'))}</td>"
            "</tr>"
        )
    return "".join(rows)


def build_payroll_receipt_print_html(receipt: dict) -> str:
    period = receipt.get("period") or {}
    totals = receipt.get("totals") or {}
    company = receipt.get("company") or {}
    employee = receipt.get("employee") or {}
    contract = receipt.get("contract") or {}
    bases = receipt.get("bases") or {}
    work_center = receipt.get("work_center") or {}

    period_start = html_text(period.get("period_start"))
    period_end = html_text(period.get("period_end"))
    total_days = period.get("period_days") or period.get("contribution_days") or 30
    title = f"Recibo de nómina {receipt.get('payroll_code')}"

    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html_text(title)}</title>
  <style>
    :root {{ font-family: Arial, Helvetica, sans-serif; color: #171717; background: #efefef; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; padding: 26px; }}
    .toolbar {{ width: min(920px, 100%); margin: 0 auto 12px; display: flex; justify-content: flex-end; }}
    .toolbar button {{ border: 1px solid #9ca3af; border-radius: 4px; background: #fff; padding: 9px 14px; color: #111827; font-weight: 700; cursor: pointer; }}
    .sheet {{ width: min(920px, 100%); min-height: 1180px; margin: 0 auto; padding: 28px 34px 34px; background: #fff; border: 1px solid #c9c9c9; box-shadow: 0 8px 26px rgba(0,0,0,.08); }}
    .document-note {{ margin: 0 0 10px; color: #6b7280; font-size: 9px; font-weight: 700; letter-spacing: .06em; text-align: right; text-transform: uppercase; }}
    .parties {{ display: grid; grid-template-columns: 1fr 1fr; border: 1.5px solid #222; }}
    .party {{ min-height: 150px; }}
    .party + .party {{ border-left: 1px solid #222; }}
    .party h2 {{ margin: 0; padding: 3px 8px; background: #f1f1f1; border-bottom: 1px solid #d0d0d0; font-size: 15px; text-align: center; }}
    .party .info-row {{ display: grid; grid-template-columns: 190px 1fr; gap: 6px; padding: 1px 7px; font-size: 11px; line-height: 1.22; }}
    .party .info-row span {{ color: #202020; }}
    .party .info-row strong {{ font-weight: 500; }}
    .period {{ display: grid; grid-template-columns: 1.6fr 1fr 1fr .8fr; border: 1.5px solid #222; border-top: 0; font-size: 11px; }}
    .period > div {{ padding: 3px 7px; }}
    .period .center {{ text-align: center; font-style: italic; }}
    .period .days {{ text-align: right; }}
    table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
    .payroll-table {{ border-left: 1.5px solid #222; border-right: 1.5px solid #222; font-size: 11px; }}
    .payroll-table th {{ padding: 3px 6px; background: #f1f1f1; border-bottom: 1px solid #d0d0d0; font-size: 12px; }}
    .payroll-table th:first-child {{ width: 58%; text-align: left; }}
    .payroll-table th:nth-child(2) {{ width: 14%; }}
    .payroll-table th:nth-child(3) {{ width: 14%; }}
    .payroll-table th:nth-child(4) {{ width: 14%; }}
    .payroll-table td {{ padding: 2px 6px; vertical-align: top; }}
    .payroll-table td.num {{ text-align: right; white-space: nowrap; font-style: italic; }}
    .payroll-table .subheading td {{ padding-top: 5px; font-weight: 700; font-style: normal; }}
    .payroll-table .empty {{ padding: 8px; color: #6b7280; text-align: center; }}
    .total-row {{ display: grid; grid-template-columns: 1fr 190px; border: 1.5px solid #222; border-top: 0; font-size: 12px; font-weight: 700; }}
    .total-row span {{ padding: 3px 7px; }}
    .total-row strong {{ padding: 3px 7px; text-align: right; font-style: italic; }}
    .deductions-title {{ display: grid; grid-template-columns: 1fr 190px; margin-top: 18px; border-left: 1.5px solid #222; border-right: 1.5px solid #222; border-top: 1.5px solid #222; background: #f1f1f1; font-size: 12px; font-weight: 700; }}
    .deductions-title span {{ padding: 4px 7px; }}
    .deductions-title span:last-child {{ text-align: center; }}
    .net-row {{ display: grid; grid-template-columns: 1fr 190px; margin-top: 14px; border: 1.5px solid #222; font-size: 13px; font-weight: 800; }}
    .net-row span {{ padding: 5px 7px; }}
    .net-row strong {{ padding: 5px 7px; border-left: 1px solid #222; background: #f7f7f7; text-align: right; font-style: italic; }}
    .payment {{ display: grid; grid-template-columns: 1.2fr .8fr; min-height: 64px; border-left: 1.5px solid #222; border-right: 1.5px solid #222; border-bottom: 1.5px solid #222; font-size: 11px; }}
    .payment > div {{ padding: 5px 7px; }}
    .payment .signature {{ display: flex; align-items: center; justify-content: center; font-size: 12px; }}
    .bases {{ margin-top: 18px; border: 1.5px solid #222; }}
    .bases h2 {{ margin: 0; padding: 4px 7px; background: #f1f1f1; font-size: 12px; }}
    .bases h3 {{ margin: 0; padding: 3px 7px; font-size: 12px; }}
    .base-row {{ display: grid; grid-template-columns: 1fr 190px; padding: 2px 7px; font-size: 11px; }}
    .base-row strong {{ text-align: right; font-style: italic; font-weight: 500; }}
    .footer {{ margin-top: 18px; color: #6b7280; font-size: 9px; line-height: 1.35; text-align: center; }}
    @media print {{
      :root {{ background: white; }}
      body {{ padding: 0; background: white; }}
      .toolbar {{ display: none; }}
      .sheet {{ width: 100%; min-height: 0; border: 0; box-shadow: none; padding: 0; }}
      @page {{ size: A4; margin: 14mm; }}
    }}
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <main class="sheet">
    <p class="document-note">Recibo individual de salarios simulado · AulaNomina</p>

    <section class="parties">
      {company_panel(company)}
      {employee_panel(employee, contract)}
    </section>

    <section class="period">
      <div>Periodo de liquidación: <strong>{html_text(period.get('label'))}</strong></div>
      <div class="center">Fecha inicial<br><strong>{period_start}</strong></div>
      <div class="center">Fecha final<br><strong>{period_end}</strong></div>
      <div class="days">Total días: <strong>{html_text(total_days)}</strong></div>
    </section>

    <table class="payroll-table">
      <thead><tr><th>DEVENGOS</th><th>CANTIDAD</th><th>PRECIO</th><th>TOTALES</th></tr></thead>
      <tbody>{earning_rows(receipt.get('earnings') or [])}</tbody>
    </table>
    <div class="total-row"><span>TOTAL DEVENGADO</span><strong>{money_text(totals.get('total_earnings'))}</strong></div>

    <div class="deductions-title"><span>DEDUCCIONES</span><span>TOTALES</span></div>
    <table class="payroll-table">
      <tbody>{deduction_rows(receipt.get('deductions') or [])}</tbody>
    </table>
    <div class="total-row"><span>TOTAL A DEDUCIR</span><strong>{money_text(totals.get('total_deductions'))}</strong></div>

    <div class="net-row"><span>LÍQUIDO A PERCIBIR</span><strong>{money_text(totals.get('net_salary'))}</strong></div>

    <section class="payment">
      <div>
        <div>Fecha de ingreso de la nómina: -</div>
        <div>Entidad financiera (banco): -</div>
        <div>Número de cuenta: -</div>
      </div>
      <div class="signature">Firma del trabajador</div>
    </section>

    <section class="bases">
      <h2>DETERMINACIÓN BASES COTIZACIÓN A LA SEGURIDAD SOCIAL</h2>
      <h3>TOTAL BASE S.S.</h3>
      <div class="base-row"><span>Base de cotización de contingencias comunes</span><strong>{money_text(bases.get('common_contingencies'))}</strong></div>
      <div class="base-row"><span>Base de cotización de contingencias profesionales</span><strong>{money_text(bases.get('professional_contingencies'))}</strong></div>
      <div class="base-row"><span>Base de desempleo, formación profesional y FOGASA</span><strong>{money_text(bases.get('unemployment_training_fogasa'))}</strong></div>
      <div class="base-row"><span>Base sujeta a retención del IRPF</span><strong>{money_text(bases.get('irpf'))}</strong></div>
    </section>

    <footer class="footer">
      {html_text(receipt.get('legal_footer'))}<br>
      Centro de trabajo: {html_text(work_center.get('name'))} · Contrato: {html_text(contract.get('code'))}
    </footer>
  </main>
</body>
</html>"""


def get_payroll_receipt_print_html(db: Session, payroll_id: int) -> tuple[str, str]:
    receipt = get_payroll_receipt(db, payroll_id)
    return build_payroll_receipt_print_html(receipt), payroll_receipt_filename(receipt)
