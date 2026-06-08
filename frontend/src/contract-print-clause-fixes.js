const TEMPORARY_PRODUCTION_CODES = new Set(["402", "502"]);
const TEMPORARY_OTHER_PAGE = "21";

function getPreviewBlocks() {
  return Array.from(document.querySelectorAll('[data-contract-print-divider="true"]'))
    .map((divider) => divider.parentElement)
    .filter(Boolean);
}

function getContractCodeFromDivider(block) {
  const divider = block.querySelector('[data-contract-print-divider="true"]');
  const text = divider?.textContent || "";
  const match = text.match(/código\s+([0-9]{3})/i);
  return match?.[1] || "";
}

function isTemporaryPreview(block) {
  return Array.from(block.querySelectorAll("h2")).some((heading) => heading.textContent?.includes("CONTRATO DE TRABAJO TEMPORAL"));
}

function getSpecificSheets(block) {
  return Array.from(block.querySelectorAll(".contract-print-sheet"));
}

function findSheetByTitle(block, title) {
  return getSpecificSheets(block).find((sheet) => sheet.textContent?.includes(title));
}

function setCheckbox(row, value) {
  const checkbox = row?.querySelector("span");
  if (checkbox) checkbox.textContent = value ? "X" : "";
}

function fixIndexSheet(block) {
  const indexSheet = findSheetByTitle(block, "ÍNDICE DE CLÁUSULAS ESPECÍFICAS");
  if (!indexSheet) return;

  const rows = Array.from(indexSheet.querySelectorAll("div"));
  const productionRow = rows.find((row) => row.textContent?.includes("Circunstancias de la producción"));
  const otherRow = rows.find((row) => row.textContent?.includes("Otras situaciones"));

  setCheckbox(productionRow, false);
  setCheckbox(otherRow, true);
}

function fixSpecificSheet(block) {
  const sheets = getSpecificSheets(block);
  const productionSheet = sheets.find((sheet) => {
    const text = sheet.textContent || "";
    return text.includes("CIRCUNSTANCIAS DE LA PRODUCCIÓN") || text.includes("Circunstancias concretas");
  });

  if (!productionSheet) return;

  const title = Array.from(productionSheet.querySelectorAll("h3")).find((heading) => heading.textContent?.includes("Circunstancias"));
  if (title) title.textContent = "Otras situaciones";

  const pageNumber = productionSheet.querySelector("section > span, .contract-print-sheet > span:last-child");
  if (pageNumber) pageNumber.textContent = TEMPORARY_OTHER_PAGE;

  const allTextFields = Array.from(productionSheet.querySelectorAll("span"));
  const clauseLabel = allTextFields.find((span) => span.textContent?.includes("Circunstancias concretas"));
  if (clauseLabel) clauseLabel.textContent = "Cláusula aplicable";

  const valueFields = Array.from(productionSheet.querySelectorAll("span"));
  const productionValue = valueFields.find((span) => span.textContent?.includes("Necesidad temporal de personal por circunstancias"));
  if (productionValue) productionValue.textContent = "Otras situaciones temporales no clasificadas automáticamente por código.";
}

function fixTemporaryFallbackClauses() {
  getPreviewBlocks().forEach((block) => {
    const code = getContractCodeFromDivider(block);
    if (!isTemporaryPreview(block)) return;
    if (TEMPORARY_PRODUCTION_CODES.has(code)) return;

    fixIndexSheet(block);
    fixSpecificSheet(block);
  });
}

let scheduled = false;
function scheduleFix() {
  if (scheduled) return;
  scheduled = true;
  window.requestAnimationFrame(() => {
    scheduled = false;
    fixTemporaryFallbackClauses();
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("load", scheduleFix);
  window.addEventListener("beforeprint", fixTemporaryFallbackClauses);

  const observer = new MutationObserver(scheduleFix);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
