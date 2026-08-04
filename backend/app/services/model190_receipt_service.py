from __future__ import annotations

import html
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.model190 import Model190Declaration
from app.services.model190_calculator import Model190DomainError, money
from app.services.model190_declaration_service import _declaration_query, _load_json
from app.services.model190_receipt_assets import MINISTRY_LOGO_DATA_URI
from app.services.model190_receipt_styles import MODEL190_RECEIPT_CSS


def _escape(value, fallback: str = "") -> str:
    if value is None or value == "":
        return fallback
    return html.escape(str(value))


def _money(value) -> str:
    amount = money(value)
    text = f"{amount:,.2f}"
    return text.replace(",", "_").replace(".", ",").replace("_", ".")


def _date(value) -> str:
    if not value:
        return ""
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return _escape(value)
    return value.strftime("%d/%m/%Y")


def _mark(active: bool) -> str:
    return "X" if active else ""


def _sheet(
    *,
    item: Model190Declaration,
    presentation: dict,
    signature: dict,
    company_name: str,
    company_nif: str,
    contact_name: str,
    contact_phone: str,
    original_identifier: str,
    copy_label: str,
) -> str:
    total_income = money(item.total_cash_income) + money(item.total_in_kind_income)
    declaration_type = item.declaration_type or "ordinary"
    admin_details = f"""
      <div class="admin-stamp">SIMULACIÓN EDUCATIVA · JUSTIFICANTE SIN VALIDEZ FISCAL</div>
      <dl class="admin-data">
        <dt>N.º justificante</dt><dd>{_escape(item.receipt_number)}</dd>
        <dt>CSV simulado</dt><dd>{_escape(item.csv)}</dd>
        <dt>Referencia AulaNomina</dt><dd>{_escape(item.presentation_reference)}</dd>
        <dt>Registros validados</dt><dd>{_escape(presentation.get('correct_records'))} / {_escape(presentation.get('records_read'))}</dd>
        <dt>Huella SHA-256</dt><dd class="hash">{_escape(presentation.get('file_sha256'))}</dd>
      </dl>
    """

    return f"""
<section class="sheet">
  <div class="watermark">SIMULACIÓN EDUCATIVA</div>

  <header class="official-header">
    <div class="ministry-block">
      <img src="{MINISTRY_LOGO_DATA_URI}" alt="Ministerio de Economía y Hacienda">
    </div>
    <div class="agency-block">
      <div class="agency-mark" aria-hidden="true"><i></i><i></i></div>
      <div>
        <strong>Agencia Tributaria</strong>
        <span>Teléfono: 901 33 55 33</span>
        <span>www.agenciatributaria.es</span>
      </div>
    </div>
    <div class="title-block">
      <strong>Retenciones e ingresos a cuenta del IRPF</strong>
      <span>Rendimientos del trabajo y de actividades económicas, premios y determinadas ganancias patrimoniales e imputaciones de renta</span>
      <b>Resumen anual</b>
    </div>
    <div class="model-block">
      <span>Hoja Resumen</span>
      <small>Modelo</small>
      <strong>190</strong>
    </div>
  </header>

  <div class="top-grid">
    <div class="left-column">
      <fieldset class="box declarant-box">
        <legend>Declarante</legend>
        <div class="label-space">
          <b>Espacio reservado para la etiqueta identificativa del declarante.</b>
          <span>Si no dispone de etiquetas, consigne los datos identificativos que se solicitan a continuación.</span>
        </div>
        <label>N.º de identificación fiscal (NIF)<span class="field short">{_escape(company_nif)}</span></label>
        <label>Apellidos y nombre, denominación o razón social del declarante<span class="field">{_escape(company_name)}</span></label>
      </fieldset>

      <fieldset class="box contact-box">
        <legend>Persona y teléfono de contacto</legend>
        <label>Apellidos y nombre de la persona con quien relacionarse<span class="field">{_escape(contact_name)}</span></label>
        <label>Teléfono de contacto<span class="field short">{_escape(contact_phone)}</span></label>
      </fieldset>
    </div>

    <div class="right-column">
      <div class="dotted-space"></div>
      <fieldset class="box exercise-box">
        <legend>Ejercicio</legend>
        <div class="exercise-line"><span>Ejercicio (con 4 cifras)</span><b>{item.year}</b></div>
      </fieldset>
      <fieldset class="box mode-box">
        <legend>Modalidad de presentación</legend>
        <p>Indique, consignando una “X” en la casilla correspondiente, la modalidad de presentación.</p>
        <div class="mode-row"><b>Papel:</b><span>Impreso generado informáticamente</span><i></i></div>
        <div class="mode-row"><b></b><span>Declaración cumplimentada en formulario preimpreso</span><i></i></div>
        <div class="mode-row"><b></b><span>Soporte directamente legible por ordenador</span><i class="checked">X</i></div>
      </fieldset>
    </div>
  </div>

  <fieldset class="box summary-box">
    <legend>Resumen de los datos incluidos en la declaración</legend>
    <div class="summary-row"><b>Número total de percepciones relacionadas en la declaración</b><span class="dots"></span><em>01</em><strong>{item.total_recipients}</strong></div>
    <div class="summary-row"><b>Importe total de las percepciones relacionadas</b><span class="dots"></span><em>02</em><strong>{_money(total_income)}</strong></div>
    <div class="summary-row"><b>Importe total de las retenciones e ingresos a cuenta relacionados</b><span class="dots"></span><em>03</em><strong>{_money(item.total_withholding)}</strong></div>
    <p class="footnote">(1) Se computa cada apunte o registro de percepción, incluso cuando una misma persona figure en distintas claves o ejercicios de devengo.</p>
  </fieldset>

  <fieldset class="box declaration-box">
    <legend>Declaración complementaria o sustitutiva</legend>
    <p>Marque el carácter de la declaración cuando incluya percepciones omitidas o sustituya por completo una declaración anterior del mismo ejercicio.</p>
    <div class="declaration-grid">
      <label>Declaración complementaria <i>{_mark(declaration_type == 'complementary')}</i></label>
      <label>Número identificativo de la declaración anterior <span class="field identifier">{_escape(original_identifier)}</span></label>
      <label>Declaración sustitutiva <i>{_mark(declaration_type == 'substitutive')}</i></label>
    </div>
  </fieldset>

  <div class="bottom-grid">
    <fieldset class="box signature-box">
      <legend>Fecha y firma</legend>
      <label>Fecha:<span class="field">{_date(item.presented_at)}</span></label>
      <div class="signature-space">
        <span>Firma del declarante o de su representante:</span>
        <b>Firma electrónica simulada</b>
        <small>{_escape(signature.get('certificate_alias'), 'Certificado AulaNomina')}</small>
      </div>
      <label>Fdo.: D. / D.ª<span class="signature-line">{_escape(signature.get('signer_name'))}</span></label>
      <label>Cargo o empleo:<span class="signature-line">Responsable de la presentación</span></label>
    </fieldset>

    <fieldset class="box administration-box">
      <legend>Espacio reservado para la Administración</legend>
      {admin_details}
    </fieldset>
  </div>

  <footer>
    <span>Ver. educativa AulaNomina</span>
    <b>Hoja Resumen. {copy_label}</b>
  </footer>
</section>
"""


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
    company_payload = payload.get("company") or {}
    company = item.company
    company_name = company_payload.get("name") or (company.name if company else "")
    company_nif = company_payload.get("nif") or (company.cif if company else "")
    contact_name = (
        getattr(company, "company_contact_person", None)
        or signature.get("signer_name")
        or ""
    )
    contact_phone = getattr(company, "company_phone", None) or ""

    original_identifier = ""
    if item.original_declaration_id:
        original = (
            db.query(Model190Declaration)
            .filter(Model190Declaration.id == item.original_declaration_id)
            .first()
        )
        if original is not None:
            original_identifier = original.receipt_number or str(original.id)

    sheets = "".join(
        [
            _sheet(
                item=item,
                presentation=presentation,
                signature=signature,
                company_name=company_name,
                company_nif=company_nif,
                contact_name=contact_name,
                contact_phone=contact_phone,
                original_identifier=original_identifier,
                copy_label="Ejemplar para la Administración",
            ),
            _sheet(
                item=item,
                presentation=presentation,
                signature=signature,
                company_name=company_name,
                company_nif=company_nif,
                contact_name=contact_name,
                contact_phone=contact_phone,
                original_identifier=original_identifier,
                copy_label="Ejemplar para el interesado",
            ),
        ]
    )

    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Modelo 190 · Hoja Resumen · {_escape(item.receipt_number)}</title>
<style>
{MODEL190_RECEIPT_CSS}
</style>
</head>
<body>{sheets}</body>
</html>"""
