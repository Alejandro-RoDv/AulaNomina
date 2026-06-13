import { useMemo, useState } from "react";

import { prepareMonthlyPayrolls } from "../../services/payrollApi";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const STATUS_LABELS = {
  draft: "Borrador",
  pending: "Pendiente",
  calculated: "Calculada",
  reviewed: "Revisada",
  closed: "Cerrada",
  cancelled: "Anulada",
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function MonthlyPayrollPreparation({ companies, workCenters, onPrepared }) {
  const [form, setForm] = useState({
    company_ids: [],
    center_id: "",
    period_month: String(currentMonth),
    period_year: String(currentYear),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const activeCompanies = companies.filter((company) => company.is_active);

  const filteredCenters = useMemo(() => {
    if (form.company_ids.length !== 1) return [];
    return workCenters.filter(
      (center) => center.is_active && String(center.company_id) === String(form.company_ids[0])
    );
  }, [form.company_ids, workCenters]);

  const totalProration = useMemo(
    () => (result?.payrolls || []).reduce(
      (total, item) => total + Number(item.extra_pay_proration || 0),
      0
    ),
    [result]
  );

  const handleCompanyToggle = (companyId) => {
    setForm((prev) => {
      const alreadySelected = prev.company_ids.includes(companyId);
      const nextCompanyIds = alreadySelected
        ? prev.company_ids.filter((id) => id !== companyId)
        : [...prev.company_ids, companyId];
      return {
        ...prev,
        company_ids: nextCompanyIds,
        center_id: nextCompanyIds.length === 1 ? prev.center_id : "",
      };
    });
  };

  const handleSelectAllCompanies = () => {
    setForm((prev) => ({
      ...prev,
      company_ids: activeCompanies.map((company) => company.id),
      center_id: "",
    }));
  };

  const handleClearCompanies = () => {
    setForm((prev) => ({ ...prev, company_ids: [], center_id: "" }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      setSubmitting(true);
      const data = await prepareMonthlyPayrolls({
        company_ids: form.company_ids.map(Number),
        center_id: form.center_id ? Number(form.center_id) : null,
        period_month: Number(form.period_month),
        period_year: Number(form.period_year),
        status: "pending",
      });
      setResult(data);
      if (onPrepared) await onPrepared(data);
    } catch (err) {
      setError(err.message || "Error al preparar nóminas");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h3 style={styles.sectionTitle}>Empresas</h3>
              <p style={styles.sectionHint}>Puedes seleccionar una o varias empresas y preparar todas sus nóminas de una vez.</p>
            </div>
            <div style={styles.quickActions}>
              <button type="button" onClick={handleSelectAllCompanies} style={styles.secondaryButton}>Todas</button>
              <button type="button" onClick={handleClearCompanies} style={styles.secondaryButton}>Limpiar</button>
            </div>
          </div>

          <div style={styles.companyGrid}>
            {activeCompanies.map((company) => (
              <label key={company.id} style={styles.companyOption}>
                <input
                  type="checkbox"
                  checked={form.company_ids.includes(company.id)}
                  onChange={() => handleCompanyToggle(company.id)}
                />
                <span>
                  <strong>{company.name}</strong>
                  <small>{company.ccc || "Sin CCC"}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Periodo y centro</h3>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label>Centro</label>
              <select
                name="center_id"
                value={form.center_id}
                onChange={handleChange}
                disabled={form.company_ids.length !== 1}
                style={styles.input}
              >
                <option value="">
                  {form.company_ids.length === 1 ? "Todos los centros" : "Centro disponible al elegir una sola empresa"}
                </option>
                {filteredCenters.map((center) => (
                  <option key={center.id} value={center.id}>{center.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroupSmall}>
              <label>Mes</label>
              <select name="period_month" value={form.period_month} onChange={handleChange} style={styles.input}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>{String(month).padStart(2, "0")}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroupSmall}>
              <label>Año</label>
              <input name="period_year" type="number" value={form.period_year} onChange={handleChange} style={styles.input} />
            </div>
          </div>
        </section>

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" disabled={submitting || form.company_ids.length === 0} style={styles.primaryButton}>
          {submitting ? "Preparando..." : "Preparar nóminas"}
        </button>
      </form>

      {result && (
        <section style={styles.resultBox}>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryItem}><span>Creadas</span><strong>{result.created_count}</strong></div>
            <div style={styles.summaryItem}><span>Ya existían</span><strong>{result.existing_count}</strong></div>
            <div style={styles.summaryItem}><span>Omitidas</span><strong>{result.skipped_count}</strong></div>
            <div style={styles.summaryItem}><span>Prorrata total</span><strong>{formatMoney(totalProration)} €</strong></div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Trabajador</th>
                  <th style={styles.th}>Contrato</th>
                  <th style={styles.th}>Empresa</th>
                  <th style={styles.th}>Centro</th>
                  <th style={styles.th}>Incidencias</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.thRight}>Prorrata extra</th>
                  <th style={styles.thRight}>Bruto</th>
                </tr>
              </thead>
              <tbody>
                {result.payrolls.map((item) => (
                  <tr key={`${item.contract_id}-${item.payroll_id || "new"}`}>
                    <td style={styles.tdStrong}>{item.employee_code ? `${item.employee_code} - ` : ""}{item.employee_name}</td>
                    <td style={styles.td}>{item.contract_code}</td>
                    <td style={styles.td}>{item.company_name || "-"}</td>
                    <td style={styles.td}>{item.center_name || "-"}</td>
                    <td style={styles.td}>{item.incident_summary?.length ? item.incident_summary.join("; ") : "Sin incidencias"}</td>
                    <td style={styles.td}>{STATUS_LABELS[item.status] || item.status}</td>
                    <td style={styles.tdRight}>{formatMoney(item.extra_pay_proration)} €</td>
                    <td style={styles.tdRight}>{formatMoney(item.gross_salary)} €</td>
                  </tr>
                ))}

                {result.payrolls.length === 0 && (
                  <tr><td colSpan="8" style={styles.emptyCell}>No hay contratos activos para el periodo seleccionado.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {result.skipped?.length > 0 && (
            <section style={styles.skippedBox}>
              <h3 style={styles.sectionTitle}>Omitidas con motivo</h3>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>Trabajador</th><th style={styles.th}>Contrato</th><th style={styles.th}>Motivo</th></tr></thead>
                  <tbody>
                    {result.skipped.map((item, index) => (
                      <tr key={`${item.contract_id || "sin-contrato"}-${index}`}>
                        <td style={styles.tdStrong}>{item.employee_code ? `${item.employee_code} - ` : ""}{item.employee_name || "-"}</td>
                        <td style={styles.td}>{item.contract_code || item.contract_id || "-"}</td>
                        <td style={styles.td}>{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      )}
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "18px" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  section: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start" },
  sectionTitle: { margin: 0, fontSize: "15px", fontWeight: 900, color: "#111827" },
  sectionHint: { margin: "4px 0 0", fontSize: "13px", color: "#6b7280", fontWeight: 600 },
  quickActions: { display: "flex", gap: "8px" },
  companyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "10px" },
  companyOption: { display: "flex", alignItems: "flex-start", gap: "8px", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px", cursor: "pointer" },
  formRow: { display: "flex", gap: "14px", flexWrap: "wrap" },
  formGroup: { flex: 1, minWidth: "260px", display: "flex", flexDirection: "column", gap: "6px" },
  formGroupSmall: { width: "130px", flex: "0 0 130px", display: "flex", flexDirection: "column", gap: "6px" },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  primaryButton: { backgroundColor: "#111827", color: "#ffffff", border: "none", borderRadius: "8px", padding: "12px 18px", cursor: "pointer", width: "fit-content", fontWeight: 900 },
  secondaryButton: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "8px 10px", cursor: "pointer", fontWeight: 800 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  resultBox: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "14px" },
  skippedBox: { border: "1px solid #facc15", borderRadius: "10px", backgroundColor: "#fefce8", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" },
  summaryGrid: { display: "flex", gap: "12px", flexWrap: "wrap" },
  summaryItem: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", minWidth: "120px", display: "flex", flexDirection: "column", gap: "4px" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "11px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  thRight: { textAlign: "right", padding: "11px", borderBottom: "1px solid #ddd", backgroundColor: "#f9fafb", whiteSpace: "nowrap" },
  td: { padding: "11px", borderBottom: "1px solid #eee", verticalAlign: "top" },
  tdStrong: { padding: "11px", borderBottom: "1px solid #eee", verticalAlign: "top", fontWeight: 800 },
  tdRight: { padding: "11px", borderBottom: "1px solid #eee", textAlign: "right", whiteSpace: "nowrap", verticalAlign: "top", fontWeight: 800 },
  emptyCell: { padding: "18px", color: "#6b7280", textAlign: "center" },
};
