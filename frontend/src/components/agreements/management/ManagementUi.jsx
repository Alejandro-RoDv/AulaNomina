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
  wrapper: { display: "flex", flexDirection: "column", gap: "10px", color: "#111827" },
  topBar: { display: "grid", gridTemplateColumns: "minmax(260px, 420px) 1fr", gap: "16px", alignItems: "center", borderBottom: "1px solid #e5e7eb", padding: "6px 0 12px", backgroundColor: "#fff" },
  titleBlock: { display: "flex", flexDirection: "column", gap: "2px" },
  pageTitle: { margin: 0, fontSize: "22px", lineHeight: 1.15, fontWeight: 850, color: "#111827" },
  pageSubtitle: { margin: 0, maxWidth: "520px", color: "#6b7280", fontSize: "13px", fontWeight: 600 },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "7px", flexWrap: "wrap" },
  selectLarge: { minWidth: "360px", height: "34px", padding: "6px 9px", border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#fff", fontSize: "13px" },
  primaryButton: { height: "34px", backgroundColor: "#facc15", color: "#111827", border: "1px solid #eab308", borderRadius: "6px", padding: "0 12px", fontWeight: 800, fontSize: "12px", cursor: "pointer", alignSelf: "end" },
  secondaryButton: { height: "34px", backgroundColor: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", padding: "0 12px", fontWeight: 750, fontSize: "12px", cursor: "pointer" },
  linkButton: { backgroundColor: "transparent", color: "#374151", border: 0, padding: "2px 4px", fontWeight: 750, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" },
  dangerLink: { backgroundColor: "transparent", color: "#b91c1c", border: 0, padding: "2px 4px", fontWeight: 750, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" },
  rowActions: { display: "flex", gap: "6px", alignItems: "center" },
  statusBadge: { height: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", padding: "0 10px", fontSize: "12px", fontWeight: 850, border: "1px solid #d1d5db", backgroundColor: "#f9fafb", color: "#374151" },
  activeStatus: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#166534" },
  draftStatus: { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#92400e" },
  expiredStatus: { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" },
  futureStatus: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" },
  recordHeader: { display: "grid", gridTemplateColumns: "minmax(240px, 1.4fr) repeat(3, minmax(120px, 0.7fr)) auto", alignItems: "center", gap: "12px", border: "1px solid #e5e7eb", borderLeft: "3px solid #facc15", backgroundColor: "#fff", padding: "9px 12px" },
  recordMain: { minWidth: 0 }, recordEyebrow: { display: "block", color: "#6b7280", fontSize: "10px", fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.06em" }, recordTitle: { display: "block", marginTop: "2px", fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, recordItem: { display: "flex", flexDirection: "column", gap: "1px", fontSize: "12px" }, recordActions: { display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" },
  feedbackOk: { border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4", color: "#166534", padding: "8px 10px", fontSize: "13px", fontWeight: 750 }, feedbackError: { border: "1px solid #fecaca", backgroundColor: "#fef2f2", color: "#991b1b", padding: "8px 10px", fontSize: "13px", fontWeight: 750 },
  tabs: { display: "flex", gap: "2px", borderBottom: "1px solid #d1d5db", marginTop: "2px" }, tab: { border: 0, borderBottom: "2px solid transparent", backgroundColor: "transparent", padding: "9px 12px", color: "#4b5563", fontSize: "13px", fontWeight: 750, cursor: "pointer" }, tabActive: { border: 0, borderBottom: "2px solid #facc15", backgroundColor: "#fff", padding: "9px 12px", color: "#111827", fontSize: "13px", fontWeight: 850, cursor: "pointer" },
  section: { border: "1px solid #e5e7eb", backgroundColor: "#fff" }, sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", borderBottom: "1px solid #e5e7eb", padding: "10px 12px", backgroundColor: "#f9fafb" }, sectionTitle: { margin: 0, fontSize: "15px", fontWeight: 850, color: "#111827" }, sectionSubtitle: { margin: 0, color: "#6b7280", fontSize: "12px", fontWeight: 600 },
  overviewLayout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "stretch" },
  definitionTable: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", padding: "8px 12px 14px", gap: "0 18px" }, definitionRow: { display: "grid", gridTemplateColumns: "132px minmax(0, 1fr)", gap: "10px", borderBottom: "1px solid #f3f4f6", minHeight: "38px", alignItems: "center", fontSize: "13px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px", padding: "12px" }, statCard: { border: "1px solid #e5e7eb", backgroundColor: "#fff", padding: "10px", minHeight: "54px", display: "flex", flexDirection: "column", gap: "3px", fontSize: "12px" }, alertBlock: { margin: "0 12px 12px", borderTop: "1px solid #e5e7eb", paddingTop: "10px" }, alertTitle: { margin: "0 0 6px", fontSize: "13px", fontWeight: 850 }, alertList: { margin: 0, paddingLeft: "18px", color: "#92400e", fontSize: "12px", lineHeight: 1.7, fontWeight: 700 }, emptyAlert: { color: "#166534", fontSize: "12px", fontWeight: 750 },
  actionBar: { display: "flex", gap: "6px", flexWrap: "wrap", padding: "10px 12px", borderBottom: "1px solid #f3f4f6" }, inlineForm: { margin: "10px 12px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", padding: "10px" }, inlineTitle: { margin: "0 0 10px", fontSize: "13px", fontWeight: 850 }, inlineGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px", alignItems: "end" },
  field: { display: "flex", flexDirection: "column", gap: "5px", color: "#374151", fontSize: "12px", fontWeight: 750 }, input: { height: "34px", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: "5px", fontSize: "13px", backgroundColor: "#fff" }, textarea: { minHeight: "70px", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: "5px", fontSize: "13px", backgroundColor: "#fff", resize: "vertical" },
  classificationLayout: { display: "grid", gridTemplateColumns: "420px minmax(0, 1fr)", gap: "14px", padding: "12px" }, leftPane: { border: "1px solid #e5e7eb", backgroundColor: "#fff" }, rightPane: { border: "1px solid #e5e7eb", backgroundColor: "#fff" }, paneTitle: { padding: "10px 12px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", fontWeight: 850, backgroundColor: "#f9fafb" }, paneHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }, paneHeading: { margin: 0, fontSize: "14px", fontWeight: 850 }, paneSubtitle: { margin: "2px 0 0", color: "#6b7280", fontSize: "12px" }, rowSelect: { border: 0, background: "transparent", padding: 0, textAlign: "left", fontWeight: 750, cursor: "pointer" }, rowSelectActive: { border: 0, background: "#fffbea", borderLeft: "3px solid #facc15", padding: "5px 7px", textAlign: "left", fontWeight: 850, cursor: "pointer", width: "100%" },
  tableBox: { overflowX: "auto", borderTop: "1px solid #e5e7eb" }, table: { width: "100%", borderCollapse: "collapse", fontSize: "12.5px", backgroundColor: "#fff" }, th: { textAlign: "left", padding: "8px", borderBottom: "1px solid #d1d5db", backgroundColor: "#f9fafb", color: "#374151", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }, td: { padding: "8px", borderBottom: "1px solid #f3f4f6", color: "#111827", verticalAlign: "middle", whiteSpace: "nowrap" },
  salaryBlock: { padding: "12px", borderBottom: "1px solid #f3f4f6" }, ruleStack: { display: "flex", flexDirection: "column", gap: "12px", padding: "12px" }, subsectionTitle: { margin: "0 0 8px", paddingBottom: "6px", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: 850 }, formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: "10px" }, formGridThree: { display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr))", gap: "10px" }, helpText: { margin: "12px", color: "#4b5563", fontSize: "13px" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }, modal: { width: "min(1080px, calc(100vw - 48px))", backgroundColor: "#fff", border: "1px solid #d1d5db", boxShadow: "0 24px 70px rgba(0,0,0,0.24)" }, modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", padding: "16px 18px" }, closeButton: { border: 0, backgroundColor: "transparent", fontSize: "24px", cursor: "pointer" }, modalForm: { padding: "18px", display: "flex", flexDirection: "column", gap: "16px" }, modalGroup: { border: "1px solid #e5e7eb", padding: "14px", backgroundColor: "#f9fafb" }, modalActions: { display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "4px" },
};
