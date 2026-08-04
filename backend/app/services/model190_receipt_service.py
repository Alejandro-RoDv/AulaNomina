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

    return f"""
<section class="sheet">
  <div class="watermark">SIMULACIÓN EDUCATIVA</div>
  <div class="page-content">
    <header class="official-header">
      <div class="ministry">
        <img src="{MINISTRY_LOGO_DATA_URI}" alt="Ministerio de Economía y Hacienda">
      </div>
      <div class="agency">
        <div class="agency-logo" aria-hidden="true"></div>
        <div>
          <strong>Agencia Tributaria</strong>
          <span>Teléfono: 901 33 55 33</span>
          <span>www.agenciatributaria.es</span>
        </div>
      </div>
      <div class="main-title">
        <strong>Retenciones e ingresos a cuenta del IRPF</strong>
        <span>Rendimientos del trabajo y de actividades económicas, premios y determinadas ganancias patrimoniales e imputaciones de renta</span>
        <b>Resumen anual</b>
      </div>
      <div class="model">
        <span>Hoja Resumen</span>
        <small>Modelo</small>
        <strong>190</strong>
      </div>
    </header>

    <div class="top-grid">
      <div class="left-stack">
        <fieldset class="box declarant-box">
          <legend>Declarante</legend>
          <div class="label-space">
            <b>Espacio reservado para la etiqueta identificativa del declarante.</b>
            Si no dispone de etiquetas, consigne los datos identificativos que se solicitan a continuación y adjunte a la declaración una fotocopia del documento acreditativo de su número de identificación fiscal (NIF).
          </div>
          <span class="data-label">N.º de identificación fiscal (NIF)
            <span class="entry short">{_escape(company_nif)}</span>
          </span>
          <span class="data-label">Apellidos y nombre (por este orden), denominación o razón social del declarante
            <span class="entry">{_escape(company_name)}</span>
          </span>
        </fieldset>

        <fieldset class="box contact-box">
          <legend>Persona y teléfono de contacto</legend>
          <span class="data-label">Apellidos y nombre (por este orden) de la persona con quien relacionarse
            <span class="entry">{_escape(contact_name)}</span>
          </span>
          <span class="data-label">Teléfono de contacto
            <span class="entry short">{_escape(contact_phone)}</span>
          </span>
        </fieldset>
      </div>

      <div class="right-stack">
        <div class="dotted-space" aria-hidden="true"></div>

        <fieldset class="box exercise-box">
          <legend>Ejercicio</legend>
          <div class="exercise-line">
            <span>Ejercicio (con 4 cifras)</span>
            <b>{item.year}</b>
          </div>
        </fieldset>

        <fieldset class="box mode-box">
          <legend>Modalidad de presentación</legend>
          <p>Indique, consignando una “X” en la casilla correspondiente, la modalidad de presentación de esta declaración.</p>
          <div class="mode-grid">
            <b>Papel:</b>
            <div class="mode-brace" aria-hidden="true">{{</div>
            <div class="mode-label">Impreso generado informáticamente mediante el módulo de impresión desarrollado por la Agencia Tributaria</div>
            <i class="check-box"></i>
            <div class="mode-label">Declaración cumplimentada en el modelo o formulario preimpreso</div>
            <i class="check-box"></i>
            <div class="support-mode">Soporte directamente legible por ordenador (CD-R) ...</div>
            <i class="check-box">X</i>
          </div>
        </fieldset>
      </div>
    </div>

    <fieldset class="box summary-box">
      <legend>Resumen de los datos incluidos en la declaración</legend>
      <div class="summary-row">
        <b>Número total de percepciones relacionadas en la declaración (1)</b>
        <span class="dots"></span>
        <em class="field-code">01</em>
        <strong class="amount-field">{item.total_recipients}</strong>
      </div>
      <div class="summary-row">
        <b>Importe total de las percepciones relacionadas</b>
        <span class="dots"></span>
        <em class="field-code">02</em>
        <strong class="amount-field">{_money(total_income)}</strong>
      </div>
      <div class="summary-row">
        <b>Importe total de las retenciones e ingresos a cuenta relacionados</b>
        <span class="dots"></span>
        <em class="field-code">03</em>
        <strong class="amount-field">{_money(item.total_withholding)}</strong>
      </div>
      <p class="footnote">(1) Consigne el número total de los apuntes o registros de percepción contenidos en las hojas interiores de esta declaración o en el soporte. En el caso de que una misma persona o entidad haya sido incluida más de una vez, en la misma o en diferentes claves de percepción, se computarán tantas percepciones como veces haya sido relacionada.</p>
    </fieldset>

    <fieldset class="box declaration-box">
      <legend>Declaración complementaria o sustitutiva</legend>
      <p>Si la presentación de esta declaración tiene por objeto incluir percepciones que, debiendo haber sido relacionadas en otra declaración del mismo ejercicio presentada anteriormente, hubieran sido completamente omitidas en la misma, se marcará con “X” la casilla “Declaración complementaria”.</p>
      <p>Cuando la presentación de esta declaración tenga por objeto anular y sustituir por completo a otra declaración del mismo ejercicio presentada anteriormente, en la cual se hubieran consignado datos inexactos o erróneos, se indicará su carácter de declaración sustitutiva.</p>
      <p>En ambos casos, se hará constar el número de 13 dígitos identificativo de la declaración del mismo ejercicio anteriormente presentada o el de la última de ellas, si se hubieran presentado varias.</p>
      <div class="declaration-actions">
        <span class="declaration-label">Declaración complementaria</span>
        <i class="check-box">{_mark(declaration_type == 'complementary')}</i>
        <span class="previous-label">Número identificativo de la declaración anterior</span>
        <span class="identifier-field">{_escape(original_identifier)}</span>
        <span class="declaration-label">Declaración sustitutiva</span>
        <i class="check-box">{_mark(declaration_type == 'substitutive')}</i>
      </div>
    </fieldset>

    <div class="bottom-grid">
      <fieldset class="box signature-box">
        <legend>Fecha y firma</legend>
        <div class="date-row">
          <span>Fecha:</span>
          <span class="date-field">{_date(item.presented_at)}</span>
        </div>
        <div class="signature-area">
          <span>Firma del declarante o de su representante:</span>
          <span class="simulated-signature">Firma electrónica simulada</span>
          <span class="signature-line">Fdo.: D. / D.ª {_escape(signature.get('signer_name'))}</span>
          <span class="signature-line">Cargo o empleo: Responsable de la presentación</span>
        </div>
      </fieldset>

      <fieldset class="box administration-box">
        <legend>Espacio reservado para la Administración</legend>
        <div class="administration-inner">
          <div class="admin-stamp">SIMULACIÓN EDUCATIVA · JUSTIFICANTE SIN VALIDEZ FISCAL</div>
          <div class="admin-data">
            <span>N.º justificante</span><b>{_escape(item.receipt_number)}</b>
            <span>CSV simulado</span><b>{_escape(item.csv)}</b>
            <span>Referencia AulaNomina</span><b>{_escape(item.presentation_reference)}</b>
            <span>Registros validados</span><b>{_escape(presentation.get('correct_records'))} / {_escape(presentation.get('records_read'))}</b>
            <span>Huella SHA-256</span><b class="hash">{_escape(presentation.get('file_sha256'))}</b>
            <span>Certificado</span><b>{_escape(signature.get('certificate_alias'), 'Certificado AulaNomina')}</b>
          </div>
        </div>
      </fieldset>
    </div>
  </div>

  <footer class="page-footer">
    <span>Ver. educativa AulaNomina</span>
    <strong>Hoja Resumen. {copy_label}</strong>
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
        (
            _sheet(
                item=item,
                presentation=presentation,
                signature=signature,
                company_name=company_name,
                company_nif=company_nif,
                contact_name=contact_name,
                contact_phone=contact_phone,
                original_identifier=original_identifier,
                copy_label=copy_label,
            )
            for copy_label in (
                "Ejemplar para la Administración",
                "Ejemplar para el interesado",
            )
        )
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
