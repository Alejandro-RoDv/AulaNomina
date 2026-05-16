import { useEffect, useMemo, useState } from "react";

import {
  createStudentGroup,
  deleteStudentGroup,
  fetchNextStudentGroupCode,
  fetchStudentGroups,
  seedDemoStudentGroups,
  updateStudentGroup,
} from "../services/studentGroupApi";

const initialForm = {
  group_code: "",
  name: "",
  academic_year: "2026/2027",
  education_center: "",
  teacher_name: "Profesor demo",
  status: "active",
  notes: "",
  is_active: true,
};

const statusLabels = {
  active: "Activo",
  inactive: "Inactivo",
  completed: "Finalizado",
};

function buildPayload(form) {
  return {
    group_code: form.group_code || null,
    name: form.name,
    academic_year: form.academic_year || null,
    education_center: form.education_center || null,
    teacher_name: form.teacher_name || null,
    status: form.status,
    notes: form.notes || null,
    is_active: form.is_active ?? true,
  };
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default function StudentGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", academic_year: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counters = useMemo(() => {
    return groups.reduce(
      (acc, group) => ({
        ...acc,
        total: acc.total + 1,
        active: acc.active + (group.status === "active" ? 1 : 0),
        inactive: acc.inactive + (group.status === "inactive" ? 1 : 0),
        completed: acc.completed + (group.status === "completed" ? 1 : 0),
        students: acc.students + (group.student_count || 0),
      }),
      { total: 0, active: 0, inactive: 0, completed: 0, students: 0 }
    );
  }, [groups]);

  const academicYearOptions = useMemo(() => {
    return [...new Set(groups.map((group) => group.academic_year).filter(Boolean))].sort();
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const search = normalizeText(filters.search);
    return groups.filter((group) => {
      const fullText = normalizeText(`${group.group_code} ${group.name} ${group.education_center} ${group.teacher_name}`);
      return (
        (!search || fullText.includes(search)) &&
        (!filters.academic_year || group.academic_year === filters.academic_year) &&
        (!filters.status || group.status === filters.status)
      );
    });
  }, [groups, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsData, nextCodeData] = await Promise.all([fetchStudentGroups(), fetchNextStudentGroupCode()]);
      setGroups(groupsData);
      if (!editingId) setForm((prev) => ({ ...prev, group_code: nextCodeData.group_code }));
    } catch (err) {
      setError(err.message || "Error cargando grupos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = async () => {
    setEditingId(null);
    const data = await fetchNextStudentGroupCode();
    setForm({ ...initialForm, group_code: data.group_code });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      if (editingId) {
        await updateStudentGroup(editingId, buildPayload(form));
        setMessage("Grupo actualizado correctamente");
      } else {
        await createStudentGroup(buildPayload(form));
        setMessage("Grupo creado correctamente");
      }
      await resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Error guardando grupo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (group) => {
    setEditingId(group.id);
    setForm({
      group_code: group.group_code || "",
      name: group.name || "",
      academic_year: group.academic_year || "",
      education_center: group.education_center || "",
      teacher_name: group.teacher_name || "",
      status: group.status || "active",
      notes: group.notes || "",
      is_active: group.is_active ?? true,
    });
  };

  const handleDelete = async (groupId) => {
    if (!window.confirm("¿Desactivar este grupo?")) return;
    setError("");
    setMessage("");

    try {
      await deleteStudentGroup(groupId);
      setMessage("Grupo desactivado correctamente");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al desactivar grupo");
    }
  };

  const handleSeedDemo = async () => {
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      const result = await seedDemoStudentGroups();
      setMessage(result.message || "Grupos demo cargados");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al cargar grupos demo");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={styles.loading}>Cargando grupos...</p>;

  return (
    <div style={styles.page}>
      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Total</span><strong style={styles.summaryValue}>{counters.total}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Activos</span><strong style={styles.summaryValue}>{counters.active}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Alumnos asignados</span><strong style={styles.summaryValue}>{counters.students}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Inactivos</span><strong style={styles.summaryValue}>{counters.inactive}</strong></div>
      </section>

      <section style={styles.topGrid}>
        <form style={styles.card} onSubmit={handleSubmit}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>{editingId ? "Editar grupo" : "Crear grupo"}</h2>
              <p style={styles.cardSubtitle}>Agrupa alumnos por curso, centro o programa docente.</p>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={handleSeedDemo} disabled={submitting}>Cargar demo</button>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>Código<input name="group_code" value={form.group_code} onChange={handleChange} style={styles.input} /></label>
            <label style={styles.field}>Estado<select name="status" value={form.status} onChange={handleChange} style={styles.input}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={styles.field}>Nombre del grupo<input name="name" value={form.name} onChange={handleChange} required style={styles.input} /></label>
            <label style={styles.field}>Curso académico<input name="academic_year" value={form.academic_year} onChange={handleChange} style={styles.input} /></label>
            <label style={styles.field}>Centro educativo<input name="education_center" value={form.education_center} onChange={handleChange} style={styles.input} /></label>
            <label style={styles.field}>Docente responsable<input name="teacher_name" value={form.teacher_name} onChange={handleChange} style={styles.input} /></label>
          </div>

          <label style={styles.field}>Notas<textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={styles.textarea} /></label>

          <div style={styles.actions}>
            <button type="submit" style={styles.primaryButton} disabled={submitting}>{editingId ? "Guardar cambios" : "Crear grupo"}</button>
            {editingId && <button type="button" style={styles.secondaryButton} onClick={resetForm}>Cancelar</button>}
          </div>
        </form>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Filtros</h2>
          <label style={styles.field}>Buscar<input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Grupo, código, centro o docente" style={styles.input} /></label>
          <label style={styles.field}>Curso académico<select name="academic_year" value={filters.academic_year} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option>{academicYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label style={styles.field}>Estado<select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </section>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Listado de grupos</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Código</th><th style={styles.th}>Grupo</th><th style={styles.th}>Curso</th><th style={styles.th}>Alumnos</th><th style={styles.th}>Centro</th><th style={styles.th}>Docente</th><th style={styles.th}>Estado</th><th style={styles.th}>Acciones</th></tr></thead>
            <tbody>
              {filteredGroups.map((group) => (
                <tr key={group.id} style={!group.is_active ? styles.inactiveRow : undefined}>
                  <td style={styles.td}><strong>{group.group_code || group.id}</strong></td>
                  <td style={styles.td}>{group.name}</td>
                  <td style={styles.td}>{group.academic_year || "-"}</td>
                  <td style={styles.td}><strong>{group.student_count || 0}</strong></td>
                  <td style={styles.td}>{group.education_center || "-"}</td>
                  <td style={styles.td}>{group.teacher_name || "-"}</td>
                  <td style={styles.td}>{statusLabels[group.status] || group.status}</td>
                  <td style={styles.tdActions}><button type="button" style={styles.smallButton} onClick={() => handleEdit(group)}>Editar</button><button type="button" style={styles.linkButton} onClick={() => handleDelete(group.id)}>Desactivar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" },
  summaryCard: { border: "2px solid #111111", backgroundColor: "#ffffff", boxShadow: "3px 3px 0 #e6d85c", padding: "14px" },
  summaryLabel: { display: "block", fontSize: "12px", fontWeight: 900, color: "#4b5563", textTransform: "uppercase" },
  summaryValue: { display: "block", marginTop: "4px", fontSize: "32px", fontWeight: 950, color: "#111111" },
  topGrid: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: "18px", alignItems: "start" },
  card: { backgroundColor: "#ffffff", border: "2px solid #111111", boxShadow: "4px 4px 0 #e6d85c", padding: "18px", boxSizing: "border-box" },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" },
  cardTitle: { margin: "0 0 6px", fontSize: "22px", fontWeight: 900, color: "#111111" },
  cardSubtitle: { margin: "0 0 14px", color: "#4b5563", fontSize: "14px", lineHeight: 1.45 },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800, color: "#111111", marginBottom: "12px" },
  input: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff" },
  textarea: { border: "2px solid #111111", padding: "9px 10px", fontSize: "14px", backgroundColor: "#ffffff", resize: "vertical" },
  actions: { display: "flex", gap: "10px" },
  primaryButton: { border: "2px solid #111111", backgroundColor: "#111111", color: "#ffffff", padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { border: "2px solid #111111", backgroundColor: "#f8f3b5", color: "#111111", padding: "9px 12px", fontWeight: 900, cursor: "pointer" },
  smallButton: { border: "2px solid #111111", backgroundColor: "#ffffff", color: "#111111", padding: "6px 8px", fontWeight: 900, cursor: "pointer" },
  linkButton: { border: "none", backgroundColor: "transparent", color: "#991b1b", fontWeight: 900, cursor: "pointer" },
  success: { border: "2px solid #15803d", backgroundColor: "#dcfce7", color: "#14532d", padding: "10px 12px", fontWeight: 800 },
  error: { border: "2px solid #991b1b", backgroundColor: "#fee2e2", color: "#7f1d1d", padding: "10px 12px", fontWeight: 800 },
  loading: { fontWeight: 800 },
  tableWrapper: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
  th: { borderBottom: "2px solid #111111", textAlign: "left", padding: "10px", fontWeight: 900, color: "#111111" },
  td: { borderBottom: "1px solid #d1d5db", padding: "10px", verticalAlign: "top" },
  tdActions: { borderBottom: "1px solid #d1d5db", padding: "10px", verticalAlign: "top", display: "flex", gap: "8px" },
  inactiveRow: { opacity: 0.55, backgroundColor: "#f3f4f6" },
};
