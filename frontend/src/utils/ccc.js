export const DEFAULT_CCC_REGIME = "0111";

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function splitCcc(value, fallbackRegime = DEFAULT_CCC_REGIME) {
  const text = String(value || "").trim();
  if (!text) return { regime: fallbackRegime || "", code: "" };
  const slash = text.indexOf("/");
  if (slash >= 0) {
    return {
      regime: digitsOnly(text.slice(0, slash)).slice(0, 4),
      code: digitsOnly(text.slice(slash + 1)).slice(0, 11),
    };
  }
  const digits = digitsOnly(text);
  if (digits.length > 11) return { regime: digits.slice(0, 4), code: digits.slice(4, 15) };
  return { regime: fallbackRegime, code: digits.slice(0, 11) };
}

export function joinCcc(regime, code, { partial = false } = {}) {
  const cleanRegime = digitsOnly(regime).slice(0, 4);
  const cleanCode = digitsOnly(code).slice(0, 11);
  if (!cleanRegime && !cleanCode) return "";
  if (partial) return `${cleanRegime}/${cleanCode}`;
  return cleanRegime.length === 4 && cleanCode.length === 11 ? `${cleanRegime}/${cleanCode}` : "";
}

export function formatCcc(value) {
  const { regime, code } = splitCcc(value, "");
  if (!regime && !code) return "-";
  return [regime, code].filter(Boolean).join(" / ");
}

