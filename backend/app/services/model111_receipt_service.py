from __future__ import annotations

from html import escape

from sqlalchemy.orm import Session

from app.services.model111_ministry_logo import MINISTRY_LOGO_DATA_URI
from app.services.model111_service import Model111DomainError, get_model111_declaration


BLUE = "#9eb6db"
DARK_BLUE = "#0b75b4"


def _money(value, *, currency: bool = False) -> str:
    amount = float(value or 0)
    formatted = f"{amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{formatted} €" if currency else formatted


def _date(value, include_time: bool = False) -> str:
    if not value:
        return "—"
    return value.strftime("%d/%m/%Y %H:%M") if include_time else value.strftime("%d/%m/%Y")


def _payment_label(method: str | None) -> str:
    return {
        "simulated_nrc": "NRC simulado",
        "direct_debit": "E.C. adeudo en cuenta simulado",
        "debt_acknowledgement": "Reconocimiento de deuda simulado",
        "negative": "Declaración negativa",
    }.get(method, method or "Pendiente de presentación")


def _box(number: str, value, *, kind: str = "money") -> str:
    if kind == "count":
        content = str(int(value or 0)) if value is not None else ""
    elif kind == "text":
        content = escape(str(value or ""))
    else:
        content = _money(value)
    return (
        '<div class="tax-box">'
        f'<span class="box-number">{escape(number)}</span>'
        f'<strong>{content}</strong>'
        '</div>'
    )


def _blank_row(start_number: int, title: str) -> str:
    return f"""
    <div class="liquidation-row">
      <div class="row-label">{escape(title)}</div>
      <div><small>N.º de perceptores</small>{_box(f'{start_number:02d}', None, kind='text')}</div>
      <div><small>Importe / valor de las percepciones</small>{_box(f'{start_number + 1:02d}', None, kind='text')}</div>
      <div><small>Importe de retenciones / ingresos a cuenta</small>{_box(f'{start_number + 2:02d}', None, kind='text')}</div>
    </div>"""


def _filled_row(start_number: int, title: str, count, base, withholding) -> str:
    return f"""
    <div class="liquidation-row">
      <div class="row-label">{escape(title)}</div>
      <div><small>N.º de perceptores</small>{_box(f'{start_number:02d}', count, kind='count')}</div>
      <div><small>Importe de las percepciones</small>{_box(f'{start_number + 1:02d}', base)}</div>
      <div><small>Importe de las retenciones</small>{_box(f'{start_number + 2:02d}', withholding)}</div>
    </div>"""


def _check(checked: bool) -> str:
    return '<span class="check">X</span>' if checked else '<span class="check"></span>'


def _form_page(declaration: dict, *, copy_label: str) -> str:
    boxes = declaration.get("payload", {}).get("boxes", {})
    presentation = declaration.get("payload", {}).get("presentation", {})
    negative = declaration.get("result_type") == "negative"
    complementary = declaration.get("declaration_type") == "complementary"
    reference = presentation.get("payment_reference") or declaration.get("nrc") or ""
    previous_receipt = declaration.get("original_declaration_id") or ""

    return f"""
<section class="sheet form-sheet">
  <div class="watermark">SIMULACIÓN EDUCATIVA · SIN VALIDEZ FISCAL</div>
  <header class="official-header">
    <div class="ministry"><img src="{MINISTRY_LOGO_DATA_URI}" alt="Ministerio de Economía y Hacienda"></div>
    <div class="agency"><div class="agency-mark">X</div><div><b>Agencia Tributaria</b><small>Entorno formativo AulaNomina</small><small>Documento simulado</small></div></div>
    <div class="form-title"><b>Retenciones e ingresos a cuenta del IRPF</b><span>Rendimientos del trabajo y de actividades económicas, premios y determinadas ganancias patrimoniales e imputaciones de renta</span><strong>Declaración - Documento de ingreso</strong></div>
    <div class="model-number"><span>Modelo</span><b>111</b></div>
  </header>

  <section class="identity-block bordered">
    <div class="vertical-label">Declarante (1)</div>
    <div class="identity-main">
      <div class="label-space">Espacio reservado para la etiqueta identificativa</div>
      <p>Si no dispone de etiquetas, consigne los datos identificativos que se solicitan a continuación.</p>
      <div class="identity-fields"><label>NIF<strong>{escape(declaration.get('company_nif') or '—')}</strong></label><label>Apellidos y nombre o razón social<strong>{escape(declaration.get('company_name') or '—')}</strong></label></div>
    </div>
    <div class="accrual">
      <div class="vertical-label compact">Devengo (2)</div>
      <div class="period-row"><label>Ejercicio <strong>{declaration['year']}</strong></label><label>Periodo <strong>{escape(declaration['period'])}</strong></label></div>
      <div class="barcode">SIM-{escape(declaration.get('receipt_number') or str(declaration['id']))}</div>
    </div>
  </section>

  <section class="liquidation bordered">
    <div class="vertical-label">Liquidación (3)</div>
    <div class="liquidation-content">
      <h3>I. Rendimientos del trabajo</h3>
      {_filled_row(1, 'Rendimientos dinerarios', boxes.get('01'), boxes.get('02'), boxes.get('03'))}
      {_blank_row(4, 'Rendimientos en especie')}

      <h3>II. Rendimientos de actividades económicas</h3>
      {_filled_row(7, 'Rendimientos dinerarios', boxes.get('07'), boxes.get('08'), boxes.get('09'))}
      {_blank_row(10, 'Rendimientos en especie')}

      <h3>III. Premios por la participación en juegos, concursos, rifas o combinaciones aleatorias</h3>
      {_blank_row(13, 'Premios en metálico')}
      {_blank_row(16, 'Premios en especie')}

      <h3>IV. Ganancias patrimoniales derivadas de los aprovechamientos forestales de los vecinos en montes públicos</h3>
      {_blank_row(19, 'Percepciones dinerarias')}
      {_blank_row(22, 'Percepciones en especie')}

      <h3>V. Contraprestaciones por la cesión de derechos de imagen</h3>
      {_blank_row(25, 'Contraprestaciones dinerarias o en especie')}

      <div class="totals">
        <b>Total liquidación:</b>
        <div><span>Suma de retenciones e ingresos a cuenta</span>{_box('28', boxes.get('28'))}</div>
        <div><span>A deducir por declaraciones anteriores</span>{_box('29', boxes.get('29'))}</div>
        <div class="result-line"><span>Resultado a ingresar (28 - 29)</span>{_box('30', boxes.get('30'))}</div>
      </div>
    </div>
  </section>

  <section class="bottom-grid">
    <div>
      <section class="income bordered"><div class="vertical-label">Ingreso (4)</div><div><p><b>Ingreso efectuado a favor del Tesoro público.</b> Simulación de cuenta restringida de colaboración.</p><div class="income-amount"><span>Importe del ingreso (casilla 30)</span><strong>{_money(boxes.get('30'), currency=True)}</strong></div><div class="payment">Forma de pago: {_check(declaration.get('payment_method') == 'simulated_nrc')} NRC simulado &nbsp; {_check(declaration.get('payment_method') == 'direct_debit')} E.C. adeudo en cuenta</div><div class="account">Referencia: <b>{escape(str(reference or 'Pendiente'))}</b></div></div></section>
      <section class="signature bordered"><div class="vertical-label">Firma (7)</div><div><p>__________________________, a _____ de __________________ de {declaration['year']}</p><p>Firma:</p></div></section>
    </div>
    <div>
      <section class="negative bordered"><div class="vertical-label">Negativa (5)</div><div>{_check(negative)} <b>Declaración negativa</b></div></section>
      <section class="complementary bordered"><div class="vertical-label">Complementaria (6)</div><div><p>Si esta declaración es complementaria de otra anterior del mismo concepto, ejercicio y periodo, indíquelo.</p><div>{_check(complementary)} <b>Declaración complementaria</b></div><p>N.º de justificante anterior: <strong>{escape(str(previous_receipt))}</strong></p></div></section>
    </div>
  </section>

  <footer class="official-footer"><span>Documento formativo no válido sin presentación real ante la AEAT.</span><b>{escape(copy_label)}</b></footer>
  <div class="simulation-strip">AULANOMINA · SIMULACIÓN EDUCATIVA · NO PRESENTADO ANTE LA AGENCIA TRIBUTARIA</div>
</section>"""


def _traceability_page(declaration: dict) -> str:
    boxes = declaration.get("payload", {}).get("boxes", {})
    presentation = declaration.get("payload", {}).get("presentation", {})
    payment_reference = presentation.get("payment_reference") or declaration.get("nrc") or "No procede"
    rows = "".join(
        f"<tr><td>{_date(line['source_date'])}</td><td>{escape(line['source_label'])}</td>"
        f"<td>{escape(line['recipient_name'])}</td><td>{escape(line.get('recipient_nif') or '—')}</td>"
        f"<td>{_money(line['base_amount'], currency=True)}</td><td>{_money(line['withholding_amount'], currency=True)}</td></tr>"
        for line in declaration.get("lines", [])
    )
    return f"""
<section class="sheet annex-sheet">
  <div class="watermark">ANEXO DE TRAZABILIDAD · SIMULACIÓN</div>
  <header class="annex-header"><div><span>AulaNomina</span><h1>Anexo formativo del Modelo 111</h1></div><div><b>{escape(declaration['period'])} {declaration['year']}</b><small>Declaración #{declaration['id']}</small></div></header>
  <section class="annex-grid">
    <span>Empresa</span><strong>{escape(declaration.get('company_name') or '—')}</strong><span>NIF</span><strong>{escape(declaration.get('company_nif') or '—')}</strong>
    <span>Estado</span><strong>{escape(declaration.get('status') or '—')}</strong><span>Presentación simulada</span><strong>{_date(declaration.get('presented_at'), True)}</strong>
    <span>N.º justificante</span><strong>{escape(declaration.get('receipt_number') or 'Pendiente')}</strong><span>CSV simulado</span><strong>{escape(declaration.get('csv') or 'Pendiente')}</strong>
    <span>Forma de ingreso</span><strong>{escape(_payment_label(declaration.get('payment_method')))}</strong><span>NRC / referencia</span><strong>{escape(str(payment_reference))}</strong>
  </section>
  <h2>Resumen de casillas declaradas</h2>
  <div class="annex-boxes">
    <div><span>01</span><b>{boxes.get('01', 0)}</b><small>Perceptores trabajo</small></div>
    <div><span>02</span><b>{_money(boxes.get('02'), currency=True)}</b><small>Percepciones trabajo</small></div>
    <div><span>03</span><b>{_money(boxes.get('03'), currency=True)}</b><small>Retenciones trabajo</small></div>
    <div><span>07</span><b>{boxes.get('07', 0)}</b><small>Perceptores profesionales</small></div>
    <div><span>08</span><b>{_money(boxes.get('08'), currency=True)}</b><small>Percepciones profesionales</small></div>
    <div><span>09</span><b>{_money(boxes.get('09'), currency=True)}</b><small>Retenciones profesionales</small></div>
    <div><span>28</span><b>{_money(boxes.get('28'), currency=True)}</b><small>Total retenciones</small></div>
    <div><span>29</span><b>{_money(boxes.get('29'), currency=True)}</b><small>Resultado anterior</small></div>
    <div><span>30</span><b>{_money(boxes.get('30'), currency=True)}</b><small>Resultado</small></div>
  </div>
  <h2>Detalle congelado de origen</h2>
  <table><thead><tr><th>Fecha</th><th>Documento</th><th>Perceptor</th><th>NIF</th><th>Base</th><th>Retención</th></tr></thead><tbody>{rows or '<tr><td colspan="6">Sin líneas de origen.</td></tr>'}</tbody></table>
  <footer>Este anexo explica al alumno de dónde procede cada cifra. No forma parte de un modelo oficial ni acredita una presentación tributaria.</footer>
</section>"""


def _render_document(declaration: dict) -> str:
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Modelo 111 simulado · {escape(declaration['period'])} {declaration['year']}</title>
<style>
:root {{ font-family: Arial, Helvetica, sans-serif; color:#111; --blue:{BLUE}; --dark-blue:{DARK_BLUE}; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:#e5e7eb; }}
.print-actions {{ position:sticky; top:0; z-index:20; display:flex; justify-content:center; gap:10px; padding:12px; background:#111827; }}
.print-actions button {{ border:2px solid #111; background:#fff7b2; padding:10px 16px; font-weight:800; cursor:pointer; }}
.sheet {{ position:relative; width:210mm; min-height:297mm; margin:12mm auto; padding:7mm; background:#fff; box-shadow:0 8px 28px rgba(0,0,0,.18); overflow:hidden; page-break-after:always; }}
.watermark {{ position:absolute; top:48%; left:8%; transform:rotate(-28deg); width:84%; text-align:center; color:rgba(177,31,31,.12); font-size:30px; font-weight:900; letter-spacing:2px; pointer-events:none; z-index:0; }}
.sheet > *:not(.watermark) {{ position:relative; z-index:1; }}
.official-header {{ display:grid; grid-template-columns:17mm 46mm 1fr 23mm; gap:2mm; align-items:stretch; margin-bottom:3mm; }}
.ministry {{ display:flex; align-items:center; justify-content:center; }}
.ministry img {{ width:16mm; height:auto; object-fit:contain; }}
.agency {{ display:flex; gap:2mm; align-items:center; padding:2mm; background:#dfe7f4; border-right:1mm solid #777; border-bottom:1mm solid #777; }}
.agency-mark {{ font-size:28px; font-weight:900; color:#222; transform:skew(-12deg); }}
.agency b {{ display:block; font-family:Georgia, serif; font-size:13px; }}
.agency small {{ display:block; font-size:7px; margin-top:1mm; }}
.form-title {{ display:flex; flex-direction:column; justify-content:center; text-align:center; padding:2mm 3mm; background:var(--dark-blue); color:white; border-right:1mm solid #777; border-bottom:1mm solid #777; }}
.form-title b {{ font-size:16px; }} .form-title span {{ font-size:9px; font-weight:700; }} .form-title strong {{ margin-top:1mm; font-size:11px; }}
.model-number {{ display:flex; flex-direction:column; justify-content:center; align-items:center; background:#e5e9ef; border-right:1mm solid #777; border-bottom:1mm solid #777; }}
.model-number span {{ font-size:8px; }} .model-number b {{ font-size:29px; letter-spacing:1px; }}
.bordered {{ border:1.2mm solid var(--blue); }}
.identity-block {{ display:grid; grid-template-columns:7mm 1fr 80mm; min-height:45mm; margin-bottom:3mm; }}
.vertical-label {{ display:flex; align-items:center; justify-content:center; writing-mode:vertical-rl; text-orientation:mixed; background:var(--blue); font-weight:800; font-size:8px; line-height:1; padding:1mm; overflow:hidden; }}
.vertical-label.compact {{ position:absolute; left:0; top:0; bottom:0; width:7mm; }}
.identity-main {{ padding:2mm; }}
.label-space {{ display:flex; align-items:center; justify-content:center; height:29mm; border:.3mm dashed #555; color:#555; font-size:8px; }}
.identity-main p {{ margin:1mm 0; font-size:7px; }}
.identity-fields {{ display:grid; grid-template-columns:45mm 1fr; border:.3mm solid #222; }}
.identity-fields label {{ min-height:8mm; padding:1mm; font-size:7px; border-right:.3mm solid #222; }}
.identity-fields label:last-child {{ border-right:0; }} .identity-fields strong {{ display:block; margin-top:1mm; font-size:9px; }}
.accrual {{ position:relative; padding-left:7mm; border-left:1.2mm solid var(--blue); }}
.period-row {{ display:flex; justify-content:center; gap:7mm; padding:5mm 2mm 2mm; border-bottom:1.2mm solid var(--blue); }}
.period-row label {{ font-size:9px; }} .period-row strong {{ display:inline-block; min-width:20mm; padding:1mm 2mm; border:.3mm solid #222; text-align:center; font-size:11px; }}
.barcode {{ height:24mm; display:flex; align-items:center; justify-content:center; font-family:monospace; font-size:8px; letter-spacing:2px; color:#555; background:repeating-linear-gradient(90deg,transparent 0 2px,#111 2px 3px,transparent 3px 6px); background-size:70% 7mm; background-repeat:no-repeat; background-position:center 70%; }}
.liquidation {{ display:grid; grid-template-columns:7mm 1fr; min-height:160mm; }}
.liquidation-content {{ padding:2.5mm; }} .liquidation h3 {{ margin:1.5mm 0 .5mm; font-size:8.5px; }}
.liquidation-row {{ display:grid; grid-template-columns:1.7fr .55fr .8fr .8fr; gap:2mm; align-items:end; min-height:10mm; }}
.row-label {{ font-size:7.5px; border-bottom:.3mm dotted #444; padding-bottom:1mm; }}
.liquidation-row small {{ display:block; text-align:center; font-size:6px; white-space:nowrap; }}
.tax-box {{ display:grid; grid-template-columns:6mm 1fr; min-height:6mm; border:.3mm solid #222; background:white; }}
.box-number {{ display:flex; align-items:center; justify-content:center; border-right:.3mm solid #222; font-size:7px; }}
.tax-box strong {{ display:flex; align-items:center; justify-content:flex-end; padding:0 1.5mm; font-size:8px; font-variant-numeric:tabular-nums; }}
.totals {{ margin:2mm -2.5mm -2.5mm; padding:2mm 2.5mm; border-top:1.2mm solid var(--blue); }}
.totals > b {{ font-size:8.5px; }} .totals > div {{ display:grid; grid-template-columns:1fr 45mm; align-items:center; gap:2mm; margin-top:1mm; font-size:7px; }} .totals .result-line {{ font-weight:800; margin-top:2mm; }}
.bottom-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:2mm; margin-top:2mm; min-height:50mm; }}
.bottom-grid > div {{ display:grid; gap:2mm; }}
.income,.signature,.negative,.complementary {{ display:grid; grid-template-columns:7mm 1fr; }}
.income > div:last-child,.signature > div:last-child,.negative > div:last-child,.complementary > div:last-child {{ padding:2mm 3mm; font-size:7px; }}
.income p,.signature p,.complementary p {{ margin:0 0 2mm; }}
.income-amount {{ display:flex; justify-content:space-between; border-bottom:.3mm dotted #444; padding-bottom:1mm; }}
.payment {{ margin-top:2mm; }} .account {{ margin-top:3mm; border:.3mm solid #222; padding:2mm; }}
.negative > div:last-child {{ display:flex; align-items:center; justify-content:center; gap:3mm; font-size:10px; }}
.check {{ display:inline-flex; width:6mm; height:6mm; align-items:center; justify-content:center; border:.4mm solid #222; font-weight:900; }}
.official-footer {{ display:flex; justify-content:space-between; margin-top:2mm; font-size:6.5px; }}
.simulation-strip {{ margin-top:1.5mm; padding:1.5mm; border:.5mm solid #b91c1c; color:#991b1b; text-align:center; font-size:7px; font-weight:900; letter-spacing:.6px; }}
.annex-header {{ display:flex; justify-content:space-between; border-bottom:4px solid #111827; padding-bottom:5mm; }}
.annex-header span {{ display:inline-block; background:#fff7b2; padding:1.5mm 2mm; font-weight:900; }} .annex-header h1 {{ margin:2mm 0 0; font-size:23px; }} .annex-header div:last-child {{ text-align:right; }} .annex-header small {{ display:block; margin-top:1mm; }}
.annex-grid {{ display:grid; grid-template-columns:35mm 1fr 35mm 1fr; gap:2mm 4mm; margin-top:7mm; padding:4mm; border:1px solid #9ca3af; font-size:9px; }} .annex-grid span {{ color:#4b5563; }} .annex-grid strong {{ overflow-wrap:anywhere; }}
.annex-sheet h2 {{ margin:8mm 0 3mm; font-size:15px; }}
.annex-boxes {{ display:grid; grid-template-columns:repeat(3,1fr); gap:3mm; }} .annex-boxes div {{ border:1px solid #9ca3af; padding:3mm; }} .annex-boxes span {{ display:inline-flex; width:8mm; height:8mm; align-items:center; justify-content:center; background:#dfe7f4; font-weight:900; }} .annex-boxes b,.annex-boxes small {{ display:block; margin-top:2mm; }} .annex-boxes small {{ color:#4b5563; }}
table {{ width:100%; border-collapse:collapse; font-size:8px; }} th,td {{ border:1px solid #9ca3af; padding:2mm; text-align:left; }} th {{ background:#e5e7eb; }}
.annex-sheet footer {{ margin-top:8mm; padding-top:4mm; border-top:1px solid #9ca3af; color:#4b5563; font-size:8px; }}
@media (max-width:900px) {{ .sheet {{ width:calc(100% - 16px); min-height:auto; margin:8px; transform-origin:top left; }} .official-header {{ grid-template-columns:15mm 38mm 1fr 20mm; }} }}
@page {{ size:A4 portrait; margin:0; }}
@media print {{ body {{ background:white; }} .print-actions {{ display:none; }} .sheet {{ margin:0; box-shadow:none; page-break-after:always; }} }}
</style>
</head>
<body>
<div class="print-actions"><button onclick="window.print()">Imprimir / guardar como PDF</button><button onclick="window.close()">Cerrar</button></div>
{_form_page(declaration, copy_label='Ejemplar simulado para el sujeto pasivo')}
{_traceability_page(declaration)}
</body>
</html>"""


def render_model111_form(db: Session, declaration_id: int) -> str:
    declaration = get_model111_declaration(db, declaration_id)
    if declaration["status"] not in {"generated", "presented"}:
        raise Model111DomainError(
            "DECLARATION_NOT_GENERATED",
            "El documento solo está disponible para declaraciones generadas o presentadas",
            status_code=409,
        )
    return _render_document(declaration)


def render_model111_receipt(db: Session, declaration_id: int) -> str:
    declaration = get_model111_declaration(db, declaration_id)
    if declaration["status"] != "presented":
        raise Model111DomainError(
            "DECLARATION_NOT_PRESENTED",
            "El justificante solo está disponible para declaraciones presentadas",
            status_code=409,
        )
    return _render_document(declaration)
