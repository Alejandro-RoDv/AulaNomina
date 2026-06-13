import { useEffect, useMemo, useState } from "react";

import { fetchContracts } from "../../services/api";
import {
  createContractExtraPayroll,
  fetchAgreementExtraPays,
  fetchContractExtraPayPreview,
  updateAgreementExtraPay,
} from "../../services/agreementExtraPayApi";

const currentYear = new Date().getFullYear();
const money = (value) => `${Number(value || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const percent = (value) => `${Number(value || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("es-ES") : "—";

const SOURCE_LABELS = {
  salary_table: "Tabla salarial",
  contract_salary_base: "Salario base del contrato",
  contract_permanent_concept: "Concepto permanente",
  fixed_amount: "Importe fijo",
};

export default function ContractExtraPaySimulationPanel({ agreement }) {
  const tables = agreement?.salary_tables || [];
  const initialTable = tables.find((item) => item.status === "active") || tables[0] || null;
  const [open, setOpen] = useState(false);
  const [tableId, setTableId] = useState("");
  const [pays, setPays] = useState([]);
  const [payId, setPayId] = useState("");
  const [contracts, setContracts] = useState([]);
  const [contractId, setContractId] = useState("");
  const [year, setYear] = useState(String(initialTable?.year || currentYear));
  const [rules, setRules] = useState(null);
  const [preview, setPreview] = useState(null);
  const [irpf, setIrpf] = useState("");
  const [status, setStatus] = useState("pending");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const table = useMemo(
    () => tables.find((item) => String(item.id) === String(tableId)) || initialTable,
    [tables, tableId, initialTable]
  );
  const selectedPay = useMemo(
    () => pays.find((item) => String(item.id) === String(payId)) || pays[0] || null,
    [pays, payId]
  );
  const eligibleContracts = useMemo(
    () => contracts
      .filter((item) => Number(item.collective_agreement_id) === Number(agreement?.id))
      .filter((item) => !["deleted", "cancelled"].includes(item.status))
      .sort((a, b) => String(a.employee_name || "").localeCompare(String(b.employee_name || ""))),
    [contracts, agreement?.id]
  );
  const selectedContract = useMemo(
    () => eligibleContracts.find((item) => String(item.id) === String(contractId)) || eligibleContracts[0] || null,
    [eligibleContracts, contractId]
  );

  useEffect(() => {
    setTableId(initialTable?.id ? String(initialTable.id) : "");
    setYear(String(initialTable?.year || currentYear));
    setPays([]);
    setPayId("");
    setContracts([]);
    setContractId("");
    setPreview(null);
    setResult(null);
  }, [agreement?.id]);

  useEffect(() => {
    if (!open) return;
    fetchContracts()
      .then((data) => setContracts(data || []))
      .catch((err) => setError(err.message));
  }, [open, agreement?.id]);

  useEffect(() => {
    if (!open || !agreement?.id || !table?.id) return;
    setBusy(true);
    fetchAgreementExtraPays(agreement.id, table.id)
      .then((data) => {
        setPays(data || []);
        setPayId(data?.[0]?.id ? String(data[0].id) : "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false));
  }, [open, agreement?.id, table?.id]);

  useEffect(() => {
    if (!selectedPay) {
      setRules(null);
      return;
    }
    setRules({
      payroll_period: selectedPay.payroll_period || 13,
      apply_partiality: selectedPay.apply_partiality !== false,
      deduct_it_days: Boolean(selectedPay.deduct_it_days),
      deduct_unpaid_absence_days: selectedPay.deduct_unpaid_absence_days !== false,
      deduct_inactivity_days: selectedPay.deduct_inactivity_days !== false,
    });
    setPreview(null);
    setResult(null);
  }, [selectedPay?.id]);

  useEffect(() => {
    if (selectedContract && !contractId) setContractId(String(selectedContract.id));
  }, [selectedContract?.id]);

  async function saveRules() {
    if (!selectedPay || !rules) return;
    setBusy(true);
    setError("");
    try {
      const saved = await updateAgreementExtraPay(selectedPay.id, rules);
      setPays((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage("Reglas de devengo actualizadas.");
      setPreview(null);
    } catch (err) {
      setError(err.message || "No se pudieron guardar las reglas.");
    } finally {
      setBusy(false);
    }
  }

  async function calculate() {
    if (!selectedPay || !selectedContract) return;
    setBusy(true);
    setError("");
    setMessage("");
    setResult(null);
    try {
      setPreview(await fetchContractExtraPayPreview(selectedPay.id, selectedContract.id, Number(year)));
    } catch (err) {
      setPreview(null);
      setError(err.message || "No se pudo calcular la paga del contrato.");
    } finally {
      setBusy(false);
    }
  }

  async function generatePayroll() {
    if (!preview?.can_generate || !selectedPay || !selectedContract) return;
    if (!window.confirm(`¿Generar la nómina ${preview.payroll_period}/${year} de ${preview.employee_name} por ${money(preview.final_amount)}?`)) return;
    setBusy(true);
    setError("");
    try {
      const created = await createContractExtraPayroll(selectedPay.id, selectedContract.id, {
        period_year: Number(year),
        irpf_percentage: irpf === "" ? null : Number(irpf),
        status,
      });
      setResult(created);
      setMessage(`Nómina especial creada con ID ${created.payroll_id}.`);
      setPreview(await fetchContractExtraPayPreview(selectedPay.id, selectedContract.id, Number(year)));
    } catch (err) {
      setError(err.message || "No se pudo generar la nómina especial.");
    } finally {
      setBusy(false);
    }
  }

  if (!tables.length) return null;

  return <section style={s.box}>
    <header style={s.head}>
      <div>
        <h3 style={s.title}>Cálculo por contrato</h3>
        <p style={s.sub}>Ajusta la paga por vigencia, jornada, incidencias e inactividad y genera el período especial.</p>
      </div>
      <button type="button" onClick={() => setOpen((value) => !value)} style={s.dark}>{open ? "Cerrar" : "Calcular y generar"}</button>
    </header>

    {open && <div style={s.body}>
      {error && <div style={s.error}>{error}</div>}
      {message && <div style={s.ok}>{message}</div>}
      {busy && <div style={s.notice}>Procesando…</div>}

      <div style={s.filters}>
        <Field label="Tabla salarial"><select value={table?.id || ""} onChange={(e) => { setTableId(e.target.value); setPreview(null); }} style={s.input}>{tables.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.year || "sin año"}</option>)}</select></Field>
        <Field label="Paga extraordinaria"><select value={selectedPay?.id || ""} onChange={(e) => { setPayId(e.target.value); setPreview(null); }} style={s.input}>{!pays.length && <option value="">Sin pagas configuradas</option>}{pays.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Contrato"><select value={selectedContract?.id || ""} onChange={(e) => { setContractId(e.target.value); setPreview(null); }} style={s.input}>{!eligibleContracts.length && <option value="">Sin contratos vinculados</option>}{eligibleContracts.map((item) => <option key={item.id} value={item.id}>{item.employee_name || `Trabajador ${item.employee_id}`} · {item.contract_code || `#${item.id}`} · {item.status}</option>)}</select></Field>
        <Field label="Ejercicio de abono"><input type="number" min="1900" max="2200" value={year} onChange={(e) => { setYear(e.target.value); setPreview(null); }} style={s.input} /></Field>
      </div>

      {selectedPay && rules && <section style={s.card}>
        <div style={s.cardHead}>
          <div><h4 style={s.cardTitle}>Reglas de devengo</h4><p style={s.sub}>Estas reglas pertenecen a {selectedPay.name}.</p></div>
          <button type="button" onClick={saveRules} disabled={busy} style={s.light}>Guardar reglas</button>
        </div>
        <div style={s.rules}>
          <Field label="Período de nómina"><select value={rules.payroll_period} onChange={(e) => setRules({ ...rules, payroll_period: Number(e.target.value) })} style={s.input}><option value="13">13 · Extra verano</option><option value="14">14 · Extra diciembre</option><option value="15">15 · Complementaria</option></select></Field>
          <Check label="Aplicar parcialidad del contrato" checked={rules.apply_partiality} onChange={(value) => setRules({ ...rules, apply_partiality: value })} />
          <Check label="Descontar días de IT" checked={rules.deduct_it_days} onChange={(value) => setRules({ ...rules, deduct_it_days: value })} />
          <Check label="Descontar ausencias no retribuidas" checked={rules.deduct_unpaid_absence_days} onChange={(value) => setRules({ ...rules, deduct_unpaid_absence_days: value })} />
          <Check label="Descontar períodos de inactividad" checked={rules.deduct_inactivity_days} onChange={(value) => setRules({ ...rules, deduct_inactivity_days: value })} />
        </div>
      </section>}

      <div style={s.actions}>
        <button type="button" onClick={calculate} disabled={busy || !selectedPay || !selectedContract} style={s.yellow}>Calcular vista previa</button>
      </div>

      {preview && <>
        <section style={s.stats}>
          <Stat label="Devengo" value={`${dateLabel(preview.accrual_start_date)} – ${dateLabel(preview.accrual_end_date)}`} />
          <Stat label="Días del período" value={preview.total_period_days} />
          <Stat label="Vigencia contrato" value={preview.contract_overlap_days} />
          <Stat label="Días excluidos" value={preview.excluded_total_days} />
          <Stat label="Días devengados" value={preview.accrued_days} />
          <Stat label="Parcialidad" value={percent(preview.partiality_percentage)} />
          <Stat label="Importe jornada completa" value={money(preview.theoretical_full_time_amount)} />
          <Stat label="Importe final" value={money(preview.final_amount)} strong />
        </section>

        <section style={s.card}>
          <h4 style={s.cardTitle}>Desglose del cálculo</h4>
          <div style={s.scroll}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Concepto</th><th style={s.th}>Origen</th><th style={s.th}>Base contrato</th><th style={s.th}>Jornada completa</th><th style={s.th}>Con parcialidad</th><th style={s.th}>Devengado</th></tr></thead>
              <tbody>{preview.lines.map((line) => <tr key={line.concept_line_id}><td style={s.td}><strong>{line.concept_name}</strong></td><td style={s.td}>{SOURCE_LABELS[line.base_source] || line.base_source}</td><td style={s.tdAmount}>{money(line.contract_base_amount)}</td><td style={s.tdAmount}>{money(line.full_time_amount)}</td><td style={s.tdAmount}>{money(line.after_partiality_amount)}</td><td style={s.tdAmount}><strong>{money(line.final_amount)}</strong></td></tr>)}</tbody>
            </table>
          </div>
        </section>

        <section style={s.card}>
          <h4 style={s.cardTitle}>Incidencias durante el devengo</h4>
          <div style={s.scroll}>
            <table style={s.table}>
              <thead><tr><th style={s.th}>Tipo</th><th style={s.th}>Período</th><th style={s.th}>Días coincidentes</th><th style={s.th}>Días descontados</th><th style={s.th}>Tratamiento</th></tr></thead>
              <tbody>{preview.incident_breakdown.map((item) => <tr key={`${item.incident_id}-${item.start_date}`}><td style={s.td}>{item.label}</td><td style={s.td}>{dateLabel(item.start_date)} – {dateLabel(item.end_date)}</td><td style={s.tdAmount}>{item.overlapping_days}</td><td style={s.tdAmount}>{item.deducted_days}</td><td style={s.td}>{item.deducted ? "Descuenta devengo" : "No descuenta"}</td></tr>)}{!preview.incident_breakdown.length && <tr><td colSpan="5" style={s.emptyCell}>Sin incidencias en el período.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        {preview.warnings?.length > 0 && <div style={s.warning}>{preview.warnings.map((item) => <span key={item}>{item}</span>)}</div>}
        {!preview.can_generate && <div style={s.block}><strong>No se puede generar:</strong> {preview.generation_block_reason}</div>}

        <section style={s.generate}>
          <Field label="IRPF"><input type="number" min="0" max="100" step="0.01" value={irpf} onChange={(e) => setIrpf(e.target.value)} placeholder="Automático" style={s.input} /></Field>
          <Field label="Estado inicial"><select value={status} onChange={(e) => setStatus(e.target.value)} style={s.input}><option value="pending">Pendiente</option><option value="draft">Borrador</option></select></Field>
          <button type="button" onClick={generatePayroll} disabled={busy || !preview.can_generate} style={preview.can_generate ? s.dark : s.disabled}>Generar nómina {preview.payroll_period}</button>
        </section>
      </>}

      {result && <section style={s.result}>
        <Stat label="Nómina" value={`#${result.payroll_id}`} />
        <Stat label="Bruto" value={money(result.gross_salary)} />
        <Stat label="IRPF" value={`${percent(result.irpf_percentage)} · ${money(result.irpf)}`} />
        <Stat label="Neto" value={money(result.net_salary)} />
      </section>}
    </div>}
  </section>;
}

function Field({ label, children }) {
  return <label style={s.field}><span>{label}</span>{children}</label>;
}

function Check({ label, checked, onChange }) {
  return <label style={s.check}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

function Stat({ label, value, strong }) {
  return <div style={s.stat}><span>{label}</span><strong style={strong ? { fontSize: "16px" } : undefined}>{value}</strong></div>;
}

const s = {
  box: { border: "1px solid #d1d5db", background: "#fff" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", background: "#f9fafb" },
  title: { margin: 0, fontSize: "15px", fontWeight: 850 },
  sub: { margin: "3px 0 0", color: "#6b7280", fontSize: "11px" },
  body: { borderTop: "1px solid #e5e7eb", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" },
  filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "9px" },
  card: { border: "1px solid #e5e7eb", padding: "12px" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "9px" },
  cardTitle: { margin: "0 0 8px", fontSize: "13px", fontWeight: 850 },
  rules: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "8px", alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "11px", fontWeight: 800 },
  input: { width: "100%", height: "34px", boxSizing: "border-box", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px" },
  check: { minHeight: "34px", display: "flex", alignItems: "center", gap: "7px", fontSize: "11px", fontWeight: 750 },
  stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "8px" },
  stat: { border: "1px solid #e5e7eb", padding: "9px", display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px" },
  actions: { display: "flex", justifyContent: "flex-end" },
  generate: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "9px", alignItems: "end", padding: "11px", border: "1px solid #d1d5db", background: "#f9fafb" },
  result: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px", padding: "10px", border: "1px solid #bbf7d0", background: "#f0fdf4" },
  scroll: { overflowX: "auto" },
  table: { width: "100%", minWidth: "760px", borderCollapse: "collapse", fontSize: "11px" },
  th: { padding: "7px", borderBottom: "1px solid #d1d5db", background: "#f9fafb", textAlign: "left", color: "#374151", fontSize: "10px", fontWeight: 850 },
  td: { padding: "7px", borderBottom: "1px solid #e5e7eb", textAlign: "left", fontSize: "11px", verticalAlign: "top" },
  tdAmount: { padding: "7px", borderBottom: "1px solid #e5e7eb", textAlign: "right", fontSize: "11px", verticalAlign: "top" },
  emptyCell: { padding: "12px 7px", color: "#6b7280", fontSize: "11px" },
  dark: { height: "34px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 12px", fontSize: "11px", fontWeight: 850, cursor: "pointer" },
  light: { height: "34px", border: "1px solid #d1d5db", background: "#fff", padding: "0 11px", fontSize: "11px", fontWeight: 800, cursor: "pointer" },
  yellow: { height: "34px", border: "1px solid #eab308", background: "#facc15", padding: "0 12px", fontSize: "11px", fontWeight: 850, cursor: "pointer" },
  disabled: { height: "34px", border: "1px solid #e5e7eb", background: "#f3f4f6", color: "#9ca3af", padding: "0 12px", fontSize: "11px", fontWeight: 850 },
  error: { padding: "9px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: "11px" },
  ok: { padding: "9px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontSize: "11px" },
  notice: { padding: "9px", border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: "11px" },
  warning: { padding: "9px", border: "1px solid #fde68a", background: "#fffbeb", color: "#78350f", display: "flex", flexDirection: "column", gap: "3px", fontSize: "11px" },
  block: { padding: "9px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: "11px" },
};
