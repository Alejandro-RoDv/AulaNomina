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


def html_text(value: Any, fallback: str = "-") -> str:
    return escape(as_text(value, fallback))


def payroll_receipt_filename(receipt: dict) -> str:
    code = str(receipt.get("payroll_code") or f"nomina-{receipt.get('payroll_id', 'sin-id')}")
    safe = "".join(char if char.isalnum() or char in {"-", "_"} else "-" for char in code.lower())
    safe = "-".join(part for part in safe.split("-") if part)
    return f"recibo-{safe or 'nomina'}.html"


def party_block(title: str, party: dict | None) -> str:
    party = party or {}
    rows = [
        ("Nombre", party.get("name")),
        ("Código", party.get("code")),
        ("NIF/CIF", party.get("tax_id")),
        ("NAF/CCC", party.get("social_security_number") or party.get("contribution_account")),
        ("Dirección", " · ".join(str(part) for part in [party.get("address"), party.get("city"), party.get("province")] if part)),
    ]
    body = "".join(f"<dt>{html_text(label)}</dt><dd>{html_text(value)}</dd>" for label, value in rows)
    return f"<section class='card'><h2>{html_text(title)}</h2><dl>{body}</dl></section>"


def metric(label: str, value: Any, strong: bool = False) -> str:
    cls = "metric strong" if strong else "metric"
    return f"<div class='{cls}'><span>{html_text(label)}</span><b>{html_text(value)}</b></div>"


def line_table(title: str, lines: list[dict]) -> str:
    rows = []
    for line in lines:
        rows.append(
            "<tr>"
            f"<td>{html_text(line.get('code'))}</td>"
            f"<td><b>{html_text(line.get('name'))}</b><small>{html_text(line.get('description'), '')}</small></td>"
            f"<td>{html_text(line.get('source_type'))}</td>"
            f"<td class='amount'>{money_text(line.get('amount'))}</td>"
            "</tr>"
        )
    if not rows:
        rows.append("<tr><td colspan='4' class='empty'>Sin líneas</td></tr>")
    return (
        f"<section class='card wide'><h2>{html_text(title)}</h2>"
        "<table><thead><tr><th>Código</th><th>Concepto</th><th>Origen</th><th>Importe</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table></section>"
    )


def explanation_cards(title: str, eyebrow: str, explanations: list[dict], *, amount_key: str = "amount") -> str:
    if not explanations:
        return ""
    cards = []
    for item in explanations:
        points = "".join(f"<li>{html_text(point)}</li>" for point in item.get("learning_points") or [])
        formula = f"<p class='formula'>{html_text(item.get('formula'))}</p>" if item.get("formula") else ""
        badge = " afectada" if item.get("affected_by_incident") else ""
        cards.append(
            f"<article class='explanation{badge}'>"
            f"<header><b>{html_text(item.get('title') or item.get('name') or item.get('code'))}</b>"
            f"<span>{money_text(item.get(amount_key))}</span></header>"
            f"{formula}"
            f"<p>{html_text(item.get('explanation'))}</p>"
            f"<ul>{points}</ul>"
            "</article>"
        )
    return (
        f"<section class='teaching'><p class='eyebrow'>{html_text(eyebrow)}</p>"
        f"<h2>{html_text(title)}</h2><div class='explanation-grid'>{''.join(cards)}</div></section>"
    )


def line_explanation_cards(explanations: list[dict]) -> str:
    if not explanations:
        return ""
    cards = []
    for item in explanations:
        chips = [
            item.get("section"),
            item.get("source_type"),
            "bruto" if item.get("affects_gross") else "no bruto",
            "neto" if item.get("affects_net") else "no neto",
            "cotiza" if item.get("contribution_base") else "no cotiza",
            "tributa" if item.get("taxable") else "no tributa",
        ]
        chip_html = "".join(f"<span>{html_text(chip)}</span>" for chip in chips if chip)
        points = "".join(f"<li>{html_text(point)}</li>" for point in item.get("learning_points") or [])
        formula = f"<p class='formula'>{html_text(item.get('formula'))}</p>" if item.get("formula") else ""
        cards.append(
            "<article class='line-explanation'>"
            f"<header><b>{html_text(item.get('code'))}</b><span>{money_text(item.get('amount'))}</span></header>"
            f"<h3>{html_text(item.get('name'))}</h3>"
            f"<div class='chips'>{chip_html}</div>"
            f"{formula}"
            f"<p>{html_text(item.get('explanation'))}</p>"
            f"<ul>{points}</ul>"
            "</article>"
        )
    return (
        "<section class='teaching page-break'>"
        "<p class='eyebrow'>LECTURA LÍNEA POR LÍNEA</p>"
        "<h2>Qué significa cada concepto del recibo</h2>"
        f"<div class='line-grid'>{''.join(cards)}</div></section>"
    )


def build_payroll_receipt_print_html(receipt: dict) -> str:
    period = receipt.get("period") or {}
    totals = receipt.get("totals") or {}
    company = receipt.get("company") or {}
    employee = receipt.get("employee") or {}
    title = f"Recibo de nómina {receipt.get('payroll_code')}"
    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html_text(title)}</title>
  <style>
    :root {{ font-family: Arial, Helvetica, sans-serif; color: #111827; background: #f3f4f6; }}
    body {{ margin: 0; padding: 24px; }}
    .sheet {{ max-width: 1040px; margin: 0 auto; background: white; border: 2px solid #111827; padding: 24px; }}
    .toolbar {{ max-width: 1040px; margin: 0 auto 12px; display: flex; justify-content: flex-end; gap: 8px; }}
    button {{ border: 2px solid #111827; background: #e6d85c; padding: 10px 14px; font-weight: 800; cursor: pointer; }}
    header.main {{ display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #111827; padding-bottom: 16px; margin-bottom: 16px; }}
    h1 {{ margin: 0; font-size: 26px; }}
    h2 {{ margin: 0 0 10px; font-size: 16px; }}
    h3 {{ margin: 4px 0; font-size: 13px; }}
    .muted {{ color: #6b7280; font-size: 12px; font-weight: 700; }}
    .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 14px; }}
    .two {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }}
    .card, .teaching {{ border: 2px solid #111827; padding: 12px; margin-bottom: 12px; break-inside: avoid; }}
    .wide {{ grid-column: span 1; }}
    dl {{ display: grid; grid-template-columns: 86px 1fr; gap: 4px 8px; margin: 0; font-size: 12px; }}
    dt {{ color: #6b7280; font-weight: 800; }} dd {{ margin: 0; font-weight: 700; }}
    .metrics {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }}
    .metric {{ border: 1px solid #111827; padding: 8px; display: flex; flex-direction: column; gap: 4px; }}
    .metric span {{ font-size: 11px; color: #6b7280; font-weight: 800; }}
    .metric b {{ font-size: 15px; }} .metric.strong {{ background: #e6d85c; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
    th, td {{ border-bottom: 1px solid #d1d5db; text-align: left; padding: 7px; vertical-align: top; }}
    th {{ background: #f9fafb; }} .amount {{ text-align: right; white-space: nowrap; font-weight: 800; }}
    small {{ display: block; color: #6b7280; margin-top: 2px; }}
    .eyebrow {{ margin: 0 0 4px; font-size: 10px; letter-spacing: .08em; font-weight: 900; color: #4f46e5; }}
    .explanation-grid, .line-grid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }}
    .explanation, .line-explanation {{ border: 1px solid #111827; padding: 10px; break-inside: avoid; }}
    .explanation.afectada {{ background: #fffdf0; }}
    .explanation header, .line-explanation header {{ display: flex; justify-content: space-between; gap: 10px; font-size: 13px; }}
    .formula {{ color: #92400e; font-size: 11px; font-weight: 800; margin: 6px 0; }}
    p {{ font-size: 12px; line-height: 1.45; }}
    ul {{ margin: 6px 0 0; padding-left: 18px; font-size: 11px; line-height: 1.4; }}
    .chips {{ display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }}
    .chips span {{ border: 1px solid #111827; border-radius: 999px; padding: 3px 7px; font-size: 10px; font-weight: 800; }}
    .footer {{ border-top: 2px solid #d1d5db; margin-top: 14px; padding-top: 10px; color: #6b7280; font-size: 11px; font-weight: 700; }}
    .page-break {{ break-before: page; }}
    @media print {{
      body {{ background: white; padding: 0; }} .toolbar {{ display: none; }} .sheet {{ border: 0; padding: 0; max-width: none; }}
      @page {{ size: A4; margin: 14mm; }}
    }}
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / Guardar como PDF</button></div>
  <main class="sheet">
    <header class="main">
      <div><p class="eyebrow">RECIBO INDIVIDUAL DE SALARIOS SIMULADO</p><h1>{html_text(title)}</h1><p class="muted">{html_text(period.get('label'))}</p></div>
      <div><b>{html_text(company.get('name'))}</b><p class="muted">Trabajador: {html_text(employee.get('name'))}</p></div>
    </header>

    <section class="grid">
      {party_block('Empresa', receipt.get('company'))}
      {party_block('Centro', receipt.get('work_center') or receipt.get('company'))}
      {party_block('Trabajador', receipt.get('employee'))}
    </section>

    <section class="metrics">
      {metric('Días cotización', period.get('contribution_days'))}
      {metric('Días trabajados', period.get('worked_days'))}
      {metric('Días incidencia', period.get('incident_days'))}
      {metric('Estado', receipt.get('status'))}
    </section>

    <section class="metrics">
      {metric('Total devengos', money_text(totals.get('total_earnings')))}
      {metric('Total deducciones', money_text(totals.get('total_deductions')))}
      {metric('Líquido a percibir', money_text(totals.get('net_salary')), True)}
      {metric('Coste empresa', money_text(totals.get('company_total_cost')))}
    </section>

    <section class="two">
      {line_table('Devengos', receipt.get('earnings') or [])}
      {line_table('Deducciones', receipt.get('deductions') or [])}
    </section>

    <section class="two">
      {line_table('Bases de cotización e IRPF', receipt.get('base_lines') or [])}
      {line_table('Coste de empresa', receipt.get('company_cost_lines') or [])}
    </section>

    {explanation_cards('Bases y cotización', 'LECTURA DIDÁCTICA', receipt.get('base_explanations') or [])}
    {explanation_cards('Incidencias aplicadas', 'INCIDENCIAS', receipt.get('incident_explanations') or [], amount_key='net_effect')}
    {line_explanation_cards(receipt.get('line_explanations') or [])}

    <section class="footer">{html_text(receipt.get('legal_footer'))}</section>
  </main>
</body>
</html>"""


def get_payroll_receipt_print_html(db: Session, payroll_id: int) -> tuple[str, str]:
    receipt = get_payroll_receipt(db, payroll_id)
    return build_payroll_receipt_print_html(receipt), payroll_receipt_filename(receipt)
