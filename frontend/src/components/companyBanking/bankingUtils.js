export const COMMON_OPERATION_CODES = new Set([
  "ccc_main_debit",
  "payroll_transfer",
  "model_111",
  "professional_fees",
]);

export const EMPTY_BANK_ACCOUNT = {
  label: "Cuenta principal",
  iban: "",
  is_fallback: false,
  is_simulated: true,
  notes: "",
};

function randomDigits(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

export function generateFakeSpanishIban() {
  const entity = randomDigits(4);
  const branch = randomDigits(4);
  const account = randomDigits(10);
  return `ESXX${entity}${branch}XX${account}`;
}

export function normalizeIban(value) {
  return String(value || "").replace(/[\s-]+/g, "").toUpperCase();
}

export function formatIban(value) {
  return normalizeIban(value).replace(/(.{4})/g, "$1 ").trim();
}

export function splitIban(value) {
  const iban = normalizeIban(value);
  return {
    country: iban.slice(0, 2),
    entity: iban.slice(4, 8),
    branch: iban.slice(8, 12),
    dc: iban.slice(12, 14),
    account: iban.slice(14, 24),
  };
}
