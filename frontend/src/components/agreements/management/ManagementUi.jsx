/* eslint-disable react-refresh/only-export-components */

export function Section({ title, subtitle, children }) {
  return <section style={styles.section}><header style={styles.sectionHeader}><h3 style={styles.sectionTitle}>{title}</h3>{subtitle && <p style={styles.sectionSubtitle}>{subtitle}</p>}</header>{children}</section>;
}

export function InlineForm({ title, onSubmit, children }) {
  return <form onSubmit={onSubmit} style={styles.inlineForm}><h3 style={styles.inlineTitle}>{title}</h3><div style={styles.inlineGrid}>{children}</div></form>;
}

export function Field({ label, children }) {
  return <label style={styles.field}>{label}{children}</label>;
}

export function SimpleTable({ columns, rows, empty }) {
  return <div style={styles.tableBox}><table style={styles.table}><thead><tr>{columns.map((column) => <th key={column} style={styles.th}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} style={styles.td}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={columns.length} style={styles.td}>{empty}</td></tr>}</tbody></table></div>;
}

export function ActionBar({ actions }) {
  return <div style={styles.actionBar}>{actions.map(([label, onClick, type]) => <button key={label} type="button" onClick={onClick} style={type === "primary" ? styles.primaryButton : styles.secondaryButton}>{label}</button>)}</div>;
}

export function RowActions({ onEdit, onDelete }) {
  return <div style={styles.rowActions}><button type="button" onClick={onEdit} style={styles.linkButton}>Editar</button><button type="button" onClick={onDelete} style={styles.dangerLink}>Eliminar</button></div>;
}

export function DefinitionTable({ rows }) {
  return <div style={styles.definitionTable}>{rows.map(([label, value]) => <div key={label} style={styles.definitionRow}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function StatsGrid({ items }) {
  return <div style={styles.statsGrid}>{items.map(([label, value]) => <div key={label} style={styles.statCard}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

export function AlertsList({ alerts }) {
  return alerts.length ? <ul style={styles.alertList}>{alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul> : <div style={styles.emptyAlert}>Sin alertas críticas.</div>;
}

export function Modal({ title, onClose, children }) {
  return <div style={styles.modalOverlay}><div style={styles.modal}><header style={styles.modalHeader}><h3>{title}</h3><button type="button" onClick={onClose} style={styles.closeButton}>×</button></header>{children}</div></div>;
}

export const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px", color: "#0f172a" },
  topBar: { display: "grid", gridTemplateColumns: "minmax(260px, 0.8fr) minmax(0, 1.2fr)", gap: "24px", alignItems: "end", borderBottom: "1px solid #e2e8f0", padding: "0 0 18px", backgroundColor: "transparent" },
  titleBlock: { display: "flex", flexDirection: "column", gap: "4px" },
  pageTitle: { margin: 0, fontSize: "18px", lineHeight: 1.2, fontWeight: 800, color: "#0f172a" },
  pageSubtitle: { margin: 0, maxWidth: "560px", color: "#64748b", fontSize: "13px", fontWeight: 500, lineHeight: 1.45 },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" },
  selectLarge: { minWidth: "360px", minHeight: "38px", padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: "7px", backgroundColor: "#fff", color: "#0f172a", fontSize: "13px" },
  primaryButton: { minHeight: "36px", backgroundColor: "#2563eb", color: "#fff", border: "1px solid #2563eb", borderRadius: "7px", padding: "0 13px", fontWeight: 700, fontSize: "12px", cursor: "pointer", alignSelf: "end" },
  secondaryButton: { minHeight: "36px", backgroundColor: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: "7px", padding: "0 13px", fontWeight: 700, fontSize: "12px", cursor: "pointer" },
  linkButton: { backgroundColor: "transparent", color: "#2563eb", border: 0, padding: "2px 4px", fontWeight: 700, fontSize: "12px", cursor: "pointer", textDecoration: "none" },
  dangerLink: { backgroundColor: "transparent", color: "#b91c1c", border: 0, padding: "2px 4px", fontWeight: 700, fontSize: "12px", cursor: "pointer", textDecoration: "none" },
  rowActions: { display: "flex", gap: "8px", alignItems: "center" },
  statusBadge: { height: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", padding: "0 10px", fontSize: "12px", fontWeight: 800, border: "1px solid #d1d5db", backgroundColor: "#f8fafc", color: "#475569" },
  activeStatus: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#166534" },
  draftStatus: { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#92400e" },
  expiredStatus: { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" },
  futureStatus: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" },
  recordHeader: { display: "grid", gridTemplateColumns: "minmax(240px, 1.4fr) repeat(3, minmax(120px, 0.7fr)) auto", alignItems: "center", gap: "18px", borderBottom: "1px solid #e2e8f0", backgroundColor: "transparent", padding: "0 0 18px" },
  recordMain: { minWidth: 0 },
  recordEyebrow: { display: "block", color: "#64748b", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" },
  recordTitle: { display: "block", marginTop: "3px", fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  recordItem: { display: "flex", flexDirection: "column", gap: "2px", color: "#64748b", fontSize: "12px" },
  recordActions: { display: "flex", gap: "10px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" },
  feedbackOk: { border: "1px solid #bbf7d0", borderRadius: "7px", backgroundColor: "#f0fdf4", color: "#166534", padding: "9px 11px", fontSize: "13px", fontWeight: 700 },
  feedbackError: { border: "1px solid #fecaca", borderRadius: "7px", backgroundColor: "#fef2f2", color: "#991b1b", padding: "9px 11px", fontSize: "13px", fontWeight: 700 },
  tabs: { display: "flex", gap: "22px", borderBottom: "1px solid #e2e8f0", marginTop: 0 },
  tab: { border: 0, borderBottom: "2px solid transparent", backgroundColor: "transparent", padding: "0 0 11px", color: "#64748b", fontSize: "13px", fontWeight: 700, cursor: "pointer" },
  tabActive: { border: 0, borderBottom: "2px solid #2563eb", backgroundColor: "transparent", padding: "0 0 11px", color: "#1d4ed8", fontSize: "13px", fontWeight: 800, cursor: "pointer" },
  section: { border: 0, borderTop: "1px solid #e2e8f0", backgroundColor: "transparent" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px", padding: "16px 0 10px", backgroundColor: "transparent" },
  sectionTitle: { margin: 0, fontSize: "15px", fontWeight: 800, color: "#0f172a" },
  sectionSubtitle: { margin: 0, color: "#64748b", fontSize: "12px", fontWeight: 500 },
  overviewLayout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "32px", alignItems: "start" },
  definitionTable: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", padding: "0 0 8px", gap: "0 22px" },
  definitionRow: { display: "grid", gridTemplateColumns: "132px minmax(0, 1fr)", gap: "10px", borderBottom: "1px solid #f1f5f9", minHeight: "40px", alignItems: "center", fontSize: "13px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0", padding: "0 0 12px" },
  statCard: { borderRight: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", backgroundColor: "transparent", padding: "12px", minHeight: "58px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "3px", color: "#64748b", fontSize: "12px", textAlign: "center" },
  alertBlock: { margin: "12px 0 0", borderTop: "1px solid #e2e8f0", paddingTop: "12px" },
  alertTitle: { margin: "0 0 6px", fontSize: "13px", fontWeight: 800 },
  alertList: { margin: 0, paddingLeft: "18px", color: "#92400e", fontSize: "12px", lineHeight: 1.7, fontWeight: 600 },
  emptyAlert: { color: "#166534", fontSize: "12px", fontWeight: 700 },
  actionBar: { display: "flex", gap: "8px", flexWrap: "wrap", padding: "12px 0", borderBottom: "1px solid #e2e8f0" },
  inlineForm: { margin: "14px 0", border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc", padding: "14px" },
  inlineTitle: { margin: "0 0 12px", fontSize: "13px", fontWeight: 800 },
  inlineGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: "6px", color: "#475569", fontSize: "12px", fontWeight: 700 },
  input: { minHeight: "38px", padding: "7px 9px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", backgroundColor: "#fff", color: "#0f172a" },
  textarea: { minHeight: "76px", padding: "8px 9px", border: "1px solid #cbd5e1", borderRadius: "7px", fontSize: "13px", backgroundColor: "#fff", resize: "vertical", color: "#0f172a" },
  classificationLayout: { display: "grid", gridTemplateColumns: "380px minmax(0, 1fr)", gap: "24px", padding: "16px 0" },
  leftPane: { border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#fff" },
  rightPane: { border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#fff" },
  paneTitle: { padding: "11px 12px", borderBottom: "1px solid #e2e8f0", fontSize: "13px", fontWeight: 800, backgroundColor: "#f8fafc" },
  paneHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", padding: "11px 12px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" },
  paneHeading: { margin: 0, fontSize: "14px", fontWeight: 800 },
  paneSubtitle: { margin: "3px 0 0", color: "#64748b", fontSize: "12px" },
  rowSelect: { border: 0, background: "transparent", padding: 0, textAlign: "left", fontWeight: 700, cursor: "pointer" },
  rowSelectActive: { border: 0, background: "#eff6ff", borderLeft: "3px solid #2563eb", padding: "6px 8px", textAlign: "left", fontWeight: 800, cursor: "pointer", width: "100%", color: "#1d4ed8" },
  tableBox: { overflowX: "auto", borderTop: "1px solid #e2e8f0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12.5px", backgroundColor: "#fff" },
  th: { textAlign: "left", padding: "9px", borderBottom: "1px solid #cbd5e1", backgroundColor: "#f8fafc", color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" },
  td: { padding: "9px", borderBottom: "1px solid #f1f5f9", color: "#0f172a", verticalAlign: "middle", whiteSpace: "nowrap" },
  salaryBlock: { padding: "14px 0", borderBottom: "1px solid #e2e8f0" },
  ruleStack: { display: "flex", flexDirection: "column", gap: "18px", padding: "14px 0" },
  subsectionTitle: { margin: "0 0 10px", paddingBottom: "7px", borderBottom: "1px solid #e2e8f0", fontSize: "14px", fontWeight: 800 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: "12px" },
  formGridThree: { display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: "12px" },
  helpText: { margin: "12px 0", color: "#475569", fontSize: "13px" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(15, 23, 42, 0.48)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { width: "min(1080px, calc(100vw - 48px))", backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "10px", boxShadow: "0 24px 70px rgba(15,23,42,0.22)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", padding: "16px 18px" },
  closeButton: { border: 0, backgroundColor: "transparent", fontSize: "24px", cursor: "pointer", color: "#334155" },
  modalForm: { padding: "18px", display: "flex", flexDirection: "column", gap: "18px" },
  modalGroup: { borderTop: "1px solid #e2e8f0", padding: "14px 0 0", backgroundColor: "transparent" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" },
};
