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

const tabs = [
  { id: "overview", label: "Resumen" },
  { id: "classification", label: "Clasificación" },
  { id: "salary", label: "Tablas salariales" },
  { id: "rules", label: "Jornada y permisos" },
  { id: "new", label: "Nuevo convenio" },
];

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
const initialCategoryForm = { professional_group_id: "", code: "", name: "", level: "", functional_description: "", display_order: 1 };
const initialSalaryTableForm = { name: "Tabla salarial 2026", year: "2026", number_of_payments: 14, amount_type: "monthly", status: "active", notes: "" };
const initialSalaryRowForm = { salary_table_id: "", professional_category_id: "", base_salary: "", seniority_amount: "", agreement_plus: "", total_amount: "", amount_unit: "monthly", notes: "" };
const initialWorkTimeRuleForm = { name: "Jornada ordinaria general", annual_hours: "", weekly_hours: "", daily_max_hours: "", distribution_type: "regular", notes: "" };
const initialVacationRuleForm = { name: "Vacaciones anuales ordinarias", natural_days: "30", working_days: "", accrual_period: "Año natural", notes: "" };
const initialLeaveRuleForm = { name: "", leave_type: "paid", cause: "", duration: "", duration_unit: "working_days", paid: true, requires_notice: false, requires_justification: true, salary_treatment: "", notes: "" };

function cleanPayload(payload) {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value === "" ? null : value]));
}

function money(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function getGroupName(groups, groupId) {
  return groups.find((group) => Number(group.id) === Number(groupId))?.name || "—";
}

export default function CollectiveAgreementsPage({ loading, collectiveAgreements = [], onDataChanged }) {
  const [activeTab, setActiveTab] = useState("overview");
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
      .then((data) => {
        setSelectedAgreement(data);
        setError("");
      })
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

  async function submitAction(action, successMessage, resetForm = null) {
    setError("");
    setMessage("");
    try {
      setSubmitting(true);
      const result = await action();
      setMessage(successMessage);
      await refreshAgreement(result?.id || result?.agreement_id || activeAgreement?.id);
      resetForm?.();
      return result;
    } catch (err) {
      setError(err.message || "Error en la operación");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  const groups = selectedAgreement?.professional_groups || [];
  const categories = selectedAgreement?.professional_categories || [];
  const salaryTables = selectedAgreement?.salary_tables || [];
  const complements = selectedAgreement?.complements || [];
  const workTimeRules = selectedAgreement?.work_time_rules || [];
  const vacationRules = selectedAgreement?.vacation_rules || [];
  const leaveRules = selectedAgreement?.leave_rules || [];

  const salaryRows = salaryTables.flatMap((table) => (table.rows || []).map((row) => ({ ...row, table_name: table.name, table_year: table.year })));
  const rulesCount = workTimeRules.length + vacationRules.length + leaveRules.length + complements.length;

  const handleSeedDemo = () => submitAction(seedDemoCollectiveAgreement, "Convenio demo cargado correctamente");

  const handleCreateAgreement = (event) => {
    event.preventDefault();
    submitAction(
      () => createCollectiveAgreement(cleanPayload(agreementForm)),
      "Convenio creado correctamente",
      () => setAgreementForm(initialAgreementForm)
    );
  };

  const handleCreateGroup = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createProfessionalGroup(activeAgreement.id, cleanPayload(groupForm)),
      "Grupo profesional creado correctamente",
      () => setGroupForm(initialGroupForm)
    );
  };

  const handleCreateCategory = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createProfessionalCategory(activeAgreement.id, cleanPayload(categoryForm)),
      "Categoría profesional creada correctamente",
      () => setCategoryForm(initialCategoryForm)
    );
  };

  const handleCreateSalaryTable = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createSalaryTable(activeAgreement.id, cleanPayload(salaryTableForm)),
      "Tabla salarial creada correctamente",
      () => setSalaryTableForm(initialSalaryTableForm)
    );
  };

  const handleCreateSalaryRow = (event) => {
    event.preventDefault();
    if (!salaryRowForm.salary_table_id) {
      setError("Selecciona una tabla salarial antes de añadir la fila.");
      return;
    }
    const category = categories.find((item) => String(item.id) === String(salaryRowForm.professional_category_id));
    const group = groups.find((item) => Number(item.id) === Number(category?.professional_group_id));
    submitAction(
      () => createSalaryTableRow(salaryRowForm.salary_table_id, cleanPayload({
        ...salaryRowForm,
        category_name: category?.name || null,
        group_name: group?.name || null,
        professional_group_id: category?.professional_group_id || null,
      })),
      "Fila salarial creada correctamente",
      () => setSalaryRowForm(initialSalaryRowForm)
    );
  };

  const handleCreateWorkTimeRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createWorkTimeRule(activeAgreement.id, cleanPayload(workTimeRuleForm)),
      "Regla de jornada creada correctamente",
      () => setWorkTimeRuleForm(initialWorkTimeRuleForm)
    );
  };

  const handleCreateVacationRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createVacationRule(activeAgreement.id, cleanPayload(vacationRuleForm)),
      "Regla de vacaciones creada correctamente",
      () => setVacationRuleForm(initialVacationRuleForm)
    );
  };

  const handleCreateLeaveRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createLeaveRule(activeAgreement.id, cleanPayload(leaveRuleForm)),
      "Permiso creado correctamente",
      () => setLeaveRuleForm(initialLeaveRuleForm)
    );
  };

  return (
    <div style={styles.wrapper}>
      <section style={styles.hero}>
        <div>
          <p style={styles.kicker}>Módulo transversal</p>
          <h2 style={styles.heroTitle}>Convenios</h2>
          <p style={styles.heroText}>Define manualmente categorías, tablas salariales y reglas de referencia. El convenio informa, pero la nómina sigue siendo cálculo manual del alumno.</p>
        </div>
        <div style={styles.heroActions}>
          <select value={activeAgreement?.id || ""} onChange={(event) => setSelectedAgreementId(event.target.value)} style={styles.input}>
            {collectiveAgreements.length === 0 && <option value="">Sin convenios</option>}
            {collectiveAgreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.agreement_code || "sin código"}</option>)}
          </select>
          <button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.secondaryButton}>Cargar convenio demo</button>
        </div>
      </section>

      {(message || error || loading) && (
        <div style={styles.feedbackBar}>
          {message && <span style={styles.success}>{message}</span>}
          {error && <span style={styles.error}>{error}</span>}
          {loading && <span>Cargando datos...</span>}
        </div>
      )}

      <div style={styles.tabs}>{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={activeTab === tab.id ? styles.tabActive : styles.tab}>{tab.label}</button>)}</div>

      {!selectedAgreement && activeTab !== "new" && (
        <PageCard title="Sin convenio seleccionado" subtitle="Carga el convenio demo o crea uno nuevo para empezar a probar el módulo.">
          <button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.primaryButton}>Cargar convenio demo</button>
        </PageCard>
      )}

      {selectedAgreement && activeTab === "overview" && (
        <>
          <PageCard title="Resumen del convenio" subtitle="Vista rápida de estructura y contenido.">
            <div style={styles.summaryGrid}>
              <Info label="Nombre" value={selectedAgreement.name} />
              <Info label="Código" value={selectedAgreement.agreement_code || "—"} />
              <Info label="Sector" value={selectedAgreement.sector || "—"} />
              <Info label="Vigencia" value={`${selectedAgreement.effective_from || "—"} / ${selectedAgreement.effective_to || "—"}`} />
              <Info label="Grupos" value={groups.length} />
              <Info label="Categorías" value={categories.length} />
              <Info label="Filas salariales" value={salaryRows.length} />
              <Info label="Reglas" value={rulesCount} />
            </div>
          </PageCard>
          <PageCard title="Uso didáctico" subtitle="Qué hace y qué no hace el módulo.">
            <div style={styles.rulesPanel}>
              <Rule title="Sí hace" text="Guarda parámetros de convenio, organiza categorías, permite consultar tablas salariales y propone salario base mínimo al crear contrato." />
              <Rule title="No hace" text="No calcula IT, vacaciones, antigüedad, pagas extra, finiquitos ni regularizaciones. Es intencionado para que el alumno practique." />
              <Rule title="Prueba recomendada" text="Carga el convenio demo, revisa tabla salarial y crea un contrato seleccionando categoría y fila salarial." />
            </div>
          </PageCard>
        </>
      )}

      {selectedAgreement && activeTab === "classification" && (
        <PageCard title="Clasificación profesional" subtitle="Introduce manualmente grupos y categorías del convenio.">
          <div style={styles.twoColumns}>
            <form onSubmit={handleCreateGroup} style={styles.stackForm}>
              <h3 style={styles.sectionTitle}>Nuevo grupo</h3>
              <input style={styles.input} placeholder="Código" value={groupForm.code} onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })} />
              <input style={styles.input} placeholder="Nombre del grupo" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} required />
              <textarea style={styles.textarea} placeholder="Descripción" value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} />
              <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir grupo</button>
            </form>
            <form onSubmit={handleCreateCategory} style={styles.stackForm}>
              <h3 style={styles.sectionTitle}>Nueva categoría</h3>
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
          <SimpleTable columns={["Grupo", "Código", "Categoría", "Nivel"]} rows={categories.map((category) => [getGroupName(groups, category.professional_group_id), category.code || "—", category.name, category.level || "—"])} />
        </PageCard>
      )}

      {selectedAgreement && activeTab === "salary" && (
        <PageCard title="Tablas salariales" subtitle="Importes de referencia. El salario base puede copiarse al contrato, pero sigue siendo editable.">
          <div style={styles.twoColumns}>
            <form onSubmit={handleCreateSalaryTable} style={styles.stackForm}>
              <h3 style={styles.sectionTitle}>Nueva tabla</h3>
              <input style={styles.input} placeholder="Nombre" value={salaryTableForm.name} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, name: e.target.value })} required />
              <input style={styles.input} placeholder="Año" value={salaryTableForm.year} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, year: e.target.value })} />
              <select style={styles.input} value={salaryTableForm.amount_type} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, amount_type: e.target.value })}>
                <option value="monthly">Mensual</option><option value="annual">Anual</option><option value="daily">Diario</option><option value="hourly">Hora</option>
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
          <SimpleTable columns={["Tabla", "Categoría", "Base", "Antigüedad", "Plus", "Total"]} rows={salaryRows.map((row) => [row.table_name, row.category_name || "—", money(row.base_salary), money(row.seniority_amount), money(row.agreement_plus), money(row.total_amount)])} />
        </PageCard>
      )}

      {selectedAgreement && activeTab === "rules" && (
        <PageCard title="Jornada, vacaciones y permisos" subtitle="Reglas informativas para consulta y casos prácticos.">
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
                <option value="paid">Retribuido</option><option value="unpaid">No retribuido</option>
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
      )}

      {activeTab === "new" && (
        <PageCard title="Nuevo convenio" subtitle="Alta manual. No se interpreta automáticamente ningún BOE ni PDF.">
          <form onSubmit={handleCreateAgreement} style={styles.gridForm}>
            <input style={styles.input} placeholder="Nombre" value={agreementForm.name} onChange={(e) => setAgreementForm({ ...agreementForm, name: e.target.value })} required />
            <input style={styles.input} placeholder="Código" value={agreementForm.agreement_code} onChange={(e) => setAgreementForm({ ...agreementForm, agreement_code: e.target.value })} />
            <input style={styles.input} placeholder="Sector" value={agreementForm.sector} onChange={(e) => setAgreementForm({ ...agreementForm, sector: e.target.value })} />
            <input style={styles.input} placeholder="Ámbito territorial" value={agreementForm.territorial_scope} onChange={(e) => setAgreementForm({ ...agreementForm, territorial_scope: e.target.value })} />
            <input style={styles.input} type="date" value={agreementForm.effective_from} onChange={(e) => setAgreementForm({ ...agreementForm, effective_from: e.target.value })} />
            <input style={styles.input} type="date" value={agreementForm.effective_to} onChange={(e) => setAgreementForm({ ...agreementForm, effective_to: e.target.value })} />
            <textarea style={styles.textareaWide} placeholder="Notas docentes" value={agreementForm.notes} onChange={(e) => setAgreementForm({ ...agreementForm, notes: e.target.value })} />
            <button type="submit" disabled={submitting} style={styles.primaryButton}>Crear convenio</button>
          </form>
        </PageCard>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return <div style={styles.infoBox}><span>{label}</span><strong>{value}</strong></div>;
}

function Rule({ title, text }) {
  return <div style={styles.ruleBox}><strong>{title}</strong><p>{text}</p></div>;
}

function SimpleTable({ columns, rows }) {
  if (!rows.length) return <p style={styles.empty}>Sin datos registrados.</p>;
  return <div style={styles.tableWrapper}><table style={styles.table}><thead><tr>{columns.map((column) => <th key={column} style={styles.th}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} style={styles.td}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  hero: { display: "grid", gridTemplateColumns: "1.5fr minmax(300px, 0.8fr)", gap: "20px", alignItems: "center", border: "3px solid #111111", borderRadius: "16px", padding: "22px", background: "linear-gradient(135deg, #ffffff 0%, #fff7bf 62%, #e6d85c 100%)", boxShadow: "6px 6px 0 #111111" },
  kicker: { margin: 0, color: "#8a6f00", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" },
  heroTitle: { margin: "6px 0 0", color: "#111827", fontSize: "36px", fontWeight: 950, lineHeight: 1 },
  heroText: { margin: "10px 0 0", color: "#374151", fontSize: "15px", fontWeight: 650, lineHeight: 1.5 },
  heroActions: { display: "flex", flexDirection: "column", gap: "10px" },
  feedbackBar: { display: "flex", gap: "14px", alignItems: "center", padding: "10px 12px", borderRadius: "10px", backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", fontWeight: 800 },
  tabs: { display: "flex", flexWrap: "wrap", gap: "8px", borderBottom: "3px solid #111111", paddingBottom: "10px" },
  tab: { backgroundColor: "#f3f4f6", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 850 },
  tabActive: { backgroundColor: "#111111", color: "#ffffff", border: "1px solid #111111", borderRadius: "8px", padding: "9px 12px", cursor: "pointer", fontWeight: 900 },
  gridForm: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  stackForm: { display: "flex", flexDirection: "column", gap: "10px", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", backgroundColor: "#fafafa" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px", marginBottom: "18px" },
  threeColumns: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "18px", marginBottom: "18px" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "12px" },
  rulesPanel: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" },
  ruleBox: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", backgroundColor: "#f9fafb" },
  infoBox: { border: "1px solid #d1d5db", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "5px" },
  input: { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", backgroundColor: "#ffffff" },
  textarea: { width: "100%", minHeight: "74px", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit" },
  textareaWide: { width: "100%", minHeight: "74px", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", gridColumn: "span 2" },
  primaryButton: { backgroundColor: "#111111", color: "#ffffff", border: "none", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  secondaryButton: { backgroundColor: "#ffffff", color: "#111111", border: "2px solid #111111", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", fontWeight: 900 },
  sectionTitle: { margin: "0 0 6px", fontSize: "15px", fontWeight: 900, color: "#111827" },
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px" },
  th: { textAlign: "left", padding: "10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "10px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
  success: { color: "#166534" },
  error: { color: "#b91c1c" },
  empty: { color: "#6b7280", fontWeight: 650 },
};
