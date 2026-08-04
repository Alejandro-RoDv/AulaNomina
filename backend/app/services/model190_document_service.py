from __future__ import annotations

import csv
import hashlib
import html
import io
import re
import unicodedata
import zipfile
from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.model190 import Model190Declaration, Model190Recipient
from app.services.model190_calculator import Model190DomainError, money
from app.services.model190_declaration_service import _declaration_query, _load_json


def _escape(value) -> str:
    return html.escape(str(value if value not in (None, "") else "—"))


def _money(value) -> str:
    amount = money(value)
    formatted = f"{amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{formatted} €"


def _date(value, *, include_time: bool = False) -> str:
    if not value:
        return "—"
    return value.strftime("%d/%m/%Y %H:%M") if include_time else value.strftime("%d/%m/%Y")


def _type_label(value: str) -> str:
    return {
        "ordinary": "Ordinaria",
        "complementary": "Complementaria",
        "substitutive": "Sustitutiva",
    }.get(value, value or "—")


def _status_label(value: str) -> str:
    return {
        "generated": "Generada y congelada",
        "validated": "Validada",
        "presented": "Presentada",
        "cancelled": "Cancelada",
    }.get(value, value or "—")


def _get_declaration(db: Session, declaration_id: int) -> Model190Declaration:
    item = _declaration_query(db).filter(Model190Declaration.id == declaration_id).first()
    if item is None:
        raise Model190DomainError(
            "DECLARATION_NOT_FOUND",
            "Declaración del Modelo 190 no encontrada.",
            status_code=404,
        )
    return item


def _require_presented(item: Model190Declaration) -> None:
    if item.status != "presented":
        raise Model190DomainError(
            "DECLARATION_NOT_PRESENTED",
            "Los certificados de retenciones solo están disponibles después de la presentación simulada.",
            status_code=409,
        )


def _company_data(item: Model190Declaration, payload: dict) -> dict:
    frozen = payload.get("company") or {}
    company = item.company
    return {
        "name": frozen.get("name") or (company.name if company else "—"),
        "nif": frozen.get("nif") or (company.cif if company else "—"),
        "address": frozen.get("address") or (company.address if company else None),
        "city": frozen.get("city") or (company.city if company else None),
        "province": frozen.get("province") or (company.province if company else None),
    }


def _base_css(*, landscape: bool = False) -> str:
    page_size = "A4 landscape" if landscape else "A4"
    return f"""
@page {{ size: {page_size}; margin: 14mm; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; background: #e5e7eb; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 12px; }}
.print-actions {{ position: sticky; top: 0; z-index: 20; display: flex; justify-content: center; gap: 10px; padding: 10px; background: #111827; }}
.print-actions button {{ border: 2px solid #111; background: #fff37a; padding: 9px 14px; font-weight: 900; cursor: pointer; }}
.sheet {{ position: relative; width: {'277mm' if landscape else '190mm'}; min-height: {'190mm' if landscape else '267mm'}; margin: 10mm auto; padding: 10mm; background: #fff; box-shadow: 0 8px 28px rgba(0,0,0,.18); overflow: hidden; }}
.simulation {{ border: 3px solid #111; background: #fff37a; padding: 8px 10px; text-align: center; font-weight: 900; letter-spacing: .08em; }}
header {{ display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; margin: 16px 0; padding-bottom: 12px; border-bottom: 3px solid #111; }}
h1 {{ margin: 0; font-size: 25px; }}
h2 {{ margin: 20px 0 8px; font-size: 16px; }}
h3 {{ margin: 14px 0 7px; font-size: 14px; }}
p {{ line-height: 1.45; }}
.muted {{ color: #555; }}
.status {{ border: 2px solid #111; background: #d9f99d; padding: 8px 11px; font-weight: 900; text-transform: uppercase; }}
.status.generated {{ background: #fef3c7; }}
.grid {{ display: grid; grid-template-columns: 150px 1fr 150px 1fr; border: 2px solid #111; }}
.grid span, .grid b {{ padding: 7px 9px; border-bottom: 1px solid #aaa; overflow-wrap: anywhere; }}
.grid span {{ background: #f3f4f6; font-weight: 800; }}
.metrics {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 12px; }}
.metric {{ border: 2px solid #111; padding: 10px; min-height: 72px; }}
.metric small {{ display: block; font-weight: 900; text-transform: uppercase; }}
.metric strong {{ display: block; margin-top: 7px; font-size: 17px; }}
table {{ width: 100%; border-collapse: collapse; font-size: 11px; }}
th, td {{ border: 1px solid #777; padding: 6px; text-align: left; vertical-align: top; }}
th {{ background: #f8f3b5; }}
.num {{ text-align: right; white-space: nowrap; }}
.center {{ text-align: center; }}
.hash {{ overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; }}
.notice {{ margin-top: 14px; padding: 10px; border: 2px solid #111; background: #fffcde; }}
.signature {{ margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }}
.signature-box {{ min-height: 92px; padding: 10px; border: 2px solid #111; }}
.page-break {{ page-break-before: always; }}
footer {{ margin-top: 20px; padding-top: 9px; border-top: 2px solid #111; color: #555; font-size: 10px; }}
@media print {{ body {{ background: #fff; }} .print-actions {{ display: none; }} .sheet {{ width: auto; min-height: auto; margin: 0; box-shadow: none; }} }}
"""


def _shell(title: str, body: str, *, landscape: bool = False) -> str:
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{_escape(title)}</title>
<style>{_base_css(landscape=landscape)}</style>
</head>
<body>
<div class="print-actions"><button type="button" onclick="window.print()">Imprimir / guardar PDF</button></div>
{body}
</body>
</html>"""


def _recipient_sort_key(recipient: Model190Recipient):
    return (
        recipient.nif or "",
        recipient.surname or "",
        recipient.name or "",
        recipient.key or "",
        recipient.subkey or "",
        recipient.accrual_year or 0,
    )


def render_model190_annual_summary(db: Session, declaration_id: int) -> str:
    item = _get_declaration(db, declaration_id)
    payload = _load_json(item.payload, {})
    company = _company_data(item, payload)
    presentation = payload.get("presentation") or {}
    validations = _load_json(item.validation_result, {"counts": {}})
    counts = validations.get("counts") or {}
    reconciliation = (payload.get("reconciliation") or {}).get("annual") or {}
    differences = reconciliation.get("differences") or {}
    work_diff = differences.get("work") or {}
    professional_diff = differences.get("economic_activity") or {}

    source_rows = "".join(
        "<tr>"
        f"<td>{_escape(source.get('source_type'))}</td>"
        f"<td class='center'>{_escape(source.get('documents'))}</td>"
        f"<td class='num'>{_money(source.get('gross_amount'))}</td>"
        f"<td class='num'>{_money(source.get('withholding_amount'))}</td>"
        "</tr>"
        for source in payload.get("source_summary") or []
    )
    if not source_rows:
        source_rows = "<tr><td colspan='4'>No hay desglose de orígenes conservado.</td></tr>"

    recipient_rows = "".join(
        "<tr>"
        f"<td>{_escape(recipient.nif)}</td>"
        f"<td>{_escape(recipient.full_name)}</td>"
        f"<td class='center'>{_escape(recipient.key)}</td>"
        f"<td class='center'>{_escape(recipient.subkey)}</td>"
        f"<td class='center'>{recipient.accrual_year}</td>"
        f"<td class='num'>{_money(recipient.cash_income)}</td>"
        f"<td class='num'>{_money(recipient.cash_withholding)}</td>"
        "</tr>"
        for recipient in sorted(item.recipients, key=_recipient_sort_key)[:15]
    )
    if len(item.recipients) > 15:
        recipient_rows += (
            f"<tr><td colspan='7' class='center muted'>Vista abreviada: "
            f"{len(item.recipients) - 15} líneas adicionales en la relación nominativa completa.</td></tr>"
        )

    status_class = "" if item.status == "presented" else " generated"
    body = f"""
<section class="sheet">
<div class="simulation">SIMULACIÓN EDUCATIVA · RESUMEN ANUAL SIN VALIDEZ FISCAL</div>
<header>
  <div><h1>Modelo 190 · Resumen anual</h1><p class="muted">Declaración congelada #{item.id}</p></div>
  <div class="status{status_class}">{_escape(_status_label(item.status))}</div>
</header>
<div class="grid">
  <span>Declarante</span><b>{_escape(company['name'])}</b><span>NIF</span><b>{_escape(company['nif'])}</b>
  <span>Ejercicio</span><b>{item.year}</b><span>Tipo</span><b>{_escape(_type_label(item.declaration_type))}</b>
  <span>Generación</span><b>{_date(item.generated_at, include_time=True)}</b><span>Presentación</span><b>{_date(item.presented_at, include_time=True)}</b>
  <span>N.º justificante</span><b>{_escape(item.receipt_number)}</b><span>CSV simulado</span><b>{_escape(item.csv)}</b>
</div>
<div class="metrics">
  <div class="metric"><small>Líneas de perceptor</small><strong>{item.total_recipients}</strong></div>
  <div class="metric"><small>Percepciones dinerarias</small><strong>{_money(item.total_cash_income)}</strong></div>
  <div class="metric"><small>Retenciones</small><strong>{_money(item.total_withholding)}</strong></div>
  <div class="metric"><small>Gastos deducibles</small><strong>{_money(item.total_deductible_expenses)}</strong></div>
</div>
<h2>Validación congelada</h2>
<div class="grid">
  <span>Errores bloqueantes</span><b>{counts.get('error', 0)}</b><span>Avisos</span><b>{counts.get('warning', 0)}</b>
  <span>Informaciones</span><b>{counts.get('information', 0)}</b><span>Resultado</span><b>{'Apto para generación' if validations.get('is_valid') else 'No apto'}</b>
</div>
<h2>Conciliación anual 111/190</h2>
<table>
<thead><tr><th>Bloque</th><th>Diferencia de percepciones</th><th>Diferencia de retenciones</th></tr></thead>
<tbody>
<tr><td>Rendimientos del trabajo</td><td class="num">{_money(work_diff.get('income'))}</td><td class="num">{_money(work_diff.get('withholding'))}</td></tr>
<tr><td>Actividades económicas</td><td class="num">{_money(professional_diff.get('income'))}</td><td class="num">{_money(professional_diff.get('withholding'))}</td></tr>
</tbody>
</table>
<h2>Composición por origen</h2>
<table><thead><tr><th>Origen</th><th>Documentos</th><th>Percepciones</th><th>Retenciones</th></tr></thead><tbody>{source_rows}</tbody></table>
<h2>Relación abreviada</h2>
<table><thead><tr><th>NIF</th><th>Perceptor</th><th>Clave</th><th>Subclave</th><th>Devengo</th><th>Percepciones</th><th>Retenciones</th></tr></thead><tbody>{recipient_rows}</tbody></table>
<div class="notice"><b>Trazabilidad:</b> este documento se genera únicamente desde la declaración congelada. No consulta ni recalcula nóminas o facturas actuales.</div>
<footer>Referencia de presentación: {_escape(item.presentation_reference)} · Fichero validado: {_escape(presentation.get('filename'))}</footer>
</section>"""
    return _shell(f"Modelo 190 · Resumen anual #{item.id}", body)


def render_model190_recipient_relation(db: Session, declaration_id: int) -> str:
    item = _get_declaration(db, declaration_id)
    payload = _load_json(item.payload, {})
    company = _company_data(item, payload)
    recipients = sorted(item.recipients, key=_recipient_sort_key)

    rows = "".join(
        "<tr>"
        f"<td>{index}</td>"
        f"<td>{_escape(recipient.nif)}</td>"
        f"<td>{_escape(recipient.full_name)}</td>"
        f"<td>{_escape(recipient.recipient_type)}</td>"
        f"<td class='center'>{_escape(recipient.key)}</td>"
        f"<td class='center'>{_escape(recipient.subkey)}</td>"
        f"<td class='center'>{recipient.accrual_year}</td>"
        f"<td class='center'>{_escape(recipient.province_code)}</td>"
        f"<td class='num'>{_money(recipient.cash_income)}</td>"
        f"<td class='num'>{_money(recipient.cash_withholding)}</td>"
        f"<td class='num'>{_money(recipient.deductible_expenses)}</td>"
        f"<td class='center'>{len(recipient.lines)}</td>"
        "</tr>"
        for index, recipient in enumerate(recipients, start=1)
    )

    body = f"""
<section class="sheet">
<div class="simulation">SIMULACIÓN EDUCATIVA · RELACIÓN NOMINATIVA SIN VALIDEZ FISCAL</div>
<header>
  <div><h1>Modelo 190 · Relación de perceptores</h1><p class="muted">Declaración #{item.id} · {_escape(company['name'])}</p></div>
  <div class="status{' generated' if item.status != 'presented' else ''}">{_escape(_status_label(item.status))}</div>
</header>
<div class="grid">
  <span>NIF declarante</span><b>{_escape(company['nif'])}</b><span>Ejercicio</span><b>{item.year}</b>
  <span>Tipo</span><b>{_escape(_type_label(item.declaration_type))}</b><span>Líneas</span><b>{len(recipients)}</b>
</div>
<h2>Detalle completo congelado</h2>
<table>
<thead><tr><th>#</th><th>NIF</th><th>Perceptor</th><th>Tipo</th><th>Clave</th><th>Sub.</th><th>Devengo</th><th>Prov.</th><th>Percepciones</th><th>Retenciones</th><th>Gastos</th><th>Docs.</th></tr></thead>
<tbody>{rows or '<tr><td colspan="12">Sin perceptores.</td></tr>'}</tbody>
<tfoot><tr><th colspan="8">Totales declarados</th><th class="num">{_money(item.total_cash_income)}</th><th class="num">{_money(item.total_withholding)}</th><th class="num">{_money(item.total_deductible_expenses)}</th><th>{sum(len(recipient.lines) for recipient in recipients)}</th></tr></tfoot>
</table>
<footer>Documento generado desde el snapshot anual. Los perceptores con el mismo NIF pueden aparecer en varias líneas cuando cambian la clave, subclave o el ejercicio de devengo.</footer>
</section>"""
    return _shell(f"Modelo 190 · Perceptores #{item.id}", body, landscape=True)


def _group_recipients(item: Model190Declaration) -> dict[str, list[Model190Recipient]]:
    groups: dict[str, list[Model190Recipient]] = defaultdict(list)
    for recipient in sorted(item.recipients, key=_recipient_sort_key):
        groups[recipient.nif or "SIN-NIF"].append(recipient)
    return dict(groups)


def _certificate_rows(recipients: list[Model190Recipient]) -> str:
    return "".join(
        "<tr>"
        f"<td>{_escape(recipient.key)}</td>"
        f"<td>{_escape(recipient.subkey)}</td>"
        f"<td>{recipient.accrual_year}</td>"
        f"<td class='num'>{_money(recipient.cash_income)}</td>"
        f"<td class='num'>{_money(recipient.cash_withholding)}</td>"
        f"<td class='num'>{_money(recipient.deductible_expenses)}</td>"
        f"<td class='num'>{_money(recipient.in_kind_income)}</td>"
        "</tr>"
        for recipient in recipients
    )


def _certificate_html(item: Model190Declaration, recipients: list[Model190Recipient], *, actions: bool) -> str:
    payload = _load_json(item.payload, {})
    company = _company_data(item, payload)
    presentation = payload.get("presentation") or {}
    signature = presentation.get("signature") or {}
    primary = recipients[0]
    total_cash = sum((money(recipient.cash_income) for recipient in recipients), Decimal("0.00"))
    total_withholding = sum((money(recipient.cash_withholding) for recipient in recipients), Decimal("0.00"))
    total_expenses = sum((money(recipient.deductible_expenses) for recipient in recipients), Decimal("0.00"))
    total_in_kind = sum((money(recipient.in_kind_income) for recipient in recipients), Decimal("0.00"))
    certificate_code = f"CERT-190-{item.year}-{item.id}-{primary.nif}"

    body = f"""
<section class="sheet">
<div class="simulation">SIMULACIÓN EDUCATIVA · CERTIFICADO SIN VALIDEZ FISCAL</div>
<header>
  <div><h1>Certificado de retenciones e ingresos a cuenta</h1><p class="muted">Ejercicio {item.year} · Modelo 190 simulado</p></div>
  <div class="status">EMITIDO</div>
</header>
<div class="grid">
  <span>Pagador</span><b>{_escape(company['name'])}</b><span>NIF pagador</span><b>{_escape(company['nif'])}</b>
  <span>Perceptor</span><b>{_escape(primary.full_name)}</b><span>NIF perceptor</span><b>{_escape(primary.nif)}</b>
  <span>Declaración</span><b>#{item.id} · {_escape(_type_label(item.declaration_type))}</b><span>Presentada</span><b>{_date(item.presented_at, include_time=True)}</b>
  <span>N.º justificante</span><b>{_escape(item.receipt_number)}</b><span>CSV simulado</span><b>{_escape(item.csv)}</b>
</div>
<p>La entidad pagadora indicada certifica, exclusivamente a efectos de la simulación educativa de AulaNomina, que durante el ejercicio señalado satisfizo al perceptor las cantidades recogidas a continuación y practicó las correspondientes retenciones.</p>
<div class="metrics">
  <div class="metric"><small>Percepciones dinerarias</small><strong>{_money(total_cash)}</strong></div>
  <div class="metric"><small>Retenciones</small><strong>{_money(total_withholding)}</strong></div>
  <div class="metric"><small>Gastos deducibles</small><strong>{_money(total_expenses)}</strong></div>
  <div class="metric"><small>Percepciones en especie</small><strong>{_money(total_in_kind)}</strong></div>
</div>
<h2>Desglose fiscal anual</h2>
<table><thead><tr><th>Clave</th><th>Subclave</th><th>Devengo</th><th>Percepciones</th><th>Retenciones</th><th>Gastos deducibles</th><th>En especie</th></tr></thead><tbody>{_certificate_rows(recipients)}</tbody></table>
<div class="signature">
  <div class="signature-box"><b>Firma del pagador</b><p>Firmante de la presentación: {_escape(signature.get('signer_name'))}</p><p>Certificado: {_escape(signature.get('certificate_alias'))}</p></div>
  <div class="signature-box"><b>Control documental</b><p>Código: {_escape(certificate_code)}</p><p>Referencia: {_escape(item.presentation_reference)}</p><p class="hash">SHA-256 fichero: {_escape(presentation.get('file_sha256'))}</p></div>
</div>
<div class="notice">Este certificado reproduce datos congelados en una declaración simulada. No acredita retenciones reales ni sustituye al certificado fiscal emitido por una empresa.</div>
<footer>Emitido con fecha de la presentación simulada: {_date(item.presented_at)}.</footer>
</section>"""
    if actions:
        return _shell(f"Certificado Modelo 190 · {primary.nif}", body)
    return f"<!doctype html><html lang='es'><head><meta charset='utf-8'><title>{_escape(certificate_code)}</title><style>{_base_css()}</style></head><body>{body}</body></html>"


def _certificate_group_for_recipient(item: Model190Declaration, recipient_id: int) -> list[Model190Recipient]:
    selected = next((recipient for recipient in item.recipients if recipient.id == recipient_id), None)
    if selected is None:
        raise Model190DomainError(
            "RECIPIENT_NOT_FOUND",
            "El perceptor no pertenece a la declaración indicada.",
            status_code=404,
        )
    return [recipient for recipient in item.recipients if recipient.nif == selected.nif]


def render_model190_certificate(db: Session, declaration_id: int, recipient_id: int) -> str:
    item = _get_declaration(db, declaration_id)
    _require_presented(item)
    recipients = _certificate_group_for_recipient(item, recipient_id)
    return _certificate_html(item, recipients, actions=True)


def render_model190_certificate_directory(db: Session, declaration_id: int) -> str:
    item = _get_declaration(db, declaration_id)
    _require_presented(item)
    groups = _group_recipients(item)
    rows = []
    for nif, recipients in groups.items():
        primary = recipients[0]
        total_income = sum((money(recipient.cash_income) for recipient in recipients), Decimal("0.00"))
        total_withholding = sum((money(recipient.cash_withholding) for recipient in recipients), Decimal("0.00"))
        rows.append(
            "<tr>"
            f"<td>{_escape(nif)}</td><td>{_escape(primary.full_name)}</td>"
            f"<td class='center'>{len(recipients)}</td>"
            f"<td class='num'>{_money(total_income)}</td><td class='num'>{_money(total_withholding)}</td>"
            f"<td><a href='/model-190/declarations/{item.id}/certificates/{primary.id}' target='_blank' rel='noopener'>Abrir certificado</a></td>"
            "</tr>"
        )

    body = f"""
<section class="sheet">
<div class="simulation">SIMULACIÓN EDUCATIVA · DIRECTORIO DE CERTIFICADOS</div>
<header><div><h1>Certificados de retenciones</h1><p class="muted">Modelo 190 #{item.id} · Ejercicio {item.year}</p></div><div class="status">{len(groups)} CERTIFICADOS</div></header>
<p>Cada certificado agrupa todas las líneas del mismo NIF, incluidas claves, subclaves o ejercicios de devengo diferentes.</p>
<table><thead><tr><th>NIF</th><th>Perceptor</th><th>Líneas</th><th>Percepciones</th><th>Retenciones</th><th>Documento</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
<div class="notice"><a href="/model-190/declarations/{item.id}/certificates.zip">Descargar lote ZIP con todos los certificados</a></div>
<footer>Documentos generados desde la declaración presentada y congelada.</footer>
</section>"""
    return _shell(f"Certificados Modelo 190 #{item.id}", body, landscape=True)


def _safe_filename(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = "".join(character for character in normalized if not unicodedata.combining(character))
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", ascii_value).strip("-._")
    return cleaned[:90] or "perceptor"


def build_model190_certificates_archive(db: Session, declaration_id: int) -> dict:
    item = _get_declaration(db, declaration_id)
    _require_presented(item)
    groups = _group_recipients(item)
    buffer = io.BytesIO()
    manifest_buffer = io.StringIO()
    writer = csv.writer(manifest_buffer, delimiter=";")
    writer.writerow(
        [
            "NIF",
            "Perceptor",
            "Lineas",
            "Percepciones",
            "Retenciones",
            "Gastos_deducibles",
            "Fichero",
        ]
    )

    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for nif, recipients in groups.items():
            primary = recipients[0]
            filename = f"certificado-190-{item.year}-{_safe_filename(nif)}-{_safe_filename(primary.full_name)}.html"
            certificate = _certificate_html(item, recipients, actions=False)
            archive.writestr(filename, certificate.encode("utf-8"))
            writer.writerow(
                [
                    nif,
                    primary.full_name,
                    len(recipients),
                    format(sum((money(recipient.cash_income) for recipient in recipients), Decimal("0.00")), "f"),
                    format(sum((money(recipient.cash_withholding) for recipient in recipients), Decimal("0.00")), "f"),
                    format(sum((money(recipient.deductible_expenses) for recipient in recipients), Decimal("0.00")), "f"),
                    filename,
                ]
            )
        archive.writestr("manifest-certificados.csv", manifest_buffer.getvalue().encode("utf-8-sig"))
        archive.writestr(
            "LEEME.txt",
            (
                "AulaNomina - Certificados Modelo 190\n"
                "SIMULACION EDUCATIVA - SIN VALIDEZ FISCAL\n"
                f"Declaracion: {item.id}\nEjercicio: {item.year}\n"
                f"Certificados: {len(groups)}\n"
            ).encode("utf-8"),
        )

    content = buffer.getvalue()
    company_nif = item.company.cif if item.company else "empresa"
    return {
        "filename": f"certificados-modelo-190-{item.year}-{_safe_filename(company_nif)}-simulados.zip",
        "content": content,
        "certificate_count": len(groups),
        "sha256": hashlib.sha256(content).hexdigest(),
    }
