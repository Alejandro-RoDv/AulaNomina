from __future__ import annotations

MODEL190_RECEIPT_CSS = r"""
@page {
  size: A4 portrait;
  margin: 0;
}

* {
  box-sizing: border-box;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}

html {
  background: #e8ebef;
}

body {
  margin: 0;
  color: #111111;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8.6px;
}

.sheet {
  position: relative;
  width: 210mm;
  height: 297mm;
  margin: 8mm auto;
  padding: 5.5mm 6mm 4.5mm;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 2mm 5mm rgba(0, 0, 0, 0.22);
  page-break-after: always;
}

.sheet:last-child {
  page-break-after: auto;
}

.page-content {
  position: relative;
  z-index: 1;
}

.watermark {
  position: absolute;
  left: 22mm;
  bottom: 130mm;
  z-index: 0;
  color: rgba(160, 0, 0, 0.055);
  font-size: 31px;
  font-weight: 900;
  letter-spacing: 0.18em;
  transform: rotate(-27deg);
  white-space: nowrap;
}

.official-header {
  display: grid;
  grid-template-columns: 20mm 49mm 1fr 25mm;
  gap: 2mm;
  height: 27mm;
  margin-bottom: 4mm;
}

.ministry {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ministry img {
  max-width: 19mm;
  max-height: 24mm;
  object-fit: contain;
}

.agency {
  display: grid;
  grid-template-columns: 12mm 1fr;
  align-items: start;
  padding: 2.5mm;
  border-right: 0.35mm solid #575757;
  border-bottom: 0.35mm solid #575757;
  background: #d8e0ef;
  box-shadow: 1mm 1mm 0 #999999;
}

.agency-logo {
  position: relative;
  width: 11mm;
  height: 11mm;
  margin-top: 1mm;
}

.agency-logo::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  border-top: 5.7mm solid transparent;
  border-bottom: 5.7mm solid transparent;
  border-right: 7.3mm solid #383838;
}

.agency-logo::after {
  content: "";
  position: absolute;
  right: 0;
  top: 0.3mm;
  border-top: 5.5mm solid transparent;
  border-bottom: 5.5mm solid transparent;
  border-left: 7mm solid #858a91;
}

.agency strong {
  display: block;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.1;
}

.agency span {
  display: block;
  margin-top: 1.7mm;
  font-size: 8px;
}

.main-title {
  display: grid;
  align-content: center;
  gap: 1.4mm;
  padding: 2.3mm 3mm;
  border: 0.45mm solid #0b5793;
  background: #0d69b2;
  color: #ffffff;
  text-align: center;
  box-shadow: 1mm 1mm 0 #888888;
}

.main-title strong {
  font-size: 14.2px;
  line-height: 1.05;
}

.main-title span {
  font-size: 8.6px;
  font-weight: 700;
  line-height: 1.22;
}

.main-title b {
  font-size: 13.7px;
}

.model {
  display: grid;
  grid-template-rows: 7mm 1fr;
  border: 0.35mm solid #666666;
  background: #d8e0ef;
  text-align: center;
  box-shadow: 1mm 1mm 0 #888888;
}

.model > span {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d69b2;
  color: #ffffff;
  font-size: 8px;
  font-weight: 700;
}

.model small {
  align-self: end;
  font-size: 8px;
}

.model strong {
  align-self: start;
  font-size: 26px;
  line-height: 0.95;
}

.top-grid {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 2.6mm;
}

.left-stack,
.right-stack {
  display: grid;
  gap: 2.3mm;
  align-content: start;
}

.box {
  min-width: 0;
  margin: 0;
  padding: 3.2mm 3.5mm 2.7mm;
  border: 0.35mm solid #111111;
  background: #d6deef;
}

.box legend {
  padding: 0.7mm 5mm;
  border: 0.35mm solid #111111;
  background: #5d8fc6;
  color: #ffffff;
  font-size: 8.6px;
  font-weight: 700;
  line-height: 1;
}

.declarant-box {
  height: 52mm;
}

.contact-box {
  height: 27mm;
}

.label-space {
  height: 22.5mm;
  padding: 4mm;
  border: 0.3mm dashed #555555;
  background: #ffffff;
  text-align: center;
  font-size: 6.7px;
  line-height: 1.35;
}

.label-space b {
  display: block;
  margin-bottom: 2mm;
  font-size: 7px;
}

.data-label {
  display: block;
  margin-top: 2.2mm;
  font-size: 6.8px;
}

.entry {
  display: block;
  min-height: 5.3mm;
  margin-top: 0.8mm;
  padding: 1mm 1.4mm;
  border-bottom: 0.3mm solid #777777;
  background: #ffffff;
  box-shadow: 0.8mm 0.8mm 0 #aaaaaa;
  font-size: 8.5px;
  font-weight: 700;
}

.entry.short {
  width: 36mm;
  letter-spacing: 0.08em;
}

.dotted-space {
  height: 19mm;
  border: 0.3mm dashed #666666;
  background: #ffffff;
}

.exercise-box {
  height: 13mm;
}

.exercise-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4mm;
}

.exercise-line span::after {
  content: " ................................";
  letter-spacing: 0.06em;
}

.exercise-line b {
  min-width: 17mm;
  padding: 1.6mm 2mm;
  background: #ffffff;
  box-shadow: 0.8mm 0.8mm 0 #aaaaaa;
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.18em;
}

.mode-box {
  height: 39mm;
}

.mode-box p {
  margin: 0 0 2mm;
  font-size: 7px;
  line-height: 1.3;
}

.mode-grid {
  display: grid;
  grid-template-columns: 14mm 5mm 1fr 5mm;
  column-gap: 1.5mm;
  row-gap: 1.2mm;
  align-items: center;
}

.mode-brace {
  grid-row: 1 / 3;
  font-size: 23px;
  line-height: 1;
  text-align: center;
}

.mode-label {
  font-size: 7px;
  line-height: 1.2;
}

.mode-label::after {
  content: " ........................";
  letter-spacing: 0.04em;
}

.check-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5mm;
  height: 4.5mm;
  background: #ffffff;
  box-shadow: 0.8mm 0.8mm 0 #aaaaaa;
  font-style: normal;
  font-weight: 900;
}

.support-mode {
  grid-column: 1 / 4;
  margin-top: 1mm;
  font-weight: 700;
}

.summary-box {
  height: 37mm;
  margin-top: 2.5mm;
}

.summary-row {
  display: grid;
  grid-template-columns: auto 1fr 5mm 29mm;
  gap: 1.2mm;
  align-items: end;
  margin: 1.5mm 0;
}

.summary-row b {
  font-size: 8.3px;
}

.dots {
  margin-bottom: 1.6mm;
  border-bottom: 0.3mm dotted #111111;
}

.field-code {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 4.5mm;
  background: #5d8fc6;
  color: #ffffff;
  font-size: 7.4px;
  font-style: normal;
}

.amount-field {
  min-height: 5mm;
  padding: 1mm 1.4mm;
  background: #ffffff;
  box-shadow: 0.8mm 0.8mm 0 #aaaaaa;
  text-align: right;
  font-size: 9.5px;
  font-weight: 700;
}

.footnote {
  margin: 2.3mm 0 0;
  font-size: 6.4px;
  line-height: 1.35;
}

.declaration-box {
  height: 47mm;
  margin-top: 2.5mm;
}

.declaration-box p {
  margin: 0 0 1.8mm;
  font-size: 7px;
  line-height: 1.35;
}

.declaration-actions {
  display: grid;
  grid-template-columns: 58mm 6mm 1fr 51mm;
  gap: 2mm;
  align-items: center;
  margin-top: 2.8mm;
}

.declaration-label {
  font-weight: 700;
}

.declaration-label::after {
  content: " .................";
  font-weight: 400;
}

.previous-label {
  font-weight: 700;
  text-align: right;
}

.identifier-field {
  min-height: 5.2mm;
  padding: 1mm;
  background: #ffffff;
  box-shadow: 0.8mm 0.8mm 0 #aaaaaa;
  text-align: center;
  letter-spacing: 0.12em;
}

.bottom-grid {
  display: grid;
  grid-template-columns: 1.08fr 1fr;
  gap: 3mm;
  margin-top: 2.5mm;
}

.signature-box,
.administration-box {
  height: 69mm;
}

.date-row {
  display: grid;
  grid-template-columns: 10mm 1fr;
  align-items: center;
  gap: 2mm;
}

.date-field {
  min-height: 5mm;
  padding: 1mm;
  background: #ffffff;
  box-shadow: 0.8mm 0.8mm 0 #aaaaaa;
}

.signature-area {
  display: grid;
  grid-template-rows: auto 1fr auto auto;
  gap: 1.4mm;
  height: 47mm;
  margin-top: 2mm;
  padding: 3mm;
  background: #ffffff;
  box-shadow: 0.8mm 0.8mm 0 #aaaaaa;
}

.signature-area .simulated-signature {
  align-self: center;
  color: #1d5a91;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
}

.signature-line {
  padding-left: 2mm;
  border-bottom: 0.3mm solid #666666;
  font-size: 7.5px;
}

.administration-inner {
  height: 56mm;
  padding: 3mm;
  background: #ffffff;
  box-shadow: 0.8mm 0.8mm 0 #aaaaaa;
}

.admin-stamp {
  padding: 1.5mm;
  border: 0.45mm solid #9d0000;
  color: #9d0000;
  text-align: center;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.06em;
}

.admin-data {
  display: grid;
  grid-template-columns: 31mm 1fr;
  gap: 1.5mm 2mm;
  margin-top: 3mm;
  font-size: 7px;
}

.admin-data span {
  color: #444444;
}

.admin-data b {
  overflow-wrap: anywhere;
}

.admin-data .hash {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 5.5px;
}

.page-footer {
  position: absolute;
  right: 6mm;
  bottom: 3mm;
  left: 6mm;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 0.8mm;
  border-bottom: 0.3mm solid #333333;
  font-size: 6.6px;
}

.page-footer strong {
  font-size: 8.5px;
}

@media (max-width: 900px) {
  .sheet {
    margin: 0 auto 10px;
    transform-origin: top left;
  }
}

@media print {
  html,
  body {
    background: #ffffff;
  }

  .sheet {
    margin: 0;
    box-shadow: none;
  }
}
"""
