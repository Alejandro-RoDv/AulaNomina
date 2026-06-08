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
    @page { size: A4 portrait; margin: 8mm; }

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
      width: 194mm !important;
      min-width: 0 !important;
      max-width: 194mm !important;
      min-height: 0 !important;
      height: 260mm !important;
      margin: 0 auto !important;
      padding: 7mm 9mm !important;
      border: 0 !important;
      box-shadow: none !important;
      background: #ffffff !important;
      color: #111827 !important;
      overflow: hidden !important;
      break-after: page !important;
      page-break-after: always !important;
      break-inside: avoid !important;
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
      }, 250);
    });
  </script>
</body>
</html>`;
}

function openIsolatedContractPrint() {
  const sheets = getContractPrintSheets();
  if (!sheets.length) {
    window.alert("Primero pulsa Visualizar para generar la previsualización de los contratos seleccionados.");
    return;
  }

  const clonedSheets = sheets.map((sheet) => {
    const clone = sheet.cloneNode(true);
    clone.removeAttribute("style");
    return clone.outerHTML;
  });
  const sheetsHtml = clonedSheets.join("\n");

  const printWindow = window.open("", "aulanomina_contract_print", "width=980,height=900");

  if (!printWindow) {
    window.alert("El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes para AulaNomina.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintDocument(sheetsHtml));
  printWindow.document.close();
}

function getButton(target) {
  return target?.closest?.("button") || null;
}

function isContractPrintArea() {
  return Boolean(document.querySelector("#contract-print-preview"));
}

function renameContractPrintButtons() {
  if (!isContractPrintArea()) return;

  Array.from(document.querySelectorAll("button")).forEach((button) => {
    const text = button.textContent?.trim();
    if (text?.startsWith("Imprimir / visualizar")) {
      const count = text.match(/\(([^)]+)\)/)?.[1];
      button.textContent = count ? `Visualizar (${count})` : "Visualizar";
    }
    if (text === "Abrir impresión") {
      button.textContent = "Imprimir";
    }
  });
}

function isPrintButton(target) {
  const button = getButton(target);
  if (!button || !isContractPrintArea()) return false;
  return button.textContent?.trim() === "Imprimir";
}

window.addEventListener(
  "click",
  (event) => {
    if (!isPrintButton(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openIsolatedContractPrint();
  },
  true
);

const observer = new MutationObserver(renameContractPrintButtons);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
window.addEventListener("load", renameContractPrintButtons);
window.addEventListener("aulanomina-contract-mode", () => window.setTimeout(renameContractPrintButtons, 0));
