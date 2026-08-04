from __future__ import annotations

import html

from sqlalchemy.orm import Session

from app.models.model190 import Model190Declaration
from app.services.model190_calculator import Model190DomainError, money
from app.services.model190_declaration_service import _declaration_query, _load_json


def _escape(value) -> str:
    return html.escape(str(value or "—"))


def _money(value) -> str:
    amount = money(value)
    text = f"{amount:,.2f}"
    return text.replace(",", "_").replace(".", ",").replace("_", ".") + " €"


def render_model190_receipt(db: Session, declaration_id: int) -> str:
    item = _declaration_query(db).filter(Model190Declaration.id == declaration_id).first()
    if item is None:
        raise Model190DomainError(
            "DECLARATION_NOT_FOUND",
            "Declaración del Modelo 190 no encontrada.",
            status_code=404,
        )
    if item.status != "presented":
        raise Model190DomainError(
            "DECLARATION_NOT_PRESENTED",
            "El justificante solo está disponible para declaraciones presentadas.",
            status_code=409,
        )

    payload = _load_json(item.payload, {})
    presentation = payload.get("presentation") or {}
    signature = presentation.get("signature") or {}
    company = payload.get("company") or {}
    company_name = company.get("name") or (item.company.name if item.company else None)
    company_nif = company.get("nif") or (item.company.cif if item.company else None)
    file_sha256 = presentation.get("file_sha256") or "—"
    recipients = item.recipients or []
    rows = "".join(
        (
            "<tr>"
            f"<td>{_escape(recipient.nif)}</td>"
            f"<td>{_escape(recipient.full_name)}</td>"
            f"<td>{_escape(recipient.key)}</td>"
            f"<td>{_escape(recipient.subkey)}</td>"
            f"<td class='num'>{_money(recipient.cash_income)}</td>"
            f"<td class='num'>{_money(recipient.cash_withholding)}</td>"
            "</tr>"
        )
        for recipient in recipients[:12]
    )
    if len(recipients) > 12:
        rows += (
            "<tr><td colspan='6' class='continuation'>"
            f"Relación abreviada: {len(recipients) - 12} perceptores adicionales conservados en la declaración."
            "</td></tr>"
        )

    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Justificante simulado Modelo 190 #{item.id}</title>
<style>
  @page {{ size: A4; margin: 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }}
  .simulation {{ border: 3px solid #111; background: #fff37a; padding: 9px 12px; text-align: center; font-weight: 900; letter-spacing: .08em; }}
  header {{ display: flex; justify-content: space-between; gap: 20px; margin: 18px 0; padding-bottom: 14px; border-bottom: 3px solid #111; }}
  h1 {{ margin: 0; font-size: 25px; }}
  h2 {{ margin: 22px 0 8px; font-size: 16px; }}
  .muted {{ color: #555; }}
  .status {{ border: 2px solid #111; background: #d9f99d; padding: 8px 12px; font-weight: 900; }}
  .grid {{ display: grid; grid-template-columns: 160px 1fr 160px 1fr; border: 2px solid #111; }}
  .grid span, .grid b {{ padding: 8px 10px; border-bottom: 1px solid #aaa; }}
  .grid span {{ background: #f3f4f6; font-weight: 700; }}
  .metrics {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }}
  .metric {{ border: 2px solid #111; padding: 10px; min-height: 72px; }}
  .metric small {{ display: block; font-weight: 800; text-transform: uppercase; }}
  .metric strong {{ display: block; margin-top: 8px; font-size: 17px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th, td {{ border: 1px solid #777; padding: 6px; text-align: left; }}
  th {{ background: #f8f3b5; }}
  .num {{ text-align: right; white-space: nowrap; }}
  .signature {{ margin-top: 22px; padding: 12px; border: 2px solid #111; background: #f9fafb; }}
  .hash {{ overflow-wrap: anywhere; font-family: monospace; font-size: 10px; }}
  .continuation {{ text-align: center; color: #555; font-style: italic; }}
  footer {{ margin-top: 24px; border-top: 2px solid #111; padding-top: 10px; color: #555; font-size: 10px; }}
</style>
</head>
<body>
<div class="simulation">SIMULACIÓN EDUCATIVA · JUSTIFICANTE SIN VALIDEZ FISCAL</div>
<header>
  <div>
    <h1>Modelo 190 · Presentación simulada</h1>
    <p class="muted">Resumen anual de retenciones e ingresos a cuenta</p>
  </div>
  <div class="status">PRESENTADA</div>
</header>

<div class="grid">
  <span>Declarante</span><b>{_escape(company_name)}</b>
  <span>NIF</span><b>{_escape(company_nif)}</b>
  <span>Ejercicio</span><b>{item.year}</b>
  <span>Tipo</span><b>{_escape(item.declaration_type)}</b>
  <span>Fecha de presentación</span><b>{_escape(item.presented_at)}</b>
  <span>N.º justificante</span><b>{_escape(item.receipt_number)}</b>
  <span>CSV simulado</span><b>{_escape(item.csv)}</b>
  <span>Referencia</span><b>{_escape(item.presentation_reference)}</b>
</div>

<div class="metrics">
  <div class="metric"><small>Perceptores</small><strong>{item.total_recipients}</strong></div>
  <div class="metric"><small>Percepciones</small><strong>{_money(item.total_cash_income)}</strong></div>
  <div class="metric"><small>Retenciones</small><strong>{_money(item.total_withholding)}</strong></div>
  <div class="metric"><small>Gastos deducibles</small><strong>{_money(item.total_deductible_expenses)}</strong></div>
</div>

<h2>Resultado de la importación</h2>
<div class="grid">
  <span>Fichero</span><b>{_escape(presentation.get("filename"))}</b>
  <span>Registros leídos</span><b>{_escape(presentation.get("records_read"))}</b>
  <span>Registros correctos</span><b>{_escape(presentation.get("correct_records"))}</b>
  <span>Registros con errores</span><b>{_escape(presentation.get("error_records"))}</b>
  <span>SHA-256</span><b class="hash">{_escape(file_sha256)}</b>
  <span>Entorno</span><b>AEAT simulada de AulaNomina</b>
</div>

<h2>Relación abreviada de perceptores</h2>
<table>
<thead><tr><th>NIF</th><th>Perceptor</th><th>Clave</th><th>Subclave</th><th>Percepciones</th><th>Retenciones</th></tr></thead>
<tbody>{rows}</tbody>
</table>

<div class="signature">
  <b>Firma electrónica simulada</b>
  <p>Firmante: {_escape(signature.get("signer_name"))}</p>
  <p>Certificado: {_escape(signature.get("certificate_alias"))}</p>
</div>

<footer>
Este documento ha sido generado por AulaNomina como material didáctico. No acredita una presentación real ante la Agencia Tributaria.
</footer>
</body>
</html>"""
