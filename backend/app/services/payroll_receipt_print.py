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


def filler_rows(count: int, columns: int = 4) -> str:
    if count <= 0:
        return ""
    return "".join(f"<tr class='filler'><td colspan='{columns}'>&nbsp;</td></tr>" for _ in range(count))


def earning_rows(lines: list[dict]) -> str:
    salary_lines: list[dict] = []
    non_salary_lines: list[dict] = []
    for line in lines:
        nature = str(line.get("salary_nature") or "SALARIAL").upper()
        if nature in {"EXTRASALARIAL", "NO_SALARIAL", "NO SALARIAL"}:
            non_salary_lines.append(line)
        else:
            salary_lines.append(line)

    rows: list[str] = ["<tr class='subheading'><td colspan='4'>Percepciones salariales:</td></tr>"]

    def append_lines(items: list[dict]) -> None:
        for line in items:
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

    append_lines(salary_lines)
    rows.append("<tr class='subheading subsection'><td colspan='4'>Percepciones no salariales:</td></tr>")
    append_lines(non_salary_lines)

    visible_rows = len(rows)
    rows.append(filler_rows(max(0, 10 - visible_rows)))
    return "".join(rows)


def deduction_rate_text(line: dict) -> str:
    trace = line.get("trace") or {}
    raw = None
    for key in ("rate", "percentage", "percent", "employee_rate", "irpf_rate"):
        if trace.get(key) is not None:
            raw = trace.get(key)
            break
    if raw is None:
        return ""
    try:
        rate = Decimal(str(raw))
        if abs(rate) <= 1:
            rate *= 100
        return f"{rate.normalize()}%".replace(".", ",")
    except Exception:
        return ""


def deduction_rows(lines: list[dict]) -> str:
    social_security: list[dict] = []
    other: list[dict] = []
    for line in lines:
        code = str(line.get("code") or "").upper()
        name = str(line.get("name") or "").lower()
        is_ss = code.startswith("SS_") or any(
            token in name for token in ("contingencias", "desempleo", "formación profesional", "mei")
        )
        (social_security if is_ss else other).append(line)

    rows: list[str] = []
    if social_security:
        rows.append(
            "<tr class='subheading'><td colspan='4'>Aportación del trabajador a las cotizaciones de la Seguridad Social:</td></tr>"
        )

    def append_lines(items: list[dict]) -> None:
        for line in items:
            rows.append(
                "<tr>"
                f"<td>{html_text(line.get('name') or line.get('code'))}</td>"
                "<td></td>"
                f"<td class='num rate'>{html_text(deduction_rate_text(line), '')}</td>"
                f"<td class='num'>{money_text(line.get('amount'))}</td>"
                "</tr>"
            )

    append_lines(social_security)
    append_lines(other)
    if not rows:
        rows.append("<tr><td colspan='4' class='empty'>Sin deducciones</td></tr>")

    rows.append(filler_rows(max(0, 8 - len(rows))))
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
    :root {{ font-family: Arial, Helvetica, sans-serif; color: #171717; background: #ececec; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; padding: 22px; }}
    .toolbar {{ width: min(210mm, calc(100vw - 32px)); margin: 0 auto 12px; display: flex; justify-content: flex-end; }}
    .toolbar button {{ border: 1px solid #98a2b3; border-radius: 4px; background: #fff; padding: 10px 15px; color: #101828; font-weight: 700; cursor: pointer; }}
    .sheet {{ width: min(210mm, calc(100vw - 32px)); min-height: 297mm; margin: 0 auto; padding: 18mm 10mm 13mm; background: #fff; border: 1px solid #c8c8c8; box-shadow: 0 10px 32px rgba(0,0,0,.10); }}
    .parties {{ display: grid; grid-template-columns: 1fr 1fr; border: 1.4px solid #111; }}
    .party {{ min-height: 44mm; }}
    .party + .party {{ border-left: 1px solid #111; }}
    .party h2 {{ margin: 0; padding: 4px 8px; background: #f2f2f2; border-bottom: 1px solid #c8c8c8; font-size: 16px; line-height: 1.1; text-align: center; }}
    .party .info-row {{ display: grid; grid-template-columns: 42% 58%; gap: 7px; padding: 2px 8px; font-size: 12.2px; line-height: 1.25; }}
    .party .info-row:first-of-type {{ padding-top: 7px; }}
    .party .info-row span {{ color: #202020; }}
    .party .info-row strong {{ font-weight: 500; overflow-wrap: anywhere; }}
    .period {{ display: grid; grid-template-columns: 1.7fr .9fr .9fr .7fr; border: 1.4px solid #111; border-top: 0; font-size: 12px; }}
    .period > div {{ min-height: 38px; padding: 5px 8px; display: flex; align-items: center; }}
    .period .center {{ justify-content: center; text-align: center; font-style: italic; line-height: 1.2; }}
    .period .days {{ justify-content: flex-end; text-align: right; }}
    table {{ width: 100%; border-collapse: collapse; table-layout: fixed; }}
    .payroll-table {{ border-left: 1.4px solid #111; border-right: 1.4px solid #111; font-size: 12.2px; }}
    .payroll-table th {{ padding: 4px 7px; background: #f1f1f1; border-bottom: 1px solid #c8c8c8; font-size: 13px; line-height: 1.15; }}
    .payroll-table th:first-child {{ width: 58%; text-align: left; }}
    .payroll-table th:nth-child(2) {{ width: 14%; }}
    .payroll-table th:nth-child(3) {{ width: 14%; }}
    .payroll-table th:nth-child(4) {{ width: 14%; }}
    .payroll-table td {{ height: 23px; padding: 3px 7px; vertical-align: middle; }}
    .payroll-table td.num {{ text-align: right; white-space: nowrap; font-style: italic; }}
    .payroll-table td.rate {{ color: #333; }}
    .payroll-table .subheading td {{ height: 25px; padding-top: 5px; padding-bottom: 2px; font-weight: 700; font-style: normal; }}
    .payroll-table .subsection td {{ padding-top: 8px; }}
    .payroll-table .filler td {{ height: 22px; padding: 0; }}
    .payroll-table .empty {{ padding: 12px; color: #6b7280; text-align: center; }}
    .total-row {{ display: grid; grid-template-columns: 1fr 44mm; border: 1.4px solid #111; border-top: 0; font-size: 13px; font-weight: 700; }}
    .total-row span, .total-row strong {{ min-height: 28px; padding: 5px 8px; display: flex; align-items: center; }}
    .total-row strong {{ justify-content: flex-end; text-align: right; font-style: italic; }}
    .deductions-title {{ display: grid; grid-template-columns: 1fr 44mm; margin-top: 7mm; border-left: 1.4px solid #111; border-right: 1.4px solid #111; border-top: 1.4px solid #111; background: #f1f1f1; font-size: 13px; font-weight: 700; }}
    .deductions-title span {{ padding: 5px 8px; }}
    .deductions-title span:last-child {{ text-align: center; }}
    .net-row {{ display: grid; grid-template-columns: 1fr 44mm; margin-top: 5mm; border: 1.4px solid #111; font-size: 14px; font-weight: 800; }}
    .net-row span, .net-row strong {{ min-height: 32px; padding: 6px 8px; display: flex; align-items: center; }}
    .net-row strong {{ justify-content: flex-end; border-left: 1px solid #111; background: #f7f7f7; text-align: right; font-style: italic; }}
    .payment {{ display: grid; grid-template-columns: 1.15fr .85fr; min-height: 23mm; border-left: 1.4px solid #111; border-right: 1.4px solid #111; border-bottom: 1.4px solid #111; font-size: 12px; }}
    .payment > div {{ padding: 6px 8px; line-height: 1.45; }}
    .payment .signature {{ display: flex; align-items: center; justify-content: center; font-size: 12.5px; }}
    .bases {{ margin-top: 7mm; min-height: 42mm; border: 1.4px solid #111; }}
    .bases h2 {{ margin: 0; padding: 5px 8px; background: #f1f1f1; font-size: 13px; }}
    .bases h3 {{ margin: 0; padding: 5px 8px 3px; font-size: 13px; }}
    .base-row {{ display: grid; grid-template-columns: 1fr 44mm; padding: 3px 8px; font-size: 12px; line-height: 1.25; }}
    .base-row strong {{ text-align: right; font-style: italic; font-weight: 500; }}
    .footer {{ margin-top: 6mm; color: #7a7a7a; font-size: 9px; line-height: 1.4; text-align: center; }}
    @media (max-width: 820px) {{
      body {{ padding: 8px; }}
      .toolbar, .sheet {{ width: 100%; }}
      .sheet {{ padding: 24px 16px; }}
      .party .info-row {{ grid-template-columns: 46% 54%; font-size: 11px; }}
    }}
    @media print {{
      :root {{ background: white; }}
      body {{ padding: 0; background: white; }}
      .toolbar {{ display: none; }}
      .sheet {{ width: 100%; min-height: 0; border: 0; box-shadow: none; padding: 0; }}
      @page {{ size: A4; margin: 10mm; }}
    }}
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <main class="sheet">
    <section class="parties">
      {company_panel(company)}
      {employee_panel(employee, contract)}
    </section>

    <section class="period">
      <div>Periodo de liquidación: <strong>&nbsp;{html_text(period.get('label'))}</strong></div>
      <div class="center">Fecha inicial<br><strong>{period_start}</strong></div>
      <div class="center">Fecha final<br><strong>{period_end}</strong></div>
      <div class="days">Total días: <strong>&nbsp;{html_text(total_days)}</strong></div>
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
      Centro de trabajo: {html_text(work_center.get('name'))} · Contrato: {html_text(contract.get('code'))} · Nómina: {html_text(receipt.get('payroll_code'))}
    </footer>
  </main>
</body>
</html>"""


def get_payroll_receipt_print_html(db: Session, payroll_id: int) -> tuple[str, str]:
    receipt = get_payroll_receipt(db, payroll_id)
    return build_payroll_receipt_print_html(receipt), payroll_receipt_filename(receipt)
