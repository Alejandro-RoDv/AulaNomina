from __future__ import annotations

from html import escape

from sqlalchemy.orm import Session

from app.services.model111_service import Model111DomainError, get_model111_declaration


def _money(value) -> str:
    amount = float(value or 0)
    formatted = f"{amount:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    return f"{formatted} €"


def _date(value, include_time: bool = False) -> str:
    if not value:
        return "—"
    return value.strftime("%d/%m/%Y %H:%M") if include_time else value.strftime("%d/%m/%Y")


def _payment_label(method: str | None) -> str:
    return {
        "simulated_nrc": "NRC simulado",
        "direct_debit": "Domiciliación bancaria simulada",
        "debt_acknowledgement": "Reconocimiento de deuda simulado",
        "negative": "Declaración negativa",
    }.get(method, method or "—")


def render_model111_receipt(db: Session, declaration_id: int) -> str:
    declaration = get_model111_declaration(db, declaration_id)
    if declaration["status"] != "presented":
        raise Model111DomainError(
            "DECLARATION_NOT_PRESENTED",
            "El justificante solo está disponible para declaraciones presentadas",
            status_code=409,
        )

    boxes = declaration.get("payload", {}).get("boxes", {})
    presentation = declaration.get("payload", {}).get("presentation", {})
    payment_reference = presentation.get("payment_reference") or declaration.get("nrc") or "No procede"
    rows = "".join(
        f"<tr><td>{escape(line['source_label'])}</td><td>{escape(line['recipient_name'])}</td>"
        f"<td>{escape(line.get('recipient_nif') or '—')}</td><td>{_money(line['base_amount'])}</td>"
        f"<td>{_money(line['withholding_amount'])}</td></tr>"
        for line in declaration.get("lines", [])
    )

    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Justificante Modelo 111 · {escape(declaration['period'])} {declaration['year']}</title>
<style>
:root {{ font-family: Inter, Arial, sans-serif; color: #111827; }}
body {{ margin: 0; background: #eef2f7; }}
main {{ width: min(980px, calc(100% - 32px)); margin: 24px auto; background: white; padding: 34px; box-sizing: border-box; box-shadow: 0 8px 30px rgba(15,23,42,.12); }}
header {{ display:flex; justify-content:space-between; gap:24px; border-bottom:4px solid #111827; padding-bottom:18px; }}
h1 {{ margin: 4px 0; font-size: 30px; }}
h2 {{ margin: 28px 0 10px; font-size: 19px; }}
.badge {{ display:inline-block; background:#fef3c7; color:#92400e; padding:5px 8px; font-size:11px; font-weight:800; }}
.status {{ text-align:right; }}
.grid {{ display:grid; grid-template-columns: 190px 1fr 190px 1fr; gap:8px 14px; margin-top:24px; }}
.grid span {{ color:#4b5563; }}
.grid strong {{ overflow-wrap:anywhere; }}
table {{ width:100%; border-collapse:collapse; font-size:13px; }}
th, td {{ border:1px solid #d1d5db; padding:8px; text-align:left; }}
th {{ background:#f3f4f6; }}
.boxes {{ display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }}
.box {{ border:1px solid #9ca3af; padding:12px; }}
.box span {{ display:block; color:#6b7280; font-size:12px; }}
.box b {{ display:block; margin-top:5px; font-size:17px; }}
.actions {{ display:flex; gap:10px; margin-bottom:20px; }}
button {{ border:2px solid #111827; background:#f8f3b5; padding:10px 14px; font-weight:800; cursor:pointer; }}
footer {{ margin-top:28px; padding-top:16px; border-top:1px solid #d1d5db; color:#6b7280; font-size:12px; }}
@media print {{ body {{ background:white; }} main {{ width:100%; margin:0; box-shadow:none; padding:18mm; }} .actions {{ display:none; }} }}
</style>
</head>
<body>
<main>
<div class="actions"><button onclick="window.print()">Imprimir / guardar como PDF</button></div>
<header>
<div><span class="badge">SIMULACIÓN EDUCATIVA · SIN VALIDEZ FISCAL</span><h1>Modelo 111</h1><div>Retenciones e ingresos a cuenta</div></div>
<div class="status"><strong>Presentación realizada</strong><br>{_date(declaration['presented_at'], True)}</div>
</header>
<section class="grid">
<span>Empresa</span><strong>{escape(declaration.get('company_name') or '—')}</strong>
<span>NIF</span><strong>{escape(declaration.get('company_nif') or '—')}</strong>
<span>Ejercicio</span><strong>{declaration['year']}</strong>
<span>Periodo</span><strong>{escape(declaration['period'])}</strong>
<span>Tipo</span><strong>{'Complementaria' if declaration['declaration_type'] == 'complementary' else 'Ordinaria'}</strong>
<span>Resultado</span><strong>{_money(declaration['result_amount'])}</strong>
<span>Forma de ingreso</span><strong>{escape(_payment_label(declaration.get('payment_method')))}</strong>
<span>Referencia</span><strong>{escape(str(payment_reference))}</strong>
<span>N.º justificante</span><strong>{escape(declaration.get('receipt_number') or '—')}</strong>
<span>CSV simulado</span><strong>{escape(declaration.get('csv') or '—')}</strong>
</section>
<h2>Casillas principales</h2>
<section class="boxes">
<div class="box"><span>01 · Perceptores trabajo</span><b>{boxes.get('01', 0)}</b></div>
<div class="box"><span>02 · Importe íntegro trabajo</span><b>{_money(boxes.get('02'))}</b></div>
<div class="box"><span>03 · Retenciones trabajo</span><b>{_money(boxes.get('03'))}</b></div>
<div class="box"><span>07 · Perceptores profesionales</span><b>{boxes.get('07', 0)}</b></div>
<div class="box"><span>08 · Importe íntegro profesionales</span><b>{_money(boxes.get('08'))}</b></div>
<div class="box"><span>09 · Retenciones profesionales</span><b>{_money(boxes.get('09'))}</b></div>
<div class="box"><span>28 · Total retenciones</span><b>{_money(boxes.get('28'))}</b></div>
<div class="box"><span>29 · Resultado anterior</span><b>{_money(boxes.get('29'))}</b></div>
<div class="box"><span>30 · Resultado</span><b>{_money(boxes.get('30'))}</b></div>
</section>
<h2>Detalle congelado de origen</h2>
<table><thead><tr><th>Documento</th><th>Perceptor</th><th>NIF</th><th>Base</th><th>Retención</th></tr></thead><tbody>{rows}</tbody></table>
<footer>Documento generado por AulaNomina para una simulación formativa. No constituye una presentación tributaria real ni un justificante emitido por la Agencia Tributaria.</footer>
</main>
</body>
</html>"""
