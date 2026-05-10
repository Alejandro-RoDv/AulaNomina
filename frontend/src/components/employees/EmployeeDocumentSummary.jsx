import { useMemo, useState } from "react";

const typeLabels = {
  DNI_NIE: "DNI / NIE",
  NAF: "NAF",
  SIGNED_CONTRACT: "Contrato firmado",
  MODEL_145: "Modelo 145",
  SEXUAL_OFFENCES_CERTIFICATE: "Certificado delitos sexuales",
  CONFIDENTIALITY_COMMITMENT: "Compromiso confidencialidad",
  DATA_CONSENT: "Consentimiento datos",
  DEGREE_CERTIFICATE: "Titulación",
  OTHER: "Otros",
};

const statusLabels = {
  pending: "Pendiente",
  received: "Entregado",
  expired: "Caducado",
  not_applicable: "No aplica",
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getStatusStyle(status) {
  const base = {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 900,
  };
  if (status === "received") return { ...base, backgroundColor: "#dcfce7", color: "#166534" };
  if (status === "expired") return { ...base, backgroundColor: "#fee2e2", color: "#991b1b" };
  if (status === "not_applicable") return { ...base, backgroundColor: "#e5e7eb", color: "#374151" };
  return { ...base, backgroundColor: "#fef3c7", color: "#92400e" };
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function getEmployeeDocuments(documents, employeeId) {
  return documents.filter((document) => Number(document.employee_id) === Number(employeeId));
}

export default function EmployeeDocumentSummary({ employees, documents }) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [filters, setFilters] = useState({ code: "", name: "", dni: "", status: "" });

  const selectedEmployee = employees.find((employee) => Number(employee.id) === Number(selectedEmployeeId));

  const employeeRows = useMemo(() => {
    const codeFilter = normalizeText(filters.code);
    const nameFilter = normalizeText(filters.name);
    const dniFilter = normalizeText(filters.dni);
    const statusFilter = filters.status;

    return employees
      .map((employee) => {
        const employeeDocuments = getEmployeeDocuments(documents, employee.id);
        return {
          employee,
          documents: employeeDocuments,
          total: employeeDocuments.length,
          pending: employeeDocuments.filter((document) => document.status === "pending").length,
          received: employeeDocuments.filter((document) => document.status === "received").length,
          expired: employeeDocuments.filter((document) => document.status === "expired").length,
          notApplicable: employeeDocuments.filter((document) => document.status === "not_applicable").length,
        };
      })
      .filter(({ employee, documents: employeeDocuments }) => {
        const visibleCode = normalizeText(employee.employee_code || employee.id);
        const fullName = normalizeText(`${employee.first_name} ${employee.last_name}`);
        const dni = normalizeText(employee.dni);
        const matchesStatus = !statusFilter || employeeDocuments.some((document) => document.status === statusFilter);

        return (
          (!codeFilter || visibleCode.includes(codeFilter) || String(employee.id).includes(codeFilter)) &&
          (!nameFilter || fullName.includes(nameFilter)) &&
          (!dniFilter || dni.includes(dniFilter)) &&
          matchesStatus
        );
      });
  }, [employees, documents, filters]);

  const selectedDocuments = useMemo(() => {
    if (!selectedEmployee) return [];
    return getEmployeeDocuments(documents, selectedEmployee.id);
  }, [documents, selectedEmployee]);

  const selectedTotals = useMemo(() => ({
    total: selectedDocuments.length,
    pending: selectedDocuments.filter((document) => document.status === "pending").length,
    received: selectedDocuments.filter((document) => document.status === "received").length,
    expired: selectedDocuments.filter((document) => document.status === "expired").length,
    notApplicable: selectedDocuments.filter((document) => document.status === "not_applicable").length,
  }), [selectedDocuments]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => setFilters({ code: "", name: "", dni: "", status: "" });

  return (
    <section style={styles.card}>
      {!selectedEmployee ? (
        <>
          <div style={styles.header}>
            <div>
              <h3 style={styles.title}>Documentación por trabajador</h3>
              <p style={styles.subtitle}>Resumen rápido del expediente documental asociado a cada trabajador.</p>
            </div>
          </div>

          <div style={styles.filtersCard}>
            <label style={styles.label}>
              Código
              <input name="code" value={filters.code} onChange={handleFilterChange} style={styles.input} />
            </label>
            <label style={styles.label}>
              Nombre
              <input name="name" value={filters.name} onChange={handleFilterChange} style={styles.input} />
            </label>
            <label style={styles.label}>
              DNI
              <input name="dni" value={filters.dni} onChange={handleFilterChange} style={styles.input} />
            </label>
            <label style={styles.label}>
              Estado documental
              <select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}>
                <option value="">Todos</option>
                <option value="pending">Con pendientes</option>
                <option value="expired">Con caducados</option>
                <option value="received">Con entregados</option>
                <option value="not_applicable">Con no aplica</option>
              </select>
            </label>
            <button type="button" onClick={clearFilters} style={styles.secondaryButton}>Limpiar filtros</button>
          </div>

          <div style={styles.employeeList}>
            <div style={styles.employeeListHeader}>
              <span>Trabajador</span>
              <span>Documentos</span>
              <span>Estado</span>
              <span>Acción</span>
            </div>

            {employeeRows.length === 0 ? (
              <p style={styles.emptyList}>No hay trabajadores que coincidan con los filtros.</p>
            ) : (
              employeeRows.map(({ employee, total, pending, received, expired, notApplicable }) => (
                <button key={employee.id} type="button" style={styles.employeeRow} onClick={() => setSelectedEmployeeId(employee.id)}>
                  <span style={styles.employeeMainCell}>
                    <strong>{employee.first_name} {employee.last_name}</strong>
                    <small>{employee.employee_code || employee.id} · {employee.dni}</small>
                  </span>
                  <span style={styles.employeeStatsCell}>Total: {total} · Entregados: {received} · No aplica: {notApplicable}</span>
                  <span style={styles.badgeGroup}>
                    <span style={styles.pendingBadge}>Pendientes: {pending}</span>
                    <span style={styles.expiredBadge}>Caducados: {expired}</span>
                  </span>
                  <span style={styles.openBadge}>Abrir expediente</span>
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div style={styles.detailHeader}>
            <button type="button" onClick={() => setSelectedEmployeeId(null)} style={styles.secondaryButton}>← Volver al listado</button>
            <div style={styles.selectedInfo}>
              <h3 style={styles.title}>{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
              <p style={styles.subtitle}>{selectedEmployee.employee_code || selectedEmployee.id} · {selectedEmployee.dni}</p>
            </div>
            <div style={styles.selectedStats}>
              <strong>Total: {selectedTotals.total}</strong>
              <span>Pendientes: {selectedTotals.pending}</span>
              <span>Entregados: {selectedTotals.received}</span>
              <span>Caducados: {selectedTotals.expired}</span>
              <span>No aplica: {selectedTotals.notApplicable}</span>
            </div>
          </div>

          {selectedDocuments.length === 0 ? (
            <p style={styles.empty}>No hay documentos asociados a este trabajador.</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Caducidad</th>
                    <th style={styles.th}>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDocuments.map((document) => (
                    <tr key={document.id}>
                      <td style={styles.td}>{typeLabels[document.document_type] || document.document_name || document.document_type}</td>
                      <td style={styles.td}><span style={getStatusStyle(document.status)}>{statusLabels[document.status] || document.status}</span></td>
                      <td style={styles.td}>{formatDate(document.expiry_date)}</td>
                      <td style={styles.notesTd}>{document.notes || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const styles = {
  card: {
    border: "2px solid #111",
    borderRadius: "10px",
    backgroundColor: "#fff",
    padding: "18px",
    marginTop: "22px",
    boxShadow: "5px 5px 0 #e6d85c",
  },
  header: { display: "flex", justifyContent: "space-between", gap: "16px", marginBottom: "16px" },
  detailHeader: { display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "16px", alignItems: "center", borderBottom: "2px solid #111", paddingBottom: "14px", marginBottom: "14px" },
  selectedInfo: { display: "grid", gap: "2px" },
  selectedStats: { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end", fontWeight: 900 },
  title: { margin: 0, fontSize: "20px", fontWeight: 900, color: "#111827" },
  subtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  empty: { margin: 0, color: "#6b7280", fontWeight: 700 },
  filtersCard: { border: "2px solid #111", background: "#fff", padding: "14px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto", gap: "12px", alignItems: "end", marginBottom: "14px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", color: "#111" },
  input: { border: "2px solid #111", padding: "9px 10px", fontSize: "14px", fontWeight: 700, background: "#fff", color: "#111" },
  secondaryButton: { border: "2px solid #111", background: "#fff", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  employeeList: { border: "2px solid #111" },
  employeeListHeader: { display: "grid", gridTemplateColumns: "1.35fr 1.35fr 1.2fr auto", gap: "14px", padding: "10px 14px", borderBottom: "3px solid #111", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", background: "#f9fafb" },
  employeeRow: { width: "100%", display: "grid", gridTemplateColumns: "1.35fr 1.35fr 1.2fr auto", gap: "14px", alignItems: "center", border: "none", borderBottom: "1px solid #d1d5db", background: "#fff", padding: "12px 14px", textAlign: "left", cursor: "pointer", fontWeight: 800 },
  employeeMainCell: { display: "grid", gap: "4px" },
  employeeStatsCell: { fontWeight: 800 },
  badgeGroup: { display: "flex", gap: "8px", flexWrap: "wrap" },
  pendingBadge: { backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 },
  expiredBadge: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "999px", fontSize: "12px", fontWeight: 900 },
  openBadge: { border: "2px solid #111", background: "#f0df62", padding: "7px 10px", fontWeight: 900, whiteSpace: "nowrap" },
  emptyList: { margin: 0, padding: "16px", fontWeight: 800, color: "#6b7280" },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", padding: "9px", borderBottom: "2px solid #111", fontSize: "11px", textTransform: "uppercase", color: "#111827" },
  td: { padding: "9px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, verticalAlign: "top" },
  notesTd: { padding: "9px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, verticalAlign: "top", whiteSpace: "normal", minWidth: "240px" },
};
