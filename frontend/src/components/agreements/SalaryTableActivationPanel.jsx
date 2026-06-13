import { useEffect, useMemo, useState } from "react";

import SalaryTableConceptComparison, {
  buildDefaultConceptActions,
} from "./SalaryTableConceptComparison";
import {
  activateSalaryTable,
  fetchSalaryTableActivationPreview,
  migrateContractsToSalaryTable,
} from "../../services/salaryTableActivationApi";

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function statusLabel(value) {
  const labels = {
    draft: "Borrador",
    active: "Activa",
    historical: "Histórica",
    pending_review: "Pendiente de revisión",
  };
  return labels[value] || value || "—";
}

function eligibilityLabel(value) {
  if (value === "eligible") return "Migrable";
  if (value === "already_on_target") return "Ya actualizada";
  return "Bloqueada";
}

function mergeActions(current, additions) {
  const result = new Map();
  [...current, ...additions].forEach((item) => {
    result.set(`${item.contract_id}::${item.concept_key}::${item.action}`, item);
  });
  return Array.from(result.values());
}

function conceptSummary(item) {
  const parts = [];
  if (item.new_concepts) parts.push(`${item.new_concepts} nuevos`);
  if (item.changed_concepts) parts.push(`${item.changed_concepts} cambios`);
  if (item.reactivated_concepts) parts.push(`${item.reactivated_concepts} reactivaciones`);
  if (item.obsolete_concepts) parts.push(`${item.obsolete_concepts} posibles bajas`);
  if (!parts.length) return "Sin cambios";
  return parts.join(" · ");
}

export default function SalaryTableActivationPanel({ agreement, onChanged }) {
  const tables = agreement?.salary_tables || [];
  const defaultTarget = tables.find((table) => table.status === "pending_review")
    || tables.find((table) => table.status === "draft")
    || tables.find((table) => table.status === "active")
    || tables[0]
    || null;

  const [open, setOpen] = useState(false);
  const [targetTableId, setTargetTableId] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [updateSalaryBase, setUpdateSalaryBase] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [conceptActions, setConceptActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [migrationResult, setMigrationResult] = useState(null);

  const targetTable = useMemo(
    () => tables.find((table) => String(table.id) === String(targetTableId)) || defaultTarget,
    [tables, targetTableId, defaultTarget]
  );

  const eligibleIds = useMemo(
    () => (preview?.contracts || [])
      .filter((item) => item.eligibility === "eligible")
      .map((item) => item.contract_id),
    [preview]
  );

  useEffect(() => {
    setTargetTableId(defaultTarget?.id ? String(defaultTarget.id) : "");
    setPreview(null);
    setSelectedIds([]);
    setConceptActions([]);
    setMessage("");
    setError("");
    setMigrationResult(null);
  }, [agreement?.id, tables.length]);

  async function loadPreview(tableId = targetTable?.id, preserveFeedback = false) {
    if (!tableId) return;
    setLoading(true);
    setError("");
    if (!preserveFeedback) {
      setMessage("");
      setMigrationResult(null);
    }
    try {
      const data = await fetchSalaryTableActivationPreview(tableId, activeOnly);
      const defaultIds = data.contracts
        .filter((item) => item.eligibility === "eligible")
        .map((item) => item.contract_id);
      setPreview(data);
      setSelectedIds(defaultIds);
      setConceptActions(buildDefaultConceptActions(data.contracts, defaultIds));
    } catch (err) {
      setError(err.message || "No se pudo revisar la activación.");
    } finally {
      setLoading(false);
    }
  }

  function resetSelection() {
    setPreview(null);
    setSelectedIds([]);
    setConceptActions([]);
    setMessage("");
    setError("");
    setMigrationResult(null);
  }

  function changeTarget(value) {
    setTargetTableId(value);
    resetSelection();
  }

  function toggleContract(contractId) {
    const isSelected = selectedIds.includes(contractId);
    if (isSelected) {
      setSelectedIds((current) => current.filter((id) => id !== contractId));
      setConceptActions((current) => current.filter((item) => item.contract_id !== contractId));
      return;
    }

    const nextIds = [...selectedIds, contractId];
    const defaults = buildDefaultConceptActions(preview?.contracts || [], [contractId]);
    setSelectedIds(nextIds);
    setConceptActions((current) => mergeActions(current, defaults));
  }

  function toggleAllEligible() {
    if (selectedIds.length === eligibleIds.length) {
      setSelectedIds([]);
      setConceptActions([]);
      return;
    }
    setSelectedIds(eligibleIds);
    setConceptActions(buildDefaultConceptActions(preview?.contracts || [], eligibleIds));
  }

  async function handleActivate() {
    if (!targetTable?.id) return;
    const activeNames = preview?.current_active_table_names || [];
    const replacement = activeNames.filter((name) => name !== targetTable.name);
    const detail = replacement.length
      ? ` Las tablas ${replacement.join(", ")} pasarán a históricas.`
      : "";
    if (!window.confirm(`¿Activar ${targetTable.name}?${detail} Los contratos no se modificarán todavía.`)) return;

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await activateSalaryTable(targetTable.id);
      setMessage(result.message);
      await onChanged?.();
      await loadPreview(targetTable.id, true);
    } catch (err) {
      setError(err.message || "No se pudo activar la tabla salarial.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMigrate() {
    if (!targetTable?.id || !selectedIds.length) {
      setError("Selecciona al menos un contrato migrable.");
      return;
    }
    if (preview?.target_table_status !== "active") {
      setError("Activa primero la tabla salarial.");
      return;
    }

    const selectedSet = new Set(selectedIds);
    const selectedConceptActions = conceptActions.filter((item) => selectedSet.has(item.contract_id));
    const salaryText = updateSalaryBase
      ? " También se sustituirá el salario base por el de la nueva fila."
      : " El salario base actual se conservará.";
    const conceptsText = selectedConceptActions.length
      ? ` Se aplicarán ${selectedConceptActions.length} acciones sobre conceptos permanentes.`
      : " Los conceptos permanentes se conservarán sin cambios.";
    if (!window.confirm(`¿Migrar ${selectedIds.length} contratos a ${targetTable.name}?${salaryText}${conceptsText}`)) return;

    setLoading(true);
    setError("");
    setMessage("");
    setMigrationResult(null);
    try {
      const result = await migrateContractsToSalaryTable(targetTable.id, {
        contract_ids: selectedIds,
        migrate_all_eligible: false,
        active_contracts_only: activeOnly,
        update_salary_base: updateSalaryBase,
        concept_actions: selectedConceptActions,
      });
      setMigrationResult(result);
      setMessage(`${result.migrated_contracts} contratos migrados a ${result.target_table_name}.`);
      await onChanged?.();
      await loadPreview(targetTable.id, true);
    } catch (err) {
      setError(err.message || "No se pudieron migrar los contratos.");
    } finally {
      setLoading(false);
    }
  }

  if (!tables.length) return null;

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>Activación y migración</h3>
          <p style={styles.subtitle}>Activa una única tabla y decide qué contratos y conceptos permanentes deben actualizarse.</p>
        </div>
        <button type="button" onClick={() => setOpen((current) => !current)} style={styles.toggleButton}>
          {open ? "Cerrar" : "Gestionar activación"}
        </button>
      </header>

      {open && (
        <div style={styles.body}>
          <div style={styles.controls}>
            <label style={styles.field}>Tabla candidata
              <select value={targetTable?.id || ""} onChange={(event) => changeTarget(event.target.value)} style={styles.input}>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name} · {table.year || "sin año"} · {statusLabel(table.status)}
                  </option>
                ))}
              </select>
            </label>
            <label style={styles.check}>
              <input type="checkbox" checked={activeOnly} onChange={(event) => { setActiveOnly(event.target.checked); resetSelection(); }} />
              Solo contratos activos
            </label>
            <button type="button" onClick={() => loadPreview()} disabled={loading} style={styles.secondaryButton}>
              {loading ? "Revisando…" : "Revisar contratos afectados"}
            </button>
          </div>

          {error && <div style={styles.error}>{error}</div>}
          {message && <div style={styles.success}>{message}</div>}
          {migrationResult && (
            <div style={styles.resultGrid}>
              <Summary label="Contratos migrados" value={migrationResult.migrated_contracts} />
              <Summary label="Conceptos creados" value={migrationResult.concepts_created} />
              <Summary label="Conceptos actualizados" value={migrationResult.concepts_updated} />
              <Summary label="Conceptos reactivados" value={migrationResult.concepts_reactivated} />
              <Summary label="Conceptos desactivados" value={migrationResult.concepts_deactivated} />
            </div>
          )}
          {migrationResult?.warnings?.length > 0 && (
            <div style={styles.warning}>{migrationResult.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>
          )}
          {migrationResult?.concept_actions_skipped?.length > 0 && (
            <div style={styles.warning}>
              <strong>Acciones de conceptos omitidas</strong>
              {migrationResult.concept_actions_skipped.map((item) => <span key={`${item.contract_id}-${item.concept_key}`}>Contrato {item.contract_id}: {item.reason}</span>)}
            </div>
          )}

          {preview && (
            <>
              <div style={styles.summaryGrid}>
                <Summary label="Estado de la candidata" value={statusLabel(preview.target_table_status)} />
                <Summary label="Tablas activas actuales" value={preview.current_active_table_names.join(", ") || "Ninguna"} />
                <Summary label="Contratos migrables" value={preview.eligible_contracts} />
                <Summary label="Ya actualizados" value={preview.already_on_target} />
                <Summary label="Bloqueados" value={preview.blocked_contracts} />
              </div>

              {preview.duplicate_category_rows?.length > 0 && (
                <div style={styles.warning}>Hay categorías con más de una fila en la tabla destino. Se utilizará la primera fila registrada.</div>
              )}

              <div style={styles.tableHeader}>
                <div>
                  <strong>Contratos del convenio</strong>
                  <span>{selectedIds.length} seleccionados de {eligibleIds.length} migrables</span>
                </div>
                <button type="button" onClick={toggleAllEligible} style={styles.linkButton}>
                  {selectedIds.length === eligibleIds.length ? "Deseleccionar todos" : "Seleccionar migrables"}
                </button>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Sel.</th>
                      <th style={styles.th}>Trabajador</th>
                      <th style={styles.th}>Contrato</th>
                      <th style={styles.th}>Categoría</th>
                      <th style={styles.th}>Tabla actual</th>
                      <th style={styles.th}>Base destino</th>
                      <th style={styles.th}>Conceptos</th>
                      <th style={styles.th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.contracts.map((item) => {
                      const eligible = item.eligibility === "eligible";
                      return (
                        <tr key={item.contract_id}>
                          <td style={styles.td}><input type="checkbox" disabled={!eligible} checked={selectedIds.includes(item.contract_id)} onChange={() => toggleContract(item.contract_id)} /></td>
                          <td style={styles.td}><strong>{item.employee_name || `Trabajador ${item.employee_id}`}</strong><span style={styles.muted}>{item.employee_code || "Sin código"}</span></td>
                          <td style={styles.td}>{item.contract_code || `#${item.contract_id}`}</td>
                          <td style={styles.td}>{item.professional_category_name || "Sin categoría"}</td>
                          <td style={styles.td}>{item.current_salary_table_name || "Sin tabla"}</td>
                          <td style={styles.tdAmount}>{money(item.target_base_salary)}</td>
                          <td style={styles.td}><span>{conceptSummary(item)}</span>{item.preserved_concepts > 0 && <span style={styles.muted}>{item.preserved_concepts} personalizados/sistema conservados</span>}</td>
                          <td style={styles.td}><strong>{eligibilityLabel(item.eligibility)}</strong>{item.reason && <span style={styles.reason}>{item.reason}</span>}</td>
                        </tr>
                      );
                    })}
                    {!preview.contracts.length && <tr><td colSpan="8" style={styles.emptyCell}>No hay contratos dentro del ámbito seleccionado.</td></tr>}
                  </tbody>
                </table>
              </div>

              <SalaryTableConceptComparison
                contracts={preview.contracts}
                selectedContractIds={selectedIds}
                selectedActions={conceptActions}
                onChange={setConceptActions}
              />

              <div style={styles.footer}>
                <label style={styles.check}>
                  <input type="checkbox" checked={updateSalaryBase} onChange={(event) => setUpdateSalaryBase(event.target.checked)} />
                  Actualizar también el salario base de los contratos migrados
                </label>
                <div style={styles.actions}>
                  {preview.target_table_status !== "active" && <button type="button" onClick={handleActivate} disabled={loading} style={styles.activateButton}>Activar tabla</button>}
                  <button type="button" onClick={handleMigrate} disabled={loading || preview.target_table_status !== "active" || !selectedIds.length} style={preview.target_table_status === "active" && selectedIds.length ? styles.primaryButton : styles.disabledButton}>Migrar seleccionados</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Summary({ label, value }) {
  return <div style={styles.summary}><span>{label}</span><strong>{value}</strong></div>;
}

const styles = {
  wrapper: { border: "1px solid #d1d5db", background: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", background: "#f9fafb" },
  title: { margin: 0, fontSize: "15px", fontWeight: 850, color: "#111827" },
  subtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "12px" },
  toggleButton: { height: "32px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 12px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  body: { borderTop: "1px solid #e5e7eb", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" },
  controls: { display: "grid", gridTemplateColumns: "minmax(300px, 1fr) auto auto", gap: "12px", alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 800 },
  input: { width: "100%", height: "34px", border: "1px solid #d1d5db", background: "#fff", padding: "6px 8px", fontSize: "12px" },
  check: { minHeight: "34px", display: "flex", alignItems: "center", gap: "8px", color: "#374151", fontSize: "12px", fontWeight: 750 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px", padding: "10px", border: "1px solid #bbf7d0", background: "#f0fdf4" },
  summary: { border: "1px solid #e5e7eb", padding: "9px", display: "flex", flexDirection: "column", gap: "3px", color: "#374151", fontSize: "11px" },
  tableHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" },
  tableWrap: { overflowX: "auto", maxHeight: "420px", border: "1px solid #e5e7eb" },
  table: { width: "100%", minWidth: "1080px", borderCollapse: "collapse" },
  th: { position: "sticky", top: 0, textAlign: "left", padding: "8px", background: "#f9fafb", borderBottom: "1px solid #d1d5db", color: "#374151", fontSize: "11px", fontWeight: 850 },
  td: { padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontSize: "12px", verticalAlign: "top" },
  tdAmount: { padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#111827", fontSize: "12px", fontWeight: 850, textAlign: "right" },
  muted: { display: "block", marginTop: "2px", color: "#6b7280", fontSize: "10px" },
  reason: { display: "block", marginTop: "3px", color: "#6b7280", fontSize: "10px", maxWidth: "260px" },
  emptyCell: { padding: "16px", color: "#6b7280", fontSize: "12px" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" },
  actions: { display: "flex", gap: "8px" },
  primaryButton: { height: "34px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 14px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  activateButton: { height: "34px", border: "1px solid #eab308", background: "#facc15", color: "#111827", padding: "0 14px", fontSize: "12px", fontWeight: 850, cursor: "pointer" },
  secondaryButton: { height: "34px", border: "1px solid #d1d5db", background: "#fff", color: "#374151", padding: "0 12px", fontSize: "12px", fontWeight: 800, cursor: "pointer" },
  disabledButton: { height: "34px", border: "1px solid #e5e7eb", background: "#f3f4f6", color: "#9ca3af", padding: "0 14px", fontSize: "12px", fontWeight: 850, cursor: "not-allowed" },
  linkButton: { border: 0, background: "transparent", color: "#374151", padding: 0, fontSize: "12px", fontWeight: 750, cursor: "pointer", textDecoration: "underline" },
  error: { padding: "9px 10px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: "12px", fontWeight: 750 },
  success: { padding: "9px 10px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontSize: "12px", fontWeight: 750 },
  warning: { padding: "9px 10px", border: "1px solid #fde68a", background: "#fffbeb", color: "#78350f", display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px" },
};
