import { formatIban, normalizeIban, splitIban } from "./bankingUtils";

export default function BankAccountForm({ form, onChange, onSubmit, onGenerate, saving }) {
  const preview = splitIban(form.iban);
  return (
    <form onSubmit={onSubmit} className="banking-form">
      <label className="banking-field">Nombre<input value={form.label} onChange={(event) => onChange("label", event.target.value)} required /></label>
      <label className="banking-field banking-field-wide">IBAN<input value={formatIban(form.iban)} onChange={(event) => onChange("iban", normalizeIban(event.target.value))} required /></label>
      <button type="button" onClick={onGenerate} className="banking-button-secondary">Generar código simulado</button>
      <div className="banking-iban-parts">
        <span>País <strong>{preview.country || "-"}</strong></span>
        <span>Entidad <strong>{preview.entity || "-"}</strong></span>
        <span>Sucursal <strong>{preview.branch || "-"}</strong></span>
        <span>D/C <strong>{preview.dc || "-"}</strong></span>
        <span>Nº cuenta <strong>{preview.account || "-"}</strong></span>
      </div>
      <label className="banking-check"><input type="checkbox" checked={form.is_fallback} onChange={(event) => onChange("is_fallback", event.target.checked)} /> Cuenta comodín</label>
      <label className="banking-check"><input type="checkbox" checked={form.is_simulated} onChange={(event) => onChange("is_simulated", event.target.checked)} /> Cuenta simulada</label>
      <button type="submit" disabled={saving} className="banking-button-primary">{saving ? "Añadiendo..." : "Añadir cuenta (+)"}</button>
    </form>
  );
}
