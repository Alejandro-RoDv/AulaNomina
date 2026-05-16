function escapeCsvValue(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function exportRowsToCsv(filename, columns, rows) {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(";");
  const body = rows.map((row) => (
    columns.map((column) => escapeCsvValue(row[column.key])).join(";")
  ));

  const csv = [header, ...body].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
