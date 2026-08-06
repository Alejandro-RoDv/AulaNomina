import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(process.cwd());
const srcRoot = join(root, "src");
const supportedExtensions = new Set([".js", ".jsx", ".css"]);

const requiredFiles = [
  "src/design-system/tokens.css",
  "src/design-system/foundations.css",
  "src/design-system/README.md",
  "src/design-system/ACCESSIBILITY.md",
  "src/design-system/MOTION.md",
  "src/design-system/MIGRATION.md",
  "src/components/ui/index.js",
  "src/components/ui/Button.jsx",
  "src/components/ui/Card.jsx",
  "src/components/ui/Cards.jsx",
  "src/components/ui/Dialog.jsx",
  "src/components/ui/FormControls.jsx",
  "src/components/ui/FormLayout.jsx",
  "src/components/ui/States.jsx",
  "src/components/ui/Table.jsx",
  "src/components/layout/Page.jsx",
  "src/components/layout/Sidebar.jsx",
  "src/components/layout/Header.jsx",
  "src/components/accessibility/AccessibilityBridge.jsx",
  "src/components/motion/MotionBridge.jsx",
];

const requiredMainImports = [
  './design-system/tokens.css',
  './design-system/foundations.css',
  './components/ui/ui.css',
  './components/accessibility/AccessibilityBridge.jsx',
  './components/motion/MotionBridge.jsx',
];

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    if (statSync(absolutePath).isDirectory()) return walk(absolutePath);
    return supportedExtensions.has(extname(entry)) ? [absolutePath] : [];
  });
}

function countMatches(content, pattern) {
  return [...content.matchAll(pattern)].length;
}

function topRows(rows, key, limit = 12) {
  return [...rows]
    .filter((row) => row[key] > 0)
    .sort((left, right) => right[key] - left[key])
    .slice(0, limit);
}

function printTable(title, rows, key) {
  console.log(`\n${title}`);
  if (!rows.length) {
    console.log("  Sin incidencias.");
    return;
  }
  for (const row of rows) console.log(`  ${String(row[key]).padStart(4)}  ${row.path}`);
}

const missingFiles = requiredFiles.filter((path) => !existsSync(join(root, path)));
const mainFile = readFileSync(join(srcRoot, "main.jsx"), "utf8");
const missingImports = requiredMainImports.filter((entry) => !mainFile.includes(entry));

const rows = walk(srcRoot).map((absolutePath) => {
  const content = readFileSync(absolutePath, "utf8");
  const path = relative(root, absolutePath);
  const isTokenFile = path.endsWith("src/design-system/tokens.css");
  const isPrintFile = path.includes("print") || content.includes("@media print");

  return {
    path,
    inlineStyles: countMatches(content, /style\s*=\s*\{\{/g),
    rawHex: isTokenFile || isPrintFile ? 0 : countMatches(content, /#[0-9a-fA-F]{3,8}\b/g),
    important: countMatches(content, /!important/g),
    legacyAliases: isTokenFile ? 0 : countMatches(content, /--(?:text|text-h|bg|border|accent|accent-soft|accent-muted|code-bg)\s*:/g),
  };
});

const totals = rows.reduce((result, row) => ({
  files: result.files + 1,
  inlineStyles: result.inlineStyles + row.inlineStyles,
  rawHex: result.rawHex + row.rawHex,
  important: result.important + row.important,
  legacyAliases: result.legacyAliases + row.legacyAliases,
}), { files: 0, inlineStyles: 0, rawHex: 0, important: 0, legacyAliases: 0 });

console.log("AulaNomina Design System — auditoría estructural");
console.log("================================================");
console.log(`Archivos analizados:             ${totals.files}`);
console.log(`Estilos inline pendientes:       ${totals.inlineStyles}`);
console.log(`Colores directos pendientes:     ${totals.rawHex}`);
console.log(`Usos de !important pendientes:   ${totals.important}`);
console.log(`Alias CSS redefinidos:           ${totals.legacyAliases}`);

printTable("Mayor concentración de estilos inline", topRows(rows, "inlineStyles"), "inlineStyles");
printTable("Mayor concentración de colores directos", topRows(rows, "rawHex"), "rawHex");
printTable("Mayor concentración de !important", topRows(rows, "important"), "important");

if (missingFiles.length || missingImports.length) {
  console.error("\nAuditoría fallida.");
  for (const path of missingFiles) console.error(`  Falta archivo obligatorio: ${path}`);
  for (const entry of missingImports) console.error(`  Falta integración en main.jsx: ${entry}`);
  process.exitCode = 1;
} else {
  console.log("\nEstructura del Design System: correcta.");
  console.log("Las métricas restantes representan deuda de migración, no un fallo del sistema base.");
}
