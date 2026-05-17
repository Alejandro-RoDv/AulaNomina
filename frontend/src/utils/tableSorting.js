const collator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

function normalizeValue(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") return value;

  if (value instanceof Date) return value.getTime();

  const raw = String(value).trim();
  if (!raw) return "";

  const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) return Number(`${isoDateMatch[1]}${isoDateMatch[2]}${isoDateMatch[3]}`);

  const spanishDateMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (spanishDateMatch) return Number(`${spanishDateMatch[3]}${spanishDateMatch[2]}${spanishDateMatch[1]}`);

  const numericCandidate = raw
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");

  if (/^-?\d+(\.\d+)?$/.test(numericCandidate)) {
    return Number(numericCandidate);
  }

  return raw.toLowerCase();
}

export function compareTableValues(left, right) {
  const a = normalizeValue(left);
  const b = normalizeValue(right);

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;

  return collator.compare(String(a), String(b));
}

export function sortRows(rows, sortConfig, accessors = {}) {
  if (!sortConfig?.key) return rows;

  const accessor = accessors[sortConfig.key];
  if (!accessor) return rows;

  const direction = sortConfig.direction === "desc" ? -1 : 1;

  return [...rows].sort((left, right) => {
    const result = compareTableValues(accessor(left), accessor(right));
    return result * direction;
  });
}

export function nextSortConfig(currentConfig, key) {
  if (currentConfig?.key === key) {
    return {
      key,
      direction: currentConfig.direction === "asc" ? "desc" : "asc",
    };
  }

  return { key, direction: "asc" };
}

export function getSortLabel(sortConfig, key) {
  if (sortConfig?.key !== key) return "↕";
  return sortConfig.direction === "asc" ? "↑" : "↓";
}
