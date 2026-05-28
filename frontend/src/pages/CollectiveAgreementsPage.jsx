import { useEffect, useMemo, useState } from "react";

import PageCard from "../components/layout/PageCard";
import {
  createCollectiveAgreement,
  createLeaveRule,
  createProfessionalCategory,
  createProfessionalGroup,
  createSalaryTable,
  createSalaryTableRow,
  createVacationRule,
  createWorkTimeRule,
  fetchCollectiveAgreement,
  seedDemoCollectiveAgreement,
} from "../services/collectiveAgreementApi";

const initialAgreementForm = {
  name: "",
  agreement_code: "",
  sector: "",
  territorial_scope: "",
  effective_from: "",
  effective_to: "",
  status: "draft",
  notes: "",
};

const initialGroupForm = { code: "", name: "", description: "", display_order: 1 };
const initialCategoryForm = {
  professional_group_id: "",
  code: "",
  name: "",
  subgroup: "",
  level: "",
  functional_description: "",
  display_order: 1,
};
const initialSalaryTableForm = {
  name: "Tabla salarial 2026",
  year: "2026",
  number_of_payments: 14,
  amount_type: "monthly",
  status: "active",
  notes: "",
};
const initialSalaryRowForm = {
  salary_table_id: "",
  professional_category_id: "",
  base_salary: "",
  seniority_amount: "",
  agreement_plus: "",
  total_amount: "",
  amount_unit: "monthly",
  notes: "",
};
const initialWorkTimeRuleForm = {
  name: "Jornada ordinaria general",
  annual_hours: "",
  weekly_hours: "",
  daily_max_hours: "",
  distribution_type: "regular",
  notes: "",
};
const initialVacationRuleForm = {
  name: "Vacaciones anuales ordinarias",
  natural_days: "30",
  working_days: "",
  accrual_period: "Año natural",
  notes: "",
};
const initialLeaveRuleForm = {
  name: "",
  leave_type: "paid",
  cause: "",
  duration: "",
  duration_unit: "working_days",
  paid: true,
  requires_notice: false,
  requires_justification: true,
  salary_treatment: "",
  notes: "",
};

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, value === "" ? null : value])
  );
}

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export default function CollectiveAgreementsPage({ loading, collectiveAgreements, onDataChanged }) {
  const [selectedAgreementId, setSelectedAgreementId] = useState("");
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [agreementForm, setAgreementForm] = useState(initialAgreementForm);
  const [groupForm, setGroupForm] = useState(initialGroupForm);
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [salaryTableForm, setSalaryTableForm] = useState(initialSalaryTableForm);
  const [salaryRowForm, setSalaryRowForm] = useState(initialSalaryRowForm);
  const [workTimeRuleForm, setWorkTimeRuleForm] = useState(initialWorkTimeRuleForm);
  const [vacationRuleForm, setVacationRuleForm] = useState(initialVacationRuleForm);
  const [leaveRuleForm, setLeaveRuleForm] = useState(initialLeaveRuleForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeAgreement = useMemo(() => {
    if (!selectedAgreementId) return collectiveAgreements[0] || null;
    return collectiveAgreements.find((agreement) => Number(agreement.id) === Number(selectedAgreementId)) || null;
  }, [collectiveAgreements, selectedAgreementId]);

  useEffect(() => {
    if (!activeAgreement?.id) {
      setSelectedAgreement(null);
      return;
    }

    fetchCollectiveAgreement(activeAgreement.id)
      .then((data) => setSelectedAgreement(data))
      .catch((err) => setError(err.message || "Error al cargar detalle del convenio"));
  }, [activeAgreement?.id]);

  async function refreshAgreement(agreementId = activeAgreement?.id) {
    await onDataChanged?.();
    if (agreementId) {
      const data = await fetchCollectiveAgreement(agreementId);
      setSelectedAgreement(data);
      setSelectedAgreementId(String(agreementId));
    }
  }

  async function submitAction(action, successMessage) {
    setError("");
    setMessage("");
    try {
      setSubmitting(true);
      const result = await action();
      setMessage(successMessage);
      await refreshAgreement(result?.id || result?.agreement_id || activeAgreement?.id);
      return result;
    } catch (err) {
      setError(err.message || "Error en la operación");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  const handleCreateAgreement = async (event) => {
    event.preventDefault();
    const created = await submitAction(
      () => createCollectiveAgreement(cleanPayload(agreementForm)),
      "Convenio creado correctamente"
    );
    if (created) setAgreementForm(initialAgreementForm);
  };

  const handleSeedDemo = async () => {
    await submitAction(seedDemoCollectiveAgreement, "Convenio demo cargado correctamente");
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const created = await submitAction(
      () => createProfessionalGroup(activeAgreement.id, cleanPayload(groupForm)),
      "Grupo profesional creado correctamente"
    );
    if (created) setGroupForm(initialGroupForm);
  };

  const handleCreateCategory = async (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const created = await submitAction(
      () => createProfessionalCategory(activeAgreement.id, cleanPayload(categoryForm)),
      "Categoría profesional creada correctamente"
    );
    if (created) setCategoryForm(initialCategoryForm);
  };

  const handleCreateSalaryTable = async (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const created = await submitAction(
      () => createSalaryTable(activeAgreement.id, cleanPayload(salaryTableForm)),
      "Tabla salarial creada correctamente"
    );
    if (created) setSalaryTableForm(initialSalaryTableForm);
  };

  const handleCreateSalaryRow = async (event) => {
    event.preventDefault();
    if (!salaryRowForm.salary_table_id) {
      setError("Selecciona una tabla salarial antes de añadir la fila.");
      return;
    }
    const created = await submitAction(
      () => createSalaryTableRow(salaryRowForm.salary_table_id, cleanPayload(salaryRowForm)),
      "Fila salarial creada correctamente"
    );
    if (created) setSalaryRowForm(initialSalaryRowForm);
  };

  const handleCreateWorkTimeRule = async (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const created = await submitAction(
      () => createWorkTimeRule(activeAgreement.id, cleanPayload(workTimeRuleForm)),
      "Regla de jornada creada correctamente"
    );
    if (created) setWorkTimeRuleForm(initialWorkTimeRuleForm);
  };

  const handleCreateVacationRule = async (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const created = await submitAction(
      () => createVacationRule(activeAgreement.id, cleanPayload(vacationRuleForm)),
      "Regla de vacaciones creada correctamente"
    );
    if (created) setVacationRuleForm(initialVacationRuleForm);
  };

  const handleCreateLeaveRule = async (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const created = await submitAction(
      () => createLeaveRule(activeAgreement.id, cleanPayload(leaveRuleForm)),
      "Permiso creado correctamente"
    );
    if (created) setLeaveRuleForm(initialLeaveRuleForm);
  };

  const groups = selectedAgreement?.professional_groups || [];
  const categories = selectedAgreement?.professional_categories || [];
  const salaryTables = selectedAgreement?.salary_tables || [];
  const complements = selectedAgreement?.complements || [];
  const workTimeRules = selectedAgreement?.work_time_rules || [];
  const vacationRules = selectedAgreement?.vacation_rules || [];
  const leaveRules = selectedAgreement?.leave_rules || [];

  return (
    <div style={styles.wrapper}>
      <PageCard title="Convenios" subtitle="Parámetros manuales de convenio para consulta didáctica y contratos.">
        <div style={styles.topBar}>
          <div style={styles.selectBlock}>
            <label>Convenio activo</label>
            <select
              value={activeAgreement?.id || ""}
              onChange={(event) => setSelectedAgreementId(event.target.value)}
              style={styles.input}
            >
              {collectiveAgreements.length === 0 && <option value="">Sin convenios</option>}
              {collectiveAgreements.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name} · {agreement.agreement_code || "sin código"}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.secondaryButton}>
            Cargar convenio demo
          </button>
        </div>

        {message && <p style={styles.success}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}
        {loading && <p>Cargando datos...</p>}
      </PageCard>

      <PageCard title="Nuevo convenio" subtitle="Alta manual. No se interpreta automáticamente ningún BOE ni PDF.">
        <form onSubmit={handleCreateAgreement} style={styles.gridForm}>
          <input style={styles.input} placeholder="Nombre" value={agreementForm.name} onChange={(e) => setAgreementForm({ ...agreementForm, name: e.target.value })} required />
          <input style={styles.input} placeholder="Código" value={agreementForm.agreement_code} onChange={(e) => setAgreementForm({ ...agreementForm, agreement_code: e.target.value })} />
          <input style={styles.input} placeholder="Sector" value={agreementForm.sector} onChange={(e) => setAgreementForm({ ...agreementForm, sector: e.target.value })} />
          <input style={styles.input} placeholder="Ámbito territorial" value={agreementForm.territorial_scope} onChange={(e) => setAgreementForm({ ...agreementForm, territorial_scope: e.target.value })} />
          <input style={styles.input} type="date" value={agreementForm.effective_from} onChange={(e) => setAgreementForm({ ...agreementForm, effective_from: e.target.value })} />
          <input style={styles.input} type="date" value={agreementForm.effective_to} onChange={(e) => setAgreementForm({ ...agreementForm, effective_to: e.target.value })} />
          <textarea style={styles.textarea} placeholder="Notas docentes" value={agreementForm.notes} onChange={(e) => setAgreementForm({ ...agreementForm, notes: e.target.value })} />
          <button type="submit" disabled={submitting} style={styles.primaryButton}>Crear convenio</button>
        </form>
      </PageCard>

      {selectedAgreement && (
        <>
          <PageCard title="Resumen del convenio" subtitle="Vista de consulta para el alumno y el profesor.">
            <div style={styles.summaryGrid}>
              <Info label="Nombre" value={selectedAgreement.name} />
              <Info label="Código" value={selectedAgreement.agreement_code || "—"} />
              <Info label="Sector" value={selectedAgreement.sector || "—"} />
              <Info label="Vigencia" value={`${selectedAgreement.effective_from || "—"} / ${selectedAgreement.effective_to || "—"}`} />
              <Info label="Grupos" value={groups.length} />
              <Info label="Categorías" value={categories.length} />
              <Info label="Tablas salariales" value={salaryTables.length} />
              <Info label="Reglas laborales" value={workTimeRules.length + vacationRules.length + leaveRules.length} />
            </div>
          </PageCard>

          <PageCard title="Grupos y categorías" subtitle="Clasificación profesional editable manualmente.">
            <div style={styles.twoColumns}>
              <form onSubmit={handleCreateGroup} style={styles.stackForm}>
                <h3 style={styles.sectionTitle}>Añadir grupo</h3>
                <input style={styles.input} placeholder="Código" value={groupForm.code} onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })} />
                <input style={styles.input} placeholder="Nombre del grupo" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} required />
                <textarea style={styles.textarea} placeholder="Descripción" value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
                <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir grupo</button>
              </form>

              <form onSubmit={handleCreateCategory} style={styles.stackForm}>
                <h3 style={styles.sectionTitle}>Añadir categoría</h3>
                <select style={styles.input} value={categoryForm.professional_group_id} onChange={(e) => setCategoryForm({ ...categoryForm, professional_group_id: e.target.value })}>
                  <option value="">Sin grupo</option>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
                <input style={styles.input} placeholder="Código" value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} />
                <input style={styles.input} placeholder="Nombre de categoría" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
                <input style={styles.input} placeholder="Nivel" value={categoryForm.level} onChange={(e) => setCategoryForm({ ...categoryForm, level: e.target.value })} />
                <textarea style={styles.textarea} placeholder="Descripción funcional" value={categoryForm.functional_description} onChange={(e) => setCategoryForm({ ...categoryForm, functional_description: e.target.value })} />
                <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir categoría</button>
              </form>
            </div>

            <SimpleTable
              columns={["Grupo", "Código", "Categoría", "Nivel"]}
              rows={categories.map((category) => [
                groups.find((group) => Number(group.id) === Number(category.professional_group_id))?.name || "—",
                category.code || "—",
                category.name,
                category.level || "—",
              ])}
            />
          </PageCard>

          <PageCard title="Tablas salariales" subtitle="Importes mínimos de referencia. El cálculo sigue siendo manual.">
            <div style={styles.twoColumns}>
              <form onSubmit={handleCreateSalaryTable} style={styles.stackForm}>
                <h3 style={styles.sectionTitle}>Nueva tabla</h3>
                <input style={styles.input} placeholder="Nombre" value={salaryTableForm.name} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, name: e.target.value })} required />
                <input style={styles.input} placeholder="Año" value={salaryTableForm.year} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, year: e.target.value })} />
                <select style={styles.input} value={salaryTableForm.amount_type} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, amount_type: e.target.value })}>
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                  <option value="daily">Diario</option>
                  <option value="hourly">Hora</option>
                </select>
                <button type="submit" disabled={submitting} style={styles.primaryButton}>Crear tabla</button>
              </form>

              <form onSubmit={handleCreateSalaryRow} style={styles.stackForm}>
                <h3 style={styles.sectionTitle}>Nueva fila salarial</h3>
                <select style={styles.input} value={salaryRowForm.salary_table_id} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, salary_table_id: e.target.value })}>
                  <option value="">Seleccionar tabla</option>
                  {salaryTables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}
                </select>
                <select style={styles.input} value={salaryRowForm.professional_category_id} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, professional_category_id: e.target.value })}>
                  <option value="">Seleccionar categoría</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                <input style={styles.input} placeholder="Salario base" value={salaryRowForm.base_salary} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, base_salary: e.target.value })} />
                <input style={styles.input} placeholder="Antigüedad" value={salaryRowForm.seniority_amount} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, seniority_amount: e.target.value })} />
                <input style={styles.input} placeholder="Plus convenio" value={salaryRowForm.agreement_plus} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, agreement_plus: e.target.value })} />
                <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir fila</button>
              </form>
            </div>

            {salaryTables.map((table) => (
              <div key={table.id} style={styles.tableBlock}>
                <h3 style={styles.sectionTitle}>{table.name} · {table.year || "sin año"}</h3>
                <SimpleTable
                  columns={["Categoría", "Salario base", "Antigüedad", "Plus", "Total"]}
                  rows={(table.rows || []).map((row) => [row.category_name || "—", money(row.base_salary), money(row.seniority_amount), money(row.agreement_plus), money(row.total_amount)])}
                />
              </div>
            ))}
          </PageCard>

          <PageCard title="Reglas laborales" subtitle="Jornada, vacaciones y permisos. Información de consulta, no cálculo automático.">
            <div style={styles.threeColumns}>
              <form onSubmit={handleCreateWorkTimeRule} style={styles.stackForm}>
                <h3 style={styles.sectionTitle}>Jornada</h3>
                <input style={styles.input} placeholder="Nombre" value={workTimeRuleForm.name} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, name: e.target.value })} required />
                <input style={styles.input} placeholder="Horas anuales" value={workTimeRuleForm.annual_hours} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, annual_hours: e.target.value })} />
                <input style={styles.input} placeholder="Horas semanales" value={workTimeRuleForm.weekly_hours} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, weekly_hours: e.target.value })} />
                <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir jornada</button>
              </form>

              <form onSubmit={handleCreateVacationRule} style={styles.stackForm}>
                <h3 style={styles.sectionTitle}>Vacaciones</h3>
                <input style={styles.input} placeholder="Nombre" value={vacationRuleForm.name} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, name: e.target.value })} required />
                <input style={styles.input} placeholder="Días naturales" value={vacationRuleForm.natural_days} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, natural_days: e.target.value })} />
                <input style={styles.input} placeholder="Periodo devengo" value={vacationRuleForm.accrual_period} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, accrual_period: e.target.value })} />
                <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir vacaciones</button>
              </form>

              <form onSubmit={handleCreateLeaveRule} style={styles.stackForm}>
                <h3 style={styles.sectionTitle}>Permiso</h3>
                <input style={styles.input} placeholder="Nombre" value={leaveRuleForm.name} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, name: e.target.value })} required />
                <select style={styles.input} value={leaveRuleForm.leave_type} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, leave_type: e.target.value, paid: e.target.value === "paid" })}>
                  <option value="paid">Retribuido</option>
                  <option value="unpaid">No retribuido</option>
                </select>
                <input style={styles.input} placeholder="Duración" value={leaveRuleForm.duration} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, duration: e.target.value })} />
                <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir permiso</button>
              </form>
            </div>

            <SimpleTable columns={["Tipo", "Nombre", "Dato principal", "Notas"]} rows={[
              ...workTimeRules.map((rule) => ["Jornada", rule.name, `${rule.annual_hours || "—"} h/año`, rule.notes || "—"]),
              ...vacationRules.map((rule) => ["Vacaciones", rule.name, `${rule.natural_days || rule.working_days || "—"} días`, rule.notes || "—"]),
              ...leaveRules.map((rule) => ["Permiso", rule.name, `${rule.duration || "—"} ${rule.duration_unit || ""}`, rule.salary_treatment || rule.notes || "—"]),
              ...complements.map((item) => ["Complemento", item.name, item.amount ? money(item.amount) : `${item.percentage || "—"}%`, item.notes || "—"]),
            ]} />
          </PageCard>
        </>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoBox}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SimpleTable({ columns, rows }) {
  if (!rows.length) return <p style={styles.empty}>Sin datos registrados.</p>;
  return (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>{columns.map((column) => <th key={column} style={styles.th}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} style={styles.td}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  topBar: { display: "flex", gap: "14px", alignItems: "end" },
  selectBlock: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" },
  gridForm: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  stackForm: { display: "flex", flexDirection: "column", gap: "10px" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px", marginBottom: "18px" },
  threeColumns: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "18px", marginBottom: "18px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  infoBox: { border: "1px solid #d1d5db", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "5px" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px" },
  textarea: { width: "100%", minHeight: "74px", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", gridColumn: "span 2" },
  primaryButton: { backgroundColor: "#111111", color: "#ffffff", border: "none", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  secondaryButton: { backgroundColor: "#f8f3b5", color: "#111111", border: "2px solid #111111", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  sectionTitle: { margin: "0 0 6px", fontSize: "15px", fontWeight: 900, color: "#111827" },
  tableBlock: { marginTop: "18px" },
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", padding: "10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "10px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
  success: { color: "#166534", fontWeight: 700 },
  error: { color: "#b91c1c", fontWeight: 700 },
  empty: { color: "#6b7280", fontWeight: 600 },
};
