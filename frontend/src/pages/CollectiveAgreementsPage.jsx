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

  async function submitAction(action, successMessage, resetForm = null, refreshAgreementId = null) {
    setError("");
    setMessage("");
    try {
      setSubmitting(true);
      const result = await action();
      setMessage(successMessage);
      const targetAgreementId = refreshAgreementId || result?.agreement_id || result?.collective_agreement_id || activeAgreement?.id || result?.id;
      await refreshAgreement(targetAgreementId);
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
      () => setGroupForm(initialGroupForm),
      activeAgreement.id
    );
  };

  const handleCreateCategory = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createProfessionalCategory(activeAgreement.id, cleanPayload(categoryForm)),
      "Categoría profesional creada correctamente",
      () => setCategoryForm(initialCategoryForm),
      activeAgreement.id
    );
  };

  const handleCreateSalaryTable = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createSalaryTable(activeAgreement.id, cleanPayload(salaryTableForm)),
      "Tabla salarial creada correctamente",
      () => setSalaryTableForm(initialSalaryTableForm),
      activeAgreement.id
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
      () => setSalaryRowForm(initialSalaryRowForm),
      activeAgreement?.id
    );
  };

  const handleCreateWorkTimeRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createWorkTimeRule(activeAgreement.id, cleanPayload(workTimeRuleForm)),
      "Regla de jornada creada correctamente",
      () => setWorkTimeRuleForm(initialWorkTimeRuleForm),
      activeAgreement.id
    );
  };

  const handleCreateVacationRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createVacationRule(activeAgreement.id, cleanPayload(vacationRuleForm)),
      "Regla de vacaciones creada correctamente",
      () => setVacationRuleForm(initialVacationRuleForm),
      activeAgreement.id
    );
  };

  const handleCreateLeaveRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(
      () => createLeaveRule(activeAgreement.id, cleanPayload(leaveRuleForm)),
      "Permiso creado correctamente",
      () => setLeaveRuleForm(initialLeaveRuleForm),
      activeAgreement.id
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
              <input style={styles.input} placeholder="Nombre categoría" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
              <input style={styles.input} placeholder="Nivel" value={categoryForm.level} onChange={(e) => setCategoryForm({ ...categoryForm, level: e.target.value })} />
              <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir categoría</button>
            </form>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead><tr><th>Grupo</th><th>Código</th><th>Categoría</th><th>Nivel</th></tr></thead>
              <tbody>
                {categories.map((category) => <tr key={category.id}><td>{getGroupName(groups, category.professional_group_id)}</td><td>{category.code || "—"}</td><td>{category.name}</td><td>{category.level || "—"}</td></tr>)}
                {categories.length === 0 && <tr><td colSpan="4">Sin categorías registradas.</td></tr>}
              </tbody>
            </table>
          </div>
        </PageCard>
      )}

      {selectedAgreement && activeTab === "salary" && (
        <PageCard title="Tablas salariales" subtitle="Registra importes base y complementos de referencia.">
          <div style={styles.twoColumns}>
            <form onSubmit={handleCreateSalaryTable} style={styles.stackForm}>
              <h3 style={styles.sectionTitle}>Nueva tabla</h3>
              <input style={styles.input} value={salaryTableForm.name} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, name: e.target.value })} required />
              <input style={styles.input} value={salaryTableForm.year} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, year: e.target.value })} />
              <input type="number" style={styles.input} value={salaryTableForm.number_of_payments} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, number_of_payments: Number(e.target.value) })} />
              <button type="submit" disabled={submitting} style={styles.primaryButton}>Crear tabla</button>
            </form>

            <form onSubmit={handleCreateSalaryRow} style={styles.stackForm}>
              <h3 style={styles.sectionTitle}>Nueva fila salarial</h3>
              <select style={styles.input} value={salaryRowForm.salary_table_id} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, salary_table_id: e.target.value })} required>
                <option value="">Selecciona tabla</option>
                {salaryTables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}
              </select>
              <select style={styles.input} value={salaryRowForm.professional_category_id} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, professional_category_id: e.target.value })}>
                <option value="">Categoría manual</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <input type="number" style={styles.input} placeholder="Salario base" value={salaryRowForm.base_salary} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, base_salary: e.target.value })} required />
              <input type="number" style={styles.input} placeholder="Complemento convenio" value={salaryRowForm.agreement_plus} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, agreement_plus: e.target.value })} />
              <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir fila salarial</button>
            </form>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead><tr><th>Tabla</th><th>Año</th><th>Categoría</th><th>Salario base</th><th>Plus convenio</th></tr></thead>
              <tbody>
                {salaryRows.map((row) => <tr key={row.id}><td>{row.table_name}</td><td>{row.table_year}</td><td>{row.category_name || "—"}</td><td>{money(row.base_salary)}</td><td>{money(row.agreement_plus)}</td></tr>)}
                {salaryRows.length === 0 && <tr><td colSpan="5">Sin filas salariales.</td></tr>}
              </tbody>
            </table>
          </div>
        </PageCard>
      )}

      {selectedAgreement && activeTab === "rules" && (
        <PageCard title="Jornada, vacaciones y permisos" subtitle="Reglas informativas para consulta y casos prácticos.">
          <div style={styles.threeColumns}>
            <form onSubmit={handleCreateWorkTimeRule} style={styles.stackForm}>
              <h3 style={styles.sectionTitle}>Jornada</h3>
              <input style={styles.input} value={workTimeRuleForm.name} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, name: e.target.value })} required />
              <input type="number" style={styles.input} placeholder="Horas anuales" value={workTimeRuleForm.annual_hours} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, annual_hours: e.target.value })} />
              <input type="number" style={styles.input} placeholder="Horas semanales" value={workTimeRuleForm.weekly_hours} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, weekly_hours: e.target.value })} />
              <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir jornada</button>
            </form>

            <form onSubmit={handleCreateVacationRule} style={styles.stackForm}>
              <h3 style={styles.sectionTitle}>Vacaciones</h3>
              <input style={styles.input} value={vacationRuleForm.name} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, name: e.target.value })} required />
              <input type="number" style={styles.input} placeholder="Días naturales" value={vacationRuleForm.natural_days} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, natural_days: e.target.value })} />
              <input style={styles.input} placeholder="Devengo" value={vacationRuleForm.accrual_period} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, accrual_period: e.target.value })} />
              <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir vacaciones</button>
            </form>

            <form onSubmit={handleCreateLeaveRule} style={styles.stackForm}>
              <h3 style={styles.sectionTitle}>Permiso</h3>
              <input style={styles.input} placeholder="Nombre" value={leaveRuleForm.name} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, name: e.target.value })} required />
              <select style={styles.input} value={leaveRuleForm.leave_type} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, leave_type: e.target.value })}>
                <option value="paid">Retribuido</option>
                <option value="unpaid">No retribuido</option>
              </select>
              <input style={styles.input} placeholder="Duración" value={leaveRuleForm.duration} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, duration: e.target.value })} />
              <button type="submit" disabled={submitting} style={styles.primaryButton}>Añadir permiso</button>
            </form>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead><tr><th>Tipo</th><th>Nombre</th><th>Detalle</th><th>Notas</th></tr></thead>
              <tbody>
                {workTimeRules.map((rule) => <tr key={`work-${rule.id}`}><td>Jornada</td><td>{rule.name}</td><td>{rule.annual_hours || "—"} h/año · {rule.weekly_hours || "—"} h/semana</td><td>{rule.notes || "—"}</td></tr>)}
                {vacationRules.map((rule) => <tr key={`vac-${rule.id}`}><td>Vacaciones</td><td>{rule.name}</td><td>{rule.natural_days || "—"} días naturales · {rule.accrual_period || "—"}</td><td>{rule.notes || "—"}</td></tr>)}
                {leaveRules.map((rule) => <tr key={`leave-${rule.id}`}><td>Permiso</td><td>{rule.name}</td><td>{rule.duration || "—"} {rule.duration_unit || ""} · {rule.leave_type}</td><td>{rule.notes || "—"}</td></tr>)}
                {workTimeRules.length + vacationRules.length + leaveRules.length === 0 && <tr><td colSpan="4">Sin datos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </PageCard>
      )}

      {activeTab === "new" && (
        <PageCard title="Nuevo convenio" subtitle="Crea una estructura base y después añade grupos, categorías y tablas.">
          <form onSubmit={handleCreateAgreement} style={styles.stackFormWide}>
            <input style={styles.input} placeholder="Nombre" value={agreementForm.name} onChange={(e) => setAgreementForm({ ...agreementForm, name: e.target.value })} required />
            <input style={styles.input} placeholder="Código convenio" value={agreementForm.agreement_code} onChange={(e) => setAgreementForm({ ...agreementForm, agreement_code: e.target.value })} />
            <input style={styles.input} placeholder="Sector" value={agreementForm.sector} onChange={(e) => setAgreementForm({ ...agreementForm, sector: e.target.value })} />
            <input style={styles.input} placeholder="Ámbito territorial" value={agreementForm.territorial_scope} onChange={(e) => setAgreementForm({ ...agreementForm, territorial_scope: e.target.value })} />
            <textarea style={styles.textarea} placeholder="Notas" value={agreementForm.notes} onChange={(e) => setAgreementForm({ ...agreementForm, notes: e.target.value })} />
            <button type="submit" disabled={submitting} style={styles.primaryButton}>Crear convenio</button>
          </form>
        </PageCard>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return <div style={styles.infoItem}><span>{label}</span><strong>{value}</strong></div>;
}

function Rule({ title, text }) {
  return <div style={styles.ruleCard}><strong>{title}</strong><span>{text}</span></div>;
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "16px" },
  hero: { display: "flex", justifyContent: "space-between", gap: "24px", alignItems: "center", border: "3px solid #111", borderRadius: "14px", padding: "20px", background: "linear-gradient(135deg, #fffbea 0%, #f5e96b 100%)", boxShadow: "6px 6px 0 #111" },
  kicker: { margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9a7b00", fontSize: "12px", fontWeight: 900 },
  heroTitle: { margin: "4px 0", fontSize: "30px", fontWeight: 900, color: "#111" },
  heroText: { margin: 0, maxWidth: "720px", color: "#374151", fontWeight: 650 },
  heroActions: { minWidth: "360px", display: "flex", flexDirection: "column", gap: "10px" },
  tabs: { display: "flex", gap: "8px", borderBottom: "2px solid #111", paddingBottom: "8px", flexWrap: "wrap" },
  tab: { border: "1px solid #d1d5db", borderRadius: "8px", backgroundColor: "#f3f4f6", padding: "10px 14px", fontWeight: 800, cursor: "pointer" },
  tabActive: { border: "1px solid #111", borderRadius: "8px", backgroundColor: "#111", color: "#fff", padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  feedbackBar: { display: "flex", gap: "14px", alignItems: "center", padding: "12px", border: "1px solid #d1d5db", borderRadius: "10px", backgroundColor: "#f9fafb", fontWeight: 800 },
  success: { color: "#166534" },
  error: { color: "#b91c1c" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" },
  infoItem: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "4px" },
  rulesPanel: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" },
  ruleCard: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "#fff" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px", marginBottom: "18px" },
  threeColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "18px" },
  stackForm: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "10px" },
  stackFormWide: { maxWidth: "720px", display: "flex", flexDirection: "column", gap: "10px" },
  sectionTitle: { margin: "0 0 4px", fontSize: "16px", fontWeight: 900 },
  input: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", backgroundColor: "white" },
  textarea: { padding: "10px 12px", border: "1px solid #ccc", borderRadius: "8px", fontSize: "14px", minHeight: "70px", resize: "vertical" },
  primaryButton: { backgroundColor: "#111", color: "white", border: "1px solid #111", borderRadius: "8px", padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  secondaryButton: { backgroundColor: "white", color: "#111", border: "1px solid #111", borderRadius: "8px", padding: "10px 14px", fontWeight: 900, cursor: "pointer" },
  tableWrapper: { marginTop: "16px", overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "14px" },
};
