import { joinCcc, splitCcc } from "../../utils/ccc.js";

export default function CccFields({
  value,
  onChange,
  label = "CCC",
  required = false,
  readOnly = false,
  disabled = false,
  className = "ccc-fields",
  inputClassName,
  style,
  inputStyle,
  idPrefix = "ccc",
}) {
  const { regime, code } = splitCcc(value);
  const change = (nextRegime, nextCode) => onChange?.(joinCcc(nextRegime, nextCode, { partial: true }));
  return (
    <fieldset className={className} style={{ border: 0, padding: 0, margin: 0, minWidth: 280, flex: "1 1 360px", ...style }}>
      <legend style={{ padding: 0, marginBottom: 6, fontWeight: 800 }}>{label}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(90px, 0.35fr) minmax(170px, 1fr)", gap: 8 }}>
        <label htmlFor={`${idPrefix}-regime`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Régimen</span>
          <input id={`${idPrefix}-regime`} aria-label={`${label}: régimen`} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="0111" value={regime} onChange={(event) => change(event.target.value, code)} required={required} readOnly={readOnly} disabled={disabled} className={inputClassName} style={inputStyle} />
        </label>
        <label htmlFor={`${idPrefix}-code`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>Código de cuenta</span>
          <input id={`${idPrefix}-code`} aria-label={`${label}: código de cuenta`} inputMode="numeric" pattern="[0-9]{11}" maxLength={11} placeholder="14149990011" value={code} onChange={(event) => change(regime, event.target.value)} required={required} readOnly={readOnly} disabled={disabled} className={inputClassName} style={inputStyle} />
        </label>
      </div>
    </fieldset>
  );
}
