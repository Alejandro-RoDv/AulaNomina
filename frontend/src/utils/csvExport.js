function escapeCsvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCsv(rows, headers) {
  const headerRow = headers.map((header) => escapeCsvCell(header.label)).join(";");
  const bodyRows = rows.map((row) =>
    headers.map((header) => escapeCsvCell(typeof header.value === "function" ? header.value(row) : row[header.value])).join(";")
  );

  return [headerRow, ...bodyRows].join("\n");
}

function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRowsToCsv(rows, headers, filename) {
  const csv = `\ufeff${toCsv(rows, headers)}`;
  downloadTextFile(csv, filename, "text/csv;charset=utf-8;");
}

export function buildDatedFilename(prefix) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(":", "");
  return `${prefix}_${date}_${time}.csv`;
}
