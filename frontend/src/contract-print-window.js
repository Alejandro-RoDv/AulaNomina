function getContractPrintSheets() {
  return Array.from(document.querySelectorAll("#contract-print-preview .contract-print-sheet"));
}

function buildPrintDocument(sheetsHtml) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Impresión contratos</title>
  <style>
    @page { size: A4 portrait; margin: 6mm; }

    * { box-sizing: border-box; }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: Arial, sans-serif;
    }

    .contract-print-sheet {
      display: block !important;
      position: relative !important;
      width: 198mm !important;
      min-width: 0 !important;
      max-width: 198mm !important;
      min-height: 285mm !important;
      height: auto !important;
      margin: 0 auto !important;
      padding: 8mm 10mm !important;
      border: 0 !important;
      box-shadow: none !important;
      background: #ffffff !important;
      color: #111827 !important;
      overflow: hidden !important;
      break-after: page !important;
      page-break-after: always !important;
      break-inside: avoid-page !important;
      page-break-inside: avoid !important;
      transform: none !important;
      font-family: Arial, sans-serif !important;
      font-size: 11px !important;
    }

    .contract-print-sheet:last-child {
      break-after: auto !important;
      page-break-after: auto !important;
    }

    .contract-print-sheet * {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  </style>
</head>
<body>
  ${sheetsHtml}
  <script>
    window.addEventListener("load", () => {
      window.setTimeout(() => {
        window.focus();
        window.print();
      }, 150);
    });
  </script>
</body>
</html>`;
}

function openIsolatedContractPrint() {
  const sheets = getContractPrintSheets();
  if (!sheets.length) {
    window.alert("Primero selecciona contratos y pulsa Imprimir / visualizar.");
    return;
  }

  const sheetsHtml = sheets.map((sheet) => sheet.outerHTML).join("\n");
  const printWindow = window.open("", "aulanomina_contract_print", "width=980,height=900,noopener,noreferrer");

  if (!printWindow) {
    window.alert("El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes para AulaNomina.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintDocument(sheetsHtml));
  printWindow.document.close();
}

function isContractPrintButton(target) {
  const button = target?.closest?.("button");
  if (!button) return false;
  return button.textContent?.trim() === "Abrir impresión" && Boolean(document.querySelector("#contract-print-preview"));
}

window.addEventListener(
  "click",
  (event) => {
    if (!isContractPrintButton(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openIsolatedContractPrint();
  },
  true
);
