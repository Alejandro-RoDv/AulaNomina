const CONTRACT_PRINT_FIX_STYLE_ID = "aulanomina-contract-print-v5-fixes";

const CONTRACT_PRINT_FIX_CSS = `
@media print {
  .cp-print-only,
  .cp-print-only * {
    visibility: visible !important;
  }

  .cp-print-only {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
  }

  .cp-print-only .cp-contract-block {
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .cp-print-only .contract-print-sheet {
    display: block !important;
    position: relative !important;
    width: 194mm !important;
    max-width: 194mm !important;
    height: 260mm !important;
    min-height: 0 !important;
    margin: 0 auto !important;
    padding: 7mm 9mm !important;
    background: #ffffff !important;
    color: #111827 !important;
    box-shadow: none !important;
    overflow: hidden !important;
    break-after: page !important;
    page-break-after: always !important;
    box-sizing: border-box !important;
    font-family: Arial, sans-serif !important;
    font-size: 11px !important;
  }

  .cp-print-only .contract-print-sheet:last-child {
    break-after: auto !important;
    page-break-after: auto !important;
  }

  .cp-print-only .cp-header {
    display: flex !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    height: 20mm !important;
    margin-bottom: 5mm !important;
  }

  .cp-print-only .cp-header div:first-child {
    display: block !important;
    color: #1d4ed8 !important;
    font-weight: 800 !important;
  }

  .cp-print-only .cp-header div:nth-child(2) {
    display: block !important;
    text-align: center !important;
    font-weight: 700 !important;
    color: #374151 !important;
  }

  .cp-print-only .cp-header strong {
    display: block !important;
    border: 1px solid #111827 !important;
    padding: 6px 12px !important;
    font-size: 14px !important;
  }

  .cp-print-only .cp-title {
    display: block !important;
    clear: both !important;
    background: #e8edf7 !important;
    color: #0f3761 !important;
    font-size: 13px !important;
    padding: 5px 7px !important;
    text-transform: uppercase !important;
    margin: 0 0 5mm !important;
  }

  .cp-print-only .cp-section {
    display: block !important;
    margin-bottom: 5mm !important;
  }

  .cp-print-only .cp-section h3 {
    display: block !important;
    margin: 0 0 2mm !important;
    color: #0f3761 !important;
    text-transform: uppercase !important;
    font-size: 12px !important;
    font-weight: 900 !important;
  }

  .cp-print-only .cp-grid {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 2mm !important;
  }

  .cp-print-only .cp-field {
    display: flex !important;
    flex-direction: column !important;
    border: 1px solid #9ca3af !important;
    min-height: 9mm !important;
    background: #eef2fb !important;
  }

  .cp-print-only .cp-field span {
    display: block !important;
    font-size: 8px !important;
    color: #374151 !important;
    text-transform: uppercase !important;
    font-weight: 900 !important;
    padding: 1mm 1.5mm 0 !important;
  }

  .cp-print-only .cp-field strong {
    display: block !important;
    flex: 1 !important;
    padding: 1mm 1.5mm !important;
    background: #ffffff !important;
    border-top: 1px solid #cbd5e1 !important;
    font-size: 11px !important;
    font-weight: 500 !important;
  }

  .cp-print-only .cp-wide {
    grid-column: span 3 !important;
  }

  .cp-print-only .cp-text {
    display: block !important;
    grid-column: span 3 !important;
    margin: 2mm 0 !important;
    font-size: 11px !important;
    line-height: 1.45 !important;
  }

  .cp-print-only .cp-check {
    display: flex !important;
    grid-column: span 3 !important;
    gap: 7px !important;
    align-items: flex-start !important;
    min-height: 7mm !important;
  }

  .cp-print-only .cp-check span,
  .cp-print-only .cp-index-row > span {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 4mm !important;
    height: 4mm !important;
    border: 1px solid #111827 !important;
    font-size: 9px !important;
    font-weight: 900 !important;
    flex: 0 0 auto !important;
  }

  .cp-print-only .cp-check p {
    display: block !important;
    margin: 0 !important;
  }

  .cp-print-only .cp-index-row {
    display: grid !important;
    grid-template-columns: auto auto 1fr auto !important;
    gap: 7px !important;
    align-items: center !important;
    grid-column: span 3 !important;
  }

  .cp-print-only .cp-index-row p {
    display: block !important;
    margin: 0 !important;
  }

  .cp-print-only .cp-index-row i {
    display: block !important;
    border-bottom: 1px dotted #9ca3af !important;
    height: 1px !important;
  }

  .cp-print-only .cp-note {
    display: block !important;
    grid-column: span 3 !important;
    color: #6b7280 !important;
    margin: 2mm 0 0 !important;
    font-size: 10px !important;
  }

  .cp-print-only .cp-code {
    display: flex !important;
    grid-column: span 3 !important;
    justify-self: end !important;
    border: 1px solid #111827 !important;
    padding: 5px 8px !important;
    gap: 8px !important;
    align-items: center !important;
    font-weight: 800 !important;
  }

  .cp-print-only .cp-code-boxes {
    display: inline-flex !important;
    gap: 2px !important;
  }

  .cp-print-only .cp-code-boxes span {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 5mm !important;
    height: 5mm !important;
    border: 1px solid #111827 !important;
    font-weight: 900 !important;
  }

  .cp-print-only .cp-large-box {
    display: block !important;
    grid-column: span 3 !important;
    min-height: 52mm !important;
    background: #eef2fb !important;
    border: 1px solid #cbd5e1 !important;
    padding: 4mm !important;
    white-space: pre-wrap !important;
  }

  .cp-print-only .cp-signatures {
    display: grid !important;
    grid-column: span 3 !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 12mm !important;
    text-align: center !important;
    padding-top: 18mm !important;
    min-height: 34mm !important;
  }

  .cp-print-only .cp-important {
    display: block !important;
    grid-column: span 3 !important;
    margin-top: 8mm !important;
    text-align: center !important;
    font-size: 12px !important;
    font-weight: 900 !important;
  }

  .cp-print-only .cp-page-number {
    display: block !important;
    position: absolute !important;
    right: 8mm !important;
    bottom: 6mm !important;
    font-size: 10px !important;
    font-weight: 700 !important;
  }
}
`;

function ensureContractPrintFixStyle() {
  let style = document.getElementById(CONTRACT_PRINT_FIX_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = CONTRACT_PRINT_FIX_STYLE_ID;
    style.textContent = CONTRACT_PRINT_FIX_CSS;
  }

  if (style.parentElement !== document.body || style !== document.body.lastElementChild) {
    document.body.appendChild(style);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("load", ensureContractPrintFixStyle);
  window.addEventListener("beforeprint", ensureContractPrintFixStyle);
  window.setTimeout(ensureContractPrintFixStyle, 0);
  window.setTimeout(ensureContractPrintFixStyle, 250);

  new MutationObserver(ensureContractPrintFixStyle).observe(document.documentElement, { childList: true, subtree: true });
}
