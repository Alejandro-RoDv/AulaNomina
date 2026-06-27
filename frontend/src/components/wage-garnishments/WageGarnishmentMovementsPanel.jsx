import { useEffect, useMemo, useState } from "react";

import {
  createWageGarnishmentMovement,
  fetchCurrentSmi,
  fetchWageGarnishmentMovements,
  removeWageGarnishmentMovement,
} from "../../services/wageGarnishmentApi";
import { formatEuro } from "../../utils/embargoCalculator";

const MONTHS = [
  [1, "Enero"], [2, "Febrero"], [3, "Marzo"], [4, "Abril"], [5, "Mayo"], [6, "Junio"],
  [7, "Julio"], [8, "Agosto"], [9, "Septiembre"], [10, "Octubre"], [11, "Noviembre"], [12, "Diciembre"],
];

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function parseAmount(value) {
  return Number(String(value || "0").replace(/\./g, "").replace(",", "."));
}

export default function WageGarnishmentMovementsPanel({ garnishment, payrolls = [], onChanged }) {
  const today = new Date();
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    period_year: today.getFullYear(),
    period_month: today.getMonth() + 1,
    payroll_id: "",
    monthly_net: "",
    smi_annual: String(garnishment.smi_annual || ""),
    withheld_amount: "",
    payment_status: "withheld",
    paid_date: "",
    notes: "",
  });

  const employeePayrolls = useMemo(
    () => payrolls.filter((payroll) => String(payroll.employee_id) === String(garnishment.employee_id)),
    [payrolls, garnishment.employee_id]
  );

  const loadMovements = async () => {
    try {
      setLoading(true);
      setMovements(await fetchWageGarnishmentMovements(garnishment.id));
    } catch (loadError) {
      setError(loadError.message || "No se han podido cargar los movimientos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [garnishment.id]);

  const setField = (name, value) => {
    setError("");
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const applyPeriodSmi = async (year, month) => {
    try {
      const targetDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const parameter = await fetchCurrentSmi(targetDate);
      setForm((previous) => ({ ...previous, smi_annual: String(parameter.annual_amount) }));
    } catch {
      // Mantiene el SMI del expediente si no existe un parámetro para el periodo.
    }
  };

  const handlePeriodChange = (name, value) => {
    const nextYear = name === "period_year" ? Number(value) : Number(form.period_year);
    const nextMonth = name === "period_month" ? Number(value) : Number(form.period_month);
    setField(name, value);
    applyPeriodSmi(nextYear, nextMonth);
  };

  const handlePayrollChange = (payrollId) => {
    const payroll = employeePayrolls.find((item) => String(item.id) === String(payrollId));
    setForm((previous) => ({
      ...previous,
      payroll_id: payrollId,
      period_year: payroll?.period_year || previous.period_year,
      period_month: payroll?.period_month <= 12 ? payroll.period_month : previous.period_month,
      monthly_net: payroll ? String(payroll.net_salary || 0) : previous.monthly_net,
    }));
    if (payroll) applyPeriodSmi(payroll.period_year, Math.min(payroll.period_month, 12));
  };

  const submitMovement = async () => {
    setError("");
    if (!form.monthly_net || !form.withheld_amount) {
      setError("Indica el líquido del periodo y la cantidad realmente retenida.");
      return;
    }
    try {
      setSaving(true);
      await createWageGarnishmentMovement(garnishment.id, {
        payroll_id: form.payroll_id ? Number(form.payroll_id) : null,
        period_year: Number(form.period_year),
        period_month: Number(form.period_month),
        payroll_date: null,
        monthly_net: parseAmount(form.monthly_net),
        smi_annual: parseAmount(form.smi_annual),
        withheld_amount: parseAmount(form.withheld_amount),
        paid_date: form.paid_date || null,
        payment_status: form.payment_status,
        notes: form.notes.trim() || null,
      });
      setForm((previous) => ({ ...previous, payroll_id: "", monthly_net: "", withheld_amount: "", paid_date: "", notes: "" }));
      await loadMovements();
      onChanged?.();
    } catch (saveError) {
      setError(saveError.message || "No se ha podido registrar el movimiento");
    } finally {
      setSaving(false);
    }
  };

  const removeMovement = async (movement) => {
    if (!window.confirm(`¿Eliminar el movimiento ${movement.period_month}/${movement.period_year}?`)) return;
    try {
      await removeWageGarnishmentMovement(garnishment.id, movement.id);
      await loadMovements();
      onChanged?.();
    } catch (deleteError) {
      setError(deleteError.message || "No se ha podido eliminar el movimiento");
    }
  };

  return (
    <section style={styles.panel}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>Seguimiento mensual</h3>
          <p style={styles.subtitle}>Cada fila representa la retención aplicada en una nómina o periodo.</p>
        </div>
        <span style={styles.counter}>{movements.length} movimientos</span>
      </div>

      <div style={styles.formGrid}>
        <label style={styles.field}><span>Año</span><input type="number" min="2000" max="2100" value={form.period_year} onChange={(event) => handlePeriodChange("period_year", event.target.value)} style={styles.input} /></label>
        <label style={styles.field}><span>Mes</span><select value={form.period_month} onChange={(event) => handlePeriodChange("period_month", event.target.value)} style={styles.input}>{MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label style={styles.fieldWide}><span>Nómina relacionada</span><select value={form.payroll_id} onChange={(event) => handlePayrollChange(event.target.value)} style={styles.input}><option value="">Sin vincular</option>{employeePayrolls.map((payroll) => <option key={payroll.id} value={payroll.id}>{payroll.period_label || `${payroll.period_month}/${payroll.period_year}`} · {formatEuro(payroll.net_salary)}</option>)}</select></label>
        <label style={styles.field}><span>Líquido del periodo</span><input inputMode="decimal" value={form.monthly_net} onChange={(event) => setField("monthly_net", event.target.value)} style={styles.input} placeholder="0,00" /></label>
        <label style={styles.field}><span>SMI anual aplicado</span><input inputMode="decimal" value={form.smi_annual} onChange={(event) => setField("smi_annual", event.target.value)} style={styles.input} /></label>
        <label style={styles.field}><span>Retenido realmente</span><input inputMode="decimal" value={form.withheld_amount} onChange={(event) => setField("withheld_amount", event.target.value)} style={styles.input} placeholder="0,00" /></label>
        <label style={styles.field}><span>Estado</span><select value={form.payment_status} onChange={(event) => setField("payment_status", event.target.value)} style={styles.input}><option value="pending">Pendiente</option><option value="withheld">Retenido</option><option value="paid">Ingresado</option><option value="cancelled">Anulado</option></select></label>
        <label style={styles.field}><span>Fecha de ingreso</span><input type="date" value={form.paid_date} onChange={(event) => setField("paid_date", event.target.value)} style={styles.input} /></label>
        <label style={styles.fieldWide}><span>Observaciones</span><input value={form.notes} onChange={(event) => setField("notes", event.target.value)} style={styles.input} /></label>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.actions}><button type="button" disabled={saving} onClick={submitMovement} style={styles.primaryButton}>{saving ? "Registrando…" : "Registrar movimiento"}</button></div>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Periodo</th><th style={styles.th}>Líquido</th><th style={styles.th}>Máximo calculado</th><th style={styles.th}>Retenido</th><th style={styles.th}>Ingreso</th><th style={styles.th}>Saldo posterior</th><th style={styles.th}>Acciones</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan="7" style={styles.empty}>Cargando movimientos…</td></tr>}
            {!loading && movements.length === 0 && <tr><td colSpan="7" style={styles.empty}>Todavía no se han registrado retenciones mensuales.</td></tr>}
            {!loading && movements.map((movement) => (
              <tr key={movement.id}>
                <td style={styles.td}>{String(movement.period_month).padStart(2, "0")}/{movement.period_year}</td>
                <td style={styles.money}>{formatEuro(movement.monthly_net)}</td>
                <td style={styles.money}>{formatEuro(movement.calculated_amount)}</td>
                <td style={styles.moneyStrong}>{formatEuro(movement.withheld_amount)}</td>
                <td style={styles.td}>{formatDate(movement.paid_date)}</td>
                <td style={styles.money}>{movement.balance_after === null ? "—" : formatEuro(movement.balance_after)}</td>
                <td style={styles.td}><button type="button" onClick={() => removeMovement(movement)} style={styles.deleteButton}>Eliminar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const styles = {
  panel: { border: "1px solid #d4d4d8", borderRadius: "12px", backgroundColor: "#fff", overflow: "hidden" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "16px 18px", borderBottom: "1px solid #e4e4e7", backgroundColor: "#fffdf0" },
  title: { margin: 0, fontSize: "16px", fontWeight: 900 },
  subtitle: { margin: "4px 0 0", fontSize: "11px", color: "#64748b" },
  counter: { borderRadius: "999px", backgroundColor: "#f4e96b", padding: "7px 10px", fontSize: "10px", fontWeight: 850 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", padding: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "10px", fontWeight: 850 },
  fieldWide: { display: "flex", flexDirection: "column", gap: "6px", minWidth: "220px", fontSize: "10px", fontWeight: 850, gridColumn: "span 2" },
  input: { minHeight: "39px", border: "1px solid #a1a1aa", borderRadius: "7px", padding: "8px 9px", boxSizing: "border-box", backgroundColor: "#fff", fontSize: "12px" },
  actions: { display: "flex", justifyContent: "flex-end", padding: "0 16px 16px" },
  primaryButton: { border: "1px solid #111827", borderRadius: "7px", backgroundColor: "#f4e96b", padding: "9px 14px", fontSize: "10px", fontWeight: 900, cursor: "pointer" },
  error: { margin: "0 16px 12px", border: "1px solid #fecaca", borderRadius: "7px", backgroundColor: "#fff1f2", color: "#991b1b", padding: "9px 11px", fontSize: "11px", fontWeight: 750 },
  tableWrapper: { overflowX: "auto", borderTop: "1px solid #e4e4e7" },
  table: { width: "100%", minWidth: "900px", borderCollapse: "collapse" },
  th: { backgroundColor: "#111827", color: "#fff", padding: "10px", textAlign: "left", fontSize: "9px", textTransform: "uppercase" },
  td: { borderBottom: "1px solid #e4e4e7", padding: "10px", fontSize: "11px" },
  money: { borderBottom: "1px solid #e4e4e7", padding: "10px", fontSize: "11px", textAlign: "right" },
  moneyStrong: { borderBottom: "1px solid #e4e4e7", padding: "10px", fontSize: "11px", textAlign: "right", fontWeight: 900 },
  empty: { padding: "30px", textAlign: "center", color: "#64748b", fontSize: "11px" },
  deleteButton: { border: "1px solid #fca5a5", borderRadius: "6px", backgroundColor: "#fff1f2", color: "#991b1b", padding: "6px 8px", fontSize: "9px", fontWeight: 850, cursor: "pointer" },
};
