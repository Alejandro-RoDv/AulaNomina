function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function statusLabel(value) {
  const labels = {
    new: "Nuevo",
    changed: "Importe distinto",
    reactivate: "A reactivar",
    unchanged: "Sin cambios",
    obsolete: "Posible baja",
    preserved: "Conservado",
  };
  return labels[value] || value;
}

function actionLabel(value) {
  if (value === "upsert") return "Actualizar";
  if (value === "deactivate") return "Desactivar";
  return "Sin acción";
}

function actionId(action) {
  return `${action.contract_id}::${action.concept_key}::${action.action}`;
}

export function buildDefaultConceptActions(contracts, selectedContractIds) {
  const selected = new Set(selectedContractIds);
  return (contracts || []).flatMap((contract) => {
    if (!selected.has(contract.contract_id)) return [];
    return (contract.concept_changes || [])
      .filter((item) => item.selectable && item.selected_by_default && item.proposed_action !== "none")
      .map((item) => ({
        contract_id: contract.contract_id,
        concept_key: item.concept_key,
        action: item.proposed_action,
      }));
  });
}

export default function SalaryTableConceptComparison({
  contracts,
  selectedContractIds,
  selectedActions,
  onChange,
}) {
  const selectedContracts = new Set(selectedContractIds);
  const rows = (contracts || []).flatMap((contract) => {
    if (!selectedContracts.has(contract.contract_id)) return [];
    return (contract.concept_changes || []).map((concept) => ({ contract, concept }));
  });
  const selectedActionIds = new Set(selectedActions.map(actionId));
  const recommended = buildDefaultConceptActions(contracts, selectedContractIds);
  const actionableCount = rows.filter(({ concept }) => concept.selectable).length;

  function toggle(contract, concept) {
    if (!concept.selectable || concept.proposed_action === "none") return;
    const action = {
      contract_id: contract.contract_id,
      concept_key: concept.concept_key,
      action: concept.proposed_action,
    };
    const id = actionId(action);
    if (selectedActionIds.has(id)) {
      onChange(selectedActions.filter((item) => actionId(item) !== id));
    } else {
      onChange([...selectedActions, action]);
    }
  }

  if (!selectedContractIds.length) return null;

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h4 style={styles.title}>Comparación de conceptos permanentes</h4>
          <p style={styles.subtitle}>Solo se modificarán las acciones marcadas. Los conceptos personalizados y de sistema se conservan.</p>
        </div>
        <div style={styles.headerActions}>
          <span>{selectedActions.length} acciones seleccionadas de {actionableCount}</span>
          <button type="button" onClick={() => onChange(recommended)} style={styles.linkButton}>Seleccionar recomendadas</button>
          <button type="button" onClick={() => onChange([])} style={styles.linkButton}>No actualizar conceptos</button>
        </div>
      </header>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Sel.</th>
              <th style={styles.th}>Trabajador</th>
              <th style={styles.th}>Concepto</th>
              <th style={styles.th}>Origen</th>
              <th style={styles.th}>Importe actual</th>
              <th style={styles.th}>Importe nuevo</th>
              <th style={styles.th}>Diferencia</th>
              <th style={styles.th}>Situación</th>
              <th style={styles.th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ contract, concept }) => {
              const action = {
                contract_id: contract.contract_id,
                concept_key: concept.concept_key,
                action: concept.proposed_action,
              };
              const checked = selectedActionIds.has(actionId(action));
              return (
                <tr key={`${contract.contract_id}-${concept.concept_key}`}>
                  <td style={styles.td}>
                    <input
                      type="checkbox"
                      disabled={!concept.selectable}
                      checked={checked}
                      onChange={() => toggle(contract, concept)}
                    />
                  </td>
                  <td style={styles.td}>
                    <strong>{contract.employee_name || `Trabajador ${contract.employee_id}`}</strong>
                    <span style={styles.muted}>{contract.contract_code || `Contrato #${contract.contract_id}`}</span>
                  </td>
                  <td style={styles.td}><strong>{concept.name}</strong><span style={styles.reason}>{concept.reason}</span></td>
                  <td style={styles.td}>{concept.source_type === "AGREEMENT" ? "Convenio" : concept.source_type}</td>
                  <td style={styles.tdAmount}>{money(concept.current_amount)}</td>
                  <td style={styles.tdAmount}>{money(concept.target_amount)}</td>
                  <td style={styles.tdAmount}>{money(concept.difference)}</td>
                  <td style={styles.td}>{statusLabel(concept.status)}</td>
                  <td style={styles.td}>{actionLabel(concept.proposed_action)}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan="9" style={styles.emptyCell}>Los contratos seleccionados no tienen conceptos permanentes comparables.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={styles.legend}>
        <span><strong>Nuevos, distintos o inactivos:</strong> seleccionados por defecto.</span>
        <span><strong>Posible baja:</strong> requiere selección expresa.</span>
        <span><strong>Sin cambios, personalizados o de sistema:</strong> no se modifican.</span>
      </div>
    </section>
  );
}

const styles = {
  wrapper: { border: "1px solid #d1d5db", background: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", padding: "10px 12px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  title: { margin: 0, color: "#111827", fontSize: "14px", fontWeight: 850 },
  subtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "11px" },
  headerActions: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: "10px", color: "#4b5563", fontSize: "11px" },
  linkButton: { border: 0, background: "transparent", color: "#374151", padding: 0, fontSize: "11px", fontWeight: 750, cursor: "pointer", textDecoration: "underline" },
  tableWrap: { overflow: "auto", maxHeight: "420px" },
  table: { width: "100%", minWidth: "1120px", borderCollapse: "collapse" },
  th: { position: "sticky", top: 0, textAlign: "left", padding: "7px", background: "#f9fafb", borderBottom: "1px solid #d1d5db", color: "#374151", fontSize: "10px", fontWeight: 850 },
  td: { padding: "7px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontSize: "11px", verticalAlign: "top" },
  tdAmount: { padding: "7px", borderBottom: "1px solid #e5e7eb", color: "#111827", fontSize: "11px", fontWeight: 800, textAlign: "right", verticalAlign: "top" },
  muted: { display: "block", marginTop: "2px", color: "#6b7280", fontSize: "9px" },
  reason: { display: "block", marginTop: "2px", maxWidth: "300px", color: "#6b7280", fontSize: "9px" },
  emptyCell: { padding: "15px", color: "#6b7280", fontSize: "11px" },
  legend: { display: "flex", flexWrap: "wrap", gap: "14px", padding: "9px 12px", background: "#fffbeb", borderTop: "1px solid #fde68a", color: "#78350f", fontSize: "10px" },
};
