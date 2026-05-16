import { useEffect, useMemo, useState } from "react";

import {
  createStudent,
  deleteStudent,
  fetchNextStudentCode,
  fetchStudents,
  seedDemoStudents,
  updateStudent,
} from "../services/studentApi";

const initialForm = {
  student_code: "",
  first_name: "",
  last_name: "",
  email: "",
  group_name: "",
  education_center: "",
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
    student_code: form.student_code || null,
    first_name: form.first_name,
    last_name: form.last_name,
    email: form.email || null,
    group_name: form.group_name || null,
    education_center: form.education_center || null,
    status: form.status,
    notes: form.notes || null,
    is_active: form.is_active ?? true,
  };
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: "", group_name: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const counters = useMemo(() => {
    return students.reduce(
      (acc, student) => ({
        ...acc,
        total: acc.total + 1,
        active: acc.active + (student.status === "active" ? 1 : 0),
        inactive: acc.inactive + (student.status === "inactive" ? 1 : 0),
        completed: acc.completed + (student.status === "completed" ? 1 : 0),
      }),
      { total: 0, active: 0, inactive: 0, completed: 0 }
    );
  }, [students]);

  const groupOptions = useMemo(() => {
    return [...new Set(students.map((student) => student.group_name).filter(Boolean))].sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    const search = normalizeText(filters.search);
    return students.filter((student) => {
      const fullText = normalizeText(`${student.student_code} ${student.full_name} ${student.email} ${student.education_center}`);
      return (
        (!search || fullText.includes(search)) &&
        (!filters.group_name || student.group_name === filters.group_name) &&
        (!filters.status || student.status === filters.status)
      );
    });
  }, [students, filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [studentsData, nextCodeData] = await Promise.all([fetchStudents(), fetchNextStudentCode()]);
      setStudents(studentsData);
      if (!editingId) setForm((prev) => ({ ...prev, student_code: nextCodeData.student_code }));
    } catch (err) {
      setError(err.message || "Error cargando alumnos");
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
    const data = await fetchNextStudentCode();
    setForm({ ...initialForm, student_code: data.student_code });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      if (editingId) {
        await updateStudent(editingId, buildPayload(form));
        setMessage("Alumno actualizado correctamente");
      } else {
        await createStudent(buildPayload(form));
        setMessage("Alumno creado correctamente");
      }
      await resetForm();
      await loadData();
    } catch (err) {
      setError(err.message || "Error guardando alumno");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (student) => {
    setEditingId(student.id);
    setForm({
      student_code: student.student_code || "",
      first_name: student.first_name || "",
      last_name: student.last_name || "",
      email: student.email || "",
      group_name: student.group_name || "",
      education_center: student.education_center || "",
      status: student.status || "active",
      notes: student.notes || "",
      is_active: student.is_active ?? true,
    });
  };

  const handleDelete = async (studentId) => {
    if (!window.confirm("¿Desactivar este alumno?")) return;
    setError("");
    setMessage("");

    try {
      await deleteStudent(studentId);
      setMessage("Alumno desactivado correctamente");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al desactivar alumno");
    }
  };

  const handleSeedDemo = async () => {
    setError("");
    setMessage("");

    try {
      setSubmitting(true);
      const result = await seedDemoStudents();
      setMessage(result.message || "Alumnos demo cargados");
      await loadData();
    } catch (err) {
      setError(err.message || "Error al cargar alumnos demo");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={styles.loading}>Cargando alumnos...</p>;

  return (
    <div style={styles.page}>
      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Total</span><strong style={styles.summaryValue}>{counters.total}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Activos</span><strong style={styles.summaryValue}>{counters.active}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Finalizados</span><strong style={styles.summaryValue}>{counters.completed}</strong></div>
        <div style={styles.summaryCard}><span style={styles.summaryLabel}>Inactivos</span><strong style={styles.summaryValue}>{counters.inactive}</strong></div>
      </section>

      <section style={styles.topGrid}>
        <form style={styles.card} onSubmit={handleSubmit}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>{editingId ? "Editar alumno" : "Crear alumno"}</h2>
              <p style={styles.cardSubtitle}>Alta básica de alumnos para la parte docente.</p>
            </div>
            <button type="button" style={styles.secondaryButton} onClick={handleSeedDemo} disabled={submitting}>Cargar demo</button>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.field}>Código<input name="student_code" value={form.student_code} onChange={handleChange} style={styles.input} /></label>
            <label style={styles.field}>Estado<select name="status" value={form.status} onChange={handleChange} style={styles.input}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label style={styles.field}>Nombre<input name="first_name" value={form.first_name} onChange={handleChange} required style={styles.input} /></label>
            <label style={styles.field}>Apellidos<input name="last_name" value={form.last_name} onChange={handleChange} required style={styles.input} /></label>
            <label style={styles.field}>Email<input name="email" value={form.email} onChange={handleChange} style={styles.input} /></label>
            <label style={styles.field}>Grupo<input name="group_name" value={form.group_name} onChange={handleChange} style={styles.input} /></label>
            <label style={styles.fieldWide}>Centro educativo<input name="education_center" value={form.education_center} onChange={handleChange} style={styles.input} /></label>
          </div>

          <label style={styles.field}>Notas<textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={styles.textarea} /></label>

          <div style={styles.actions}>
            <button type="submit" style={styles.primaryButton} disabled={submitting}>{editingId ? "Guardar cambios" : "Crear alumno"}</button>
            {editingId && <button type="button" style={styles.secondaryButton} onClick={resetForm}>Cancelar</button>}
          </div>
        </form>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Filtros</h2>
          <label style={styles.field}>Buscar<input name="search" value={filters.search} onChange={handleFilterChange} placeholder="Nombre, email, código o centro" style={styles.input} /></label>
          <label style={styles.field}>Grupo<select name="group_name" value={filters.group_name} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option>{groupOptions.map((group) => <option key={group} value={group}>{group}</option>)}</select></label>
          <label style={styles.field}>Estado<select name="status" value={filters.status} onChange={handleFilterChange} style={styles.input}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
      </section>

      {message && <p style={styles.success}>{message}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Listado de alumnos</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Código</th><th style={styles.th}>Alumno</th><th style={styles.th}>Email</th><th style={styles.th}>Grupo</th><th style={styles.th}>Centro</th><th style={styles.th}>Estado</th><th style={styles.th}>Acciones</th></tr></thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} style={!student.is_active ? styles.inactiveRow : undefined}>
                  <td style={styles.td}><strong>{student.student_code || student.id}</strong></td>
                  <td style={styles.td}>{student.full_name}</td>
                  <td style={styles.td}>{student.email || "-"}</td>
                  <td style={styles.td}>{student.group_name || "-"}</td>
                  <td style={styles.td}>{student.education_center || "-"}</td>
                  <td style={styles.td}>{statusLabels[student.status] || student.status}</td>
                  <td style={styles.tdActions}><button type="button" style={styles.smallButton} onClick={() => handleEdit(student)}>Editar</button><button type="button" style={styles.linkButton} onClick={() => handleDelete(student.id)}>Desactivar</button></td>
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
  fieldWide: { gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 800, color: "#111111", marginBottom: "12px" },
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
