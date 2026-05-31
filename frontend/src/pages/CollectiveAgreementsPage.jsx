import { useEffect, useMemo, useState } from "react";

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
  updateCollectiveAgreement,
} from "../services/collectiveAgreementApi";

const tabs = [
  { id: "overview", label: "Resumen" },
  { id: "classification", label: "Clasificación" },
  { id: "salary", label: "Tablas salariales" },
  { id: "rules", label: "Jornada y permisos" },
  { id: "new", label: "Nuevo convenio" },
];

const initialAgreementForm = { name: "", agreement_code: "", sector: "", territorial_scope: "", effective_from: "", effective_to: "", status: "draft", notes: "" };
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

function formatDate(value) {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function getGroupName(groups, groupId) {
  return groups.find((group) => Number(group.id) === Number(groupId))?.name || "—";
}

function formatLeaveType(value) {
  return value === "paid" ? "Retribuido" : value === "unpaid" ? "No retribuido" : value || "—";
}

function getAgreementStatus(agreement) {
  if (!agreement) return { label: "Sin convenio", tone: "neutral" };
  if (agreement.status === "draft") return { label: "Borrador", tone: "draft" };
  if (agreement.status === "archived") return { label: "Caducado", tone: "expired" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = agreement.effective_from ? new Date(agreement.effective_from) : null;
  const to = agreement.effective_to ? new Date(agreement.effective_to) : null;

  if (from && from > today) return { label: "Futuro", tone: "future" };
  if (to && to < today) return { label: "Caducado", tone: "expired" };
  if (agreement.status === "active") return { label: "Activo", tone: "active" };
  return { label: agreement.status || "Sin estado", tone: "neutral" };
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
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [openPanel, setOpenPanel] = useState("");
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
  const selectedStatus = getAgreementStatus(selectedAgreement || activeAgreement);
  const selectedGroup = groups.find((group) => String(group.id) === String(selectedGroupId)) || groups[0] || null;
  const filteredCategories = selectedGroup ? categories.filter((category) => Number(category.professional_group_id) === Number(selectedGroup.id)) : categories;

  const alerts = useMemo(() => {
    if (!selectedAgreement) return [];
    const items = [];
    if (!selectedAgreement.effective_from) items.push("Convenio sin fecha de entrada en vigor");
    if (!selectedAgreement.effective_to) items.push("Convenio sin fecha fin");
    if (!groups.length) items.push("Convenio sin grupos profesionales");
    if (!categories.length) items.push("Convenio sin categorías");
    if (!salaryTables.length) items.push("Convenio sin tabla salarial");
    salaryTables.forEach((table) => { if (!table.rows?.length) items.push(`Tabla salarial sin filas: ${table.name}`); });
    if (!workTimeRules.some((rule) => rule.annual_hours)) items.push("Jornada anual no informada");
    if (!vacationRules.length) items.push("Vacaciones no informadas");
    if (getAgreementStatus(selectedAgreement).tone === "expired") items.push("Convenio caducado");
    return items;
  }, [selectedAgreement, groups.length, categories.length, salaryTables, workTimeRules, vacationRules.length]);

  const handleSeedDemo = () => submitAction(seedDemoCollectiveAgreement, "Convenio demo cargado correctamente");

  const handleCreateAgreement = (event) => {
    event.preventDefault();
    if (agreementForm.effective_from && agreementForm.effective_to && agreementForm.effective_to < agreementForm.effective_from) {
      setError("La fecha fin no puede ser anterior a la fecha de inicio.");
      return;
    }
    submitAction(() => createCollectiveAgreement(cleanPayload(agreementForm)), "Convenio creado correctamente", () => setAgreementForm(initialAgreementForm));
  };

  const handleUpdateStatus = (status) => {
    if (!selectedAgreement?.id) return;
    submitAction(
      () => updateCollectiveAgreement(selectedAgreement.id, cleanPayload({ ...selectedAgreement, status })),
      status === "active" ? "Convenio marcado como activo" : "Convenio marcado como caducado",
      null,
      selectedAgreement.id
    );
  };

  const handleCreateGroup = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(() => createProfessionalGroup(activeAgreement.id, cleanPayload(groupForm)), "Grupo profesional creado correctamente", () => { setGroupForm(initialGroupForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleCreateCategory = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(() => createProfessionalCategory(activeAgreement.id, cleanPayload(categoryForm)), "Categoría profesional creada correctamente", () => { setCategoryForm(initialCategoryForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleCreateSalaryTable = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(() => createSalaryTable(activeAgreement.id, cleanPayload(salaryTableForm)), "Tabla salarial creada correctamente", () => { setSalaryTableForm(initialSalaryTableForm); setOpenPanel(""); }, activeAgreement.id);
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
      () => createSalaryTableRow(salaryRowForm.salary_table_id, cleanPayload({ ...salaryRowForm, category_name: category?.name || null, group_name: group?.name || null, professional_group_id: category?.professional_group_id || null })),
      "Fila salarial creada correctamente",
      () => { setSalaryRowForm(initialSalaryRowForm); setOpenPanel(""); },
      activeAgreement?.id
    );
  };

  const handleCreateWorkTimeRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(() => createWorkTimeRule(activeAgreement.id, cleanPayload(workTimeRuleForm)), "Regla de jornada creada correctamente", () => { setWorkTimeRuleForm(initialWorkTimeRuleForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleCreateVacationRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(() => createVacationRule(activeAgreement.id, cleanPayload(vacationRuleForm)), "Regla de vacaciones creada correctamente", () => { setVacationRuleForm(initialVacationRuleForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleCreateLeaveRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    submitAction(() => createLeaveRule(activeAgreement.id, cleanPayload(leaveRuleForm)), "Permiso creado correctamente", () => { setLeaveRuleForm(initialLeaveRuleForm); setOpenPanel(""); }, activeAgreement.id);
  };

  function togglePanel(panel) {
    setOpenPanel((current) => current === panel ? "" : panel);
  }

  function startCategoryForGroup(group) {
    setSelectedGroupId(String(group.id));
    setCategoryForm({ ...categoryForm, professional_group_id: group.id });
    setOpenPanel("category");
  }

  return (
    <div style={styles.wrapper}>
      <section style={styles.headerPanel}>
        <div>
          <h2 style={styles.pageTitle}>Convenios colectivos</h2>
          <p style={styles.pageSubtitle}>Gestión didáctica de categorías, jornadas, permisos y tablas salariales.</p>
        </div>
        <div style={styles.toolbar}>
          <select value={activeAgreement?.id || ""} onChange={(event) => setSelectedAgreementId(event.target.value)} style={{ ...styles.input, minWidth: "320px" }}>
            {collectiveAgreements.length === 0 && <option value="">Sin convenios</option>}
            {collectiveAgreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.agreement_code || "sin código"}</option>)}
          </select>
          <StatusBadge status={selectedStatus} />
          <span style={styles.metaChip}>Vigencia: {formatDate(selectedAgreement?.effective_from || activeAgreement?.effective_from)} - {formatDate(selectedAgreement?.effective_to || activeAgreement?.effective_to)}</span>
          <button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.ghostButton}>Cargar demo</button>
          <button type="button" onClick={() => setActiveTab("new")} style={styles.accentButton}>Nuevo convenio</button>
        </div>
      </section>

      {selectedAgreement && (
        <section style={styles.selectedSummary}>
          <div><span style={styles.label}>Convenio seleccionado</span><strong style={styles.selectedName}>{selectedAgreement.name}</strong></div>
          <Meta label="Código" value={selectedAgreement.agreement_code || "—"} />
          <Meta label="Vigente desde" value={formatDate(selectedAgreement.effective_from)} />
          <Meta label="Vigente hasta" value={formatDate(selectedAgreement.effective_to)} />
          <div style={styles.actions}>
            <button type="button" style={styles.smallButton} onClick={() => setActiveTab("new")}>Editar convenio</button>
            <button type="button" style={styles.smallButton} onClick={() => setMessage("Acción preparada para MVP posterior: duplicar convenio.")}>Duplicar</button>
            <button type="button" style={styles.smallButton} onClick={() => handleUpdateStatus("active")}>Marcar activo</button>
            <button type="button" style={styles.smallButton} onClick={() => handleUpdateStatus("archived")}>Marcar caducado</button>
          </div>
        </section>
      )}

      {(message || error || loading) && <div style={styles.feedbackBar}>{message && <span style={styles.success}>{message}</span>}{error && <span style={styles.error}>{error}</span>}{loading && <span>Cargando datos...</span>}</div>}

      <nav style={styles.tabs}>{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={activeTab === tab.id ? styles.tabActive : styles.tab}>{tab.label}</button>)}</nav>

      {!selectedAgreement && activeTab !== "new" && <Panel title="Sin convenio seleccionado" subtitle="Carga el convenio demo o crea uno nuevo para empezar."><button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.accentButton}>Cargar convenio demo</button></Panel>}

      {selectedAgreement && activeTab === "overview" && (
        <div style={styles.overviewGrid}>
          <Panel title="Ficha del convenio" subtitle="Datos administrativos principales.">
            <div style={styles.detailGrid}>
              <Info label="Nombre" value={selectedAgreement.name} />
              <Info label="Código oficial" value={selectedAgreement.agreement_code || "—"} />
              <Info label="Sector" value={selectedAgreement.sector || "—"} />
              <Info label="Ámbito territorial" value={selectedAgreement.territorial_scope || "—"} />
              <Info label="Vigencia" value={`${formatDate(selectedAgreement.effective_from)} - ${formatDate(selectedAgreement.effective_to)}`} />
              <Info label="Estado" value={selectedStatus.label} />
              <Info label="Notas" value={selectedAgreement.notes || "Sin notas"} wide />
            </div>
          </Panel>
          <Panel title="Indicadores" subtitle="Contenido cargado.">
            <div style={styles.indicatorGrid}>
              <Indicator label="Grupos profesionales" value={groups.length} />
              <Indicator label="Categorías" value={categories.length} />
              <Indicator label="Tablas salariales" value={salaryTables.length} />
              <Indicator label="Filas salariales" value={salaryRows.length} />
              <Indicator label="Reglas de jornada" value={workTimeRules.length} />
              <Indicator label="Vacaciones" value={vacationRules.length} />
              <Indicator label="Permisos" value={leaveRules.length} />
              <Indicator label="Complementos" value={complements.length} />
            </div>
          </Panel>
          <Panel title="Alertas del convenio" subtitle="Revisiones útiles para docencia y validación." wide><AlertsList alerts={alerts} /></Panel>
        </div>
      )}

      {selectedAgreement && activeTab === "classification" && (
        <Panel title="Clasificación profesional" subtitle="Grupos a la izquierda, categorías del grupo seleccionado a la derecha.">
          <div style={styles.sectionToolbar}>
            <button type="button" onClick={() => togglePanel("group")} style={styles.accentButton}>+ Nuevo grupo</button>
            <button type="button" onClick={() => togglePanel("category")} style={styles.ghostButton}>+ Nueva categoría</button>
          </div>
          {openPanel === "group" && <InlineForm title="Nuevo grupo profesional" onSubmit={handleCreateGroup}><input style={styles.input} placeholder="Código" value={groupForm.code} onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })} /><input style={styles.input} placeholder="Nombre del grupo" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} required /><textarea style={styles.textarea} placeholder="Descripción" value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} /><button type="submit" disabled={submitting} style={styles.accentButton}>Guardar grupo</button></InlineForm>}
          {openPanel === "category" && <InlineForm title="Nueva categoría profesional" onSubmit={handleCreateCategory}><select style={styles.input} value={categoryForm.professional_group_id} onChange={(e) => setCategoryForm({ ...categoryForm, professional_group_id: e.target.value })}><option value="">Sin grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><input style={styles.input} placeholder="Código" value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} /><input style={styles.input} placeholder="Nombre categoría" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required /><input style={styles.input} placeholder="Nivel" value={categoryForm.level} onChange={(e) => setCategoryForm({ ...categoryForm, level: e.target.value })} /><button type="submit" disabled={submitting} style={styles.accentButton}>Guardar categoría</button></InlineForm>}
          <div style={styles.classificationGrid}>
            <section style={styles.sideList}><h3 style={styles.sectionTitle}>Grupos profesionales</h3>{groups.map((group) => <button key={group.id} type="button" onClick={() => setSelectedGroupId(String(group.id))} style={String(selectedGroup?.id) === String(group.id) ? styles.listItemActive : styles.listItem}><strong>{group.name}</strong><span>{group.code || "Sin código"}</span></button>)}{groups.length === 0 && <Empty text="Sin grupos registrados." />}</section>
            <section><div style={styles.listHeader}><div><h3 style={styles.sectionTitle}>Categorías {selectedGroup ? `del ${selectedGroup.name}` : ""}</h3><p style={styles.muted}>{filteredCategories.length} categorías registradas</p></div>{selectedGroup && <button type="button" onClick={() => startCategoryForGroup(selectedGroup)} style={styles.smallButton}>Añadir aquí</button>}</div><SimpleTable columns={["Grupo", "Código", "Categoría", "Nivel"]} empty="Sin categorías para este grupo." rows={filteredCategories.map((category) => [getGroupName(groups, category.professional_group_id), category.code || "—", category.name, category.level || "—"])} /></section>
          </div>
        </Panel>
      )}

      {selectedAgreement && activeTab === "salary" && (
        <Panel title="Tablas salariales" subtitle="Vista tipo convenio: tabla anual, categoría, grupo e importes de referencia.">
          <div style={styles.sectionToolbar}>
            <button type="button" onClick={() => togglePanel("salary-table")} style={styles.accentButton}>+ Crear tabla salarial</button>
            <button type="button" onClick={() => togglePanel("salary-row")} style={styles.ghostButton}>+ Añadir fila</button>
            <button type="button" onClick={() => setMessage("Acción preparada para MVP posterior: añadir revisión salarial.")} style={styles.smallButton}>Añadir revisión salarial</button>
            <button type="button" onClick={() => setMessage("Acción preparada para MVP posterior: nueva tabla anual.")} style={styles.smallButton}>Añadir nueva tabla anual</button>
          </div>
          {openPanel === "salary-table" && <InlineForm title="Nueva tabla salarial" onSubmit={handleCreateSalaryTable}><input style={styles.input} placeholder="Nombre" value={salaryTableForm.name} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, name: e.target.value })} required /><input style={styles.input} placeholder="Año" value={salaryTableForm.year} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, year: e.target.value })} /><input type="number" style={styles.input} placeholder="Nº pagas" value={salaryTableForm.number_of_payments} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, number_of_payments: Number(e.target.value) })} /><select style={styles.input} value={salaryTableForm.amount_type} onChange={(e) => setSalaryTableForm({ ...salaryTableForm, amount_type: e.target.value })}><option value="monthly">Importe mensual</option><option value="annual">Importe anual</option></select><button type="submit" disabled={submitting} style={styles.accentButton}>Guardar tabla</button></InlineForm>}
          {openPanel === "salary-row" && <InlineForm title="Nueva fila salarial" onSubmit={handleCreateSalaryRow}><select style={styles.input} value={salaryRowForm.salary_table_id} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, salary_table_id: e.target.value })} required><option value="">Selecciona tabla</option>{salaryTables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select><select style={styles.input} value={salaryRowForm.professional_category_id} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, professional_category_id: e.target.value })}><option value="">Categoría manual</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><input type="number" style={styles.input} placeholder="Salario base" value={salaryRowForm.base_salary} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, base_salary: e.target.value })} required /><input type="number" style={styles.input} placeholder="Plus convenio" value={salaryRowForm.agreement_plus} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, agreement_plus: e.target.value })} /><input type="number" style={styles.input} placeholder="Antigüedad" value={salaryRowForm.seniority_amount} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, seniority_amount: e.target.value })} /><input type="number" style={styles.input} placeholder="Total" value={salaryRowForm.total_amount} onChange={(e) => setSalaryRowForm({ ...salaryRowForm, total_amount: e.target.value })} /><button type="submit" disabled={submitting} style={styles.accentButton}>Guardar fila</button></InlineForm>}
          <SalaryTablesSummary salaryTables={salaryTables} />
          <SimpleTable columns={["Tabla", "Año", "Categoría", "Grupo", "Salario base", "Plus convenio", "Antigüedad", "Total"]} empty="Sin filas salariales." rows={salaryRows.map((row) => [row.table_name, row.table_year, row.category_name || "—", row.group_name || getGroupName(groups, row.professional_group_id), money(row.base_salary), money(row.agreement_plus), money(row.seniority_amount), money(row.total_amount)])} />
        </Panel>
      )}

      {selectedAgreement && activeTab === "rules" && (
        <Panel title="Jornada, vacaciones y permisos" subtitle="Reglas administrativas separadas por sección.">
          <div style={styles.sectionToolbar}>
            <button type="button" onClick={() => togglePanel("work-time")} style={styles.accentButton}>+ Nueva jornada</button>
            <button type="button" onClick={() => togglePanel("vacation")} style={styles.ghostButton}>+ Nuevas vacaciones</button>
            <button type="button" onClick={() => togglePanel("leave")} style={styles.ghostButton}>+ Nuevo permiso</button>
          </div>
          {openPanel === "work-time" && <InlineForm title="Nueva regla de jornada" onSubmit={handleCreateWorkTimeRule}><input style={styles.input} value={workTimeRuleForm.name} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, name: e.target.value })} required /><input type="number" style={styles.input} placeholder="Horas anuales" value={workTimeRuleForm.annual_hours} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, annual_hours: e.target.value })} /><input type="number" style={styles.input} placeholder="Horas semanales" value={workTimeRuleForm.weekly_hours} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, weekly_hours: e.target.value })} /><select style={styles.input} value={workTimeRuleForm.distribution_type} onChange={(e) => setWorkTimeRuleForm({ ...workTimeRuleForm, distribution_type: e.target.value })}><option value="regular">Regular</option><option value="irregular">Irregular</option></select><button type="submit" disabled={submitting} style={styles.accentButton}>Guardar jornada</button></InlineForm>}
          {openPanel === "vacation" && <InlineForm title="Nueva regla de vacaciones" onSubmit={handleCreateVacationRule}><input style={styles.input} value={vacationRuleForm.name} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, name: e.target.value })} required /><input type="number" style={styles.input} placeholder="Días naturales" value={vacationRuleForm.natural_days} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, natural_days: e.target.value })} /><input type="number" style={styles.input} placeholder="Días laborables" value={vacationRuleForm.working_days} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, working_days: e.target.value })} /><input style={styles.input} placeholder="Devengo" value={vacationRuleForm.accrual_period} onChange={(e) => setVacationRuleForm({ ...vacationRuleForm, accrual_period: e.target.value })} /><button type="submit" disabled={submitting} style={styles.accentButton}>Guardar vacaciones</button></InlineForm>}
          {openPanel === "leave" && <InlineForm title="Nuevo permiso" onSubmit={handleCreateLeaveRule}><input style={styles.input} placeholder="Nombre" value={leaveRuleForm.name} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, name: e.target.value })} required /><select style={styles.input} value={leaveRuleForm.leave_type} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, leave_type: e.target.value })}><option value="paid">Retribuido</option><option value="unpaid">No retribuido</option></select><input style={styles.input} placeholder="Causa" value={leaveRuleForm.cause} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, cause: e.target.value })} /><input style={styles.input} placeholder="Duración" value={leaveRuleForm.duration} onChange={(e) => setLeaveRuleForm({ ...leaveRuleForm, duration: e.target.value })} /><button type="submit" disabled={submitting} style={styles.accentButton}>Guardar permiso</button></InlineForm>}
          <RuleTables workTimeRules={workTimeRules} vacationRules={vacationRules} leaveRules={leaveRules} />
        </Panel>
      )}

      {activeTab === "new" && (
        <Panel title="Nuevo convenio" subtitle="Crea una estructura base y después añade grupos, categorías y tablas.">
          <form onSubmit={handleCreateAgreement} style={styles.formGrid}>
            <input style={styles.input} placeholder="Nombre" value={agreementForm.name} onChange={(e) => setAgreementForm({ ...agreementForm, name: e.target.value })} required />
            <input style={styles.input} placeholder="Código convenio" value={agreementForm.agreement_code} onChange={(e) => setAgreementForm({ ...agreementForm, agreement_code: e.target.value })} />
            <input style={styles.input} placeholder="Sector" value={agreementForm.sector} onChange={(e) => setAgreementForm({ ...agreementForm, sector: e.target.value })} />
            <input style={styles.input} placeholder="Ámbito territorial" value={agreementForm.territorial_scope} onChange={(e) => setAgreementForm({ ...agreementForm, territorial_scope: e.target.value })} />
            <label style={styles.fieldLabel}>Fecha entrada en vigor<input type="date" style={styles.input} value={agreementForm.effective_from} onChange={(e) => setAgreementForm({ ...agreementForm, effective_from: e.target.value })} /></label>
            <label style={styles.fieldLabel}>Fecha fin vigencia<input type="date" style={styles.input} value={agreementForm.effective_to} onChange={(e) => setAgreementForm({ ...agreementForm, effective_to: e.target.value })} /></label>
            <select style={styles.input} value={agreementForm.status} onChange={(e) => setAgreementForm({ ...agreementForm, status: e.target.value })}><option value="draft">Borrador</option><option value="active">Activo</option><option value="archived">Caducado</option></select>
            <textarea style={{ ...styles.textarea, gridColumn: "1 / -1" }} placeholder="Notas" value={agreementForm.notes} onChange={(e) => setAgreementForm({ ...agreementForm, notes: e.target.value })} />
            <div style={{ gridColumn: "1 / -1" }}><button type="submit" disabled={submitting} style={styles.accentButton}>Crear convenio</button></div>
          </form>
        </Panel>
      )}
    </div>
  );
}

function Panel({ title, subtitle, wide, children }) {
  return <section style={{ ...styles.panel, ...(wide ? { gridColumn: "1 / -1" } : {}) }}><div style={styles.panelHeader}><h3 style={styles.panelTitle}>{title}</h3>{subtitle && <p style={styles.panelSubtitle}>{subtitle}</p>}</div>{children}</section>;
}

function InlineForm({ title, onSubmit, children }) {
  return <form onSubmit={onSubmit} style={styles.inlineForm}><h3 style={styles.inlineFormTitle}>{title}</h3><div style={styles.inlineFormGrid}>{children}</div></form>;
}

function Info({ label, value, wide }) {
  return <div style={{ ...styles.infoItem, ...(wide ? { gridColumn: "1 / -1" } : {}) }}><span>{label}</span><strong>{value}</strong></div>;
}

function Meta({ label, value }) {
  return <div style={styles.metaItem}><span>{label}</span><strong>{value}</strong></div>;
}

function Indicator({ label, value }) {
  return <div style={styles.indicator}><strong>{value}</strong><span>{label}</span></div>;
}

function StatusBadge({ status }) {
  return <span style={{ ...styles.statusBadge, ...(styles[`${status.tone}Status`] || {}) }}>{status.label}</span>;
}

function AlertsList({ alerts }) {
  if (!alerts.length) return <div style={styles.emptyAlert}>Sin alertas críticas. El convenio tiene una estructura mínima válida.</div>;
  return <ul style={styles.alertList}>{alerts.map((alert) => <li key={alert} style={styles.alertItem}>{alert}</li>)}</ul>;
}

function SalaryTablesSummary({ salaryTables }) {
  if (!salaryTables.length) return <Empty text="Sin tablas salariales registradas." />;
  return <div style={styles.salaryCards}>{salaryTables.map((table) => <article key={table.id} style={styles.salaryCard}><strong>{table.name}</strong><span>{table.year || "—"} · Nº pagas: {table.number_of_payments || "—"} · Tipo importe: {table.amount_type === "annual" ? "anual" : "mensual"} · Estado: {table.status || "—"}</span></article>)}</div>;
}

function RuleTables({ workTimeRules, vacationRules, leaveRules }) {
  return <div style={styles.ruleSections}>
    <RuleSection title="Jornada"><SimpleTable columns={["Nombre", "Horas año", "Horas semana", "Distribución"]} empty="Sin reglas de jornada." rows={workTimeRules.map((rule) => [rule.name, rule.annual_hours || "—", rule.weekly_hours || "—", rule.distribution_type === "irregular" ? "Irregular" : "Regular"])} /></RuleSection>
    <RuleSection title="Vacaciones"><SimpleTable columns={["Nombre", "Naturales", "Laborables", "Devengo"]} empty="Sin reglas de vacaciones." rows={vacationRules.map((rule) => [rule.name, rule.natural_days || "—", rule.working_days || "—", rule.accrual_period || "—"])} /></RuleSection>
    <RuleSection title="Permisos"><SimpleTable columns={["Nombre", "Tipo", "Duración", "Causa"]} empty="Sin permisos registrados." rows={leaveRules.map((rule) => [rule.name, formatLeaveType(rule.leave_type), rule.duration ? `${rule.duration} ${rule.duration_unit || ""}` : "—", rule.cause || "—"])} /></RuleSection>
  </div>;
}

function RuleSection({ title, children }) {
  return <section style={styles.ruleSection}><h3 style={styles.ruleTitle}>{title}</h3>{children}</section>;
}

function SimpleTable({ columns, rows, empty }) {
  return <div style={styles.tableWrapper}><table style={styles.table}><thead><tr>{columns.map((column) => <th key={column} style={styles.th}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} style={styles.td}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={columns.length} style={styles.td}>{empty}</td></tr>}</tbody></table></div>;
}

function Empty({ text }) {
  return <div style={styles.empty}>{text}</div>;
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "14px" },
  headerPanel: { display: "flex", justifyContent: "space-between", gap: "18px", alignItems: "flex-start", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "18px", backgroundColor: "#fff" },
  pageTitle: { margin: 0, fontSize: "26px", fontWeight: 850, color: "#111827" },
  pageSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "14px", fontWeight: 600 },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: "8px" },
  selectedSummary: { display: "grid", gridTemplateColumns: "minmax(260px, 1.3fr) repeat(3, minmax(120px, 0.6fr)) minmax(360px, 1fr)", gap: "12px", alignItems: "center", border: "1px solid #e5e7eb", borderLeft: "4px solid #facc15", borderRadius: "12px", padding: "14px", backgroundColor: "#fff" },
  label: { display: "block", color: "#6b7280", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" },
  selectedName: { display: "block", marginTop: "3px", fontSize: "17px", color: "#111827" },
  metaItem: { display: "flex", flexDirection: "column", gap: "2px", fontSize: "13px" },
  actions: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  metaChip: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "9px 10px", backgroundColor: "#f9fafb", color: "#374151", fontSize: "13px", fontWeight: 700 },
  feedbackBar: { display: "flex", gap: "14px", alignItems: "center", padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: "10px", backgroundColor: "#f9fafb", fontWeight: 750, fontSize: "14px" },
  success: { color: "#166534" },
  error: { color: "#b91c1c" },
  tabs: { display: "flex", gap: "6px", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", flexWrap: "wrap" },
  tab: { border: "1px solid transparent", borderRadius: "8px 8px 0 0", backgroundColor: "transparent", padding: "9px 12px", color: "#4b5563", fontWeight: 750, cursor: "pointer" },
  tabActive: { border: "1px solid #e5e7eb", borderBottom: "2px solid #facc15", borderRadius: "8px 8px 0 0", backgroundColor: "#fff", color: "#111827", padding: "9px 12px", fontWeight: 850, cursor: "pointer" },
  panel: { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", backgroundColor: "#fff" },
  panelHeader: { marginBottom: "14px" },
  panelTitle: { margin: 0, fontSize: "18px", color: "#111827", fontWeight: 850 },
  panelSubtitle: { margin: "4px 0 0", color: "#6b7280", fontSize: "13px", fontWeight: 600 },
  overviewGrid: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "14px" },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: "10px" },
  infoItem: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column", gap: "3px", fontSize: "13px" },
  indicatorGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: "10px" },
  indicator: { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px", backgroundColor: "#fff", display: "flex", flexDirection: "column", gap: "3px" },
  statusBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", padding: "7px 10px", fontSize: "12px", fontWeight: 850, border: "1px solid #d1d5db", backgroundColor: "#f9fafb", color: "#374151" },
  activeStatus: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#166534" },
  draftStatus: { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#92400e" },
  expiredStatus: { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" },
  futureStatus: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" },
  sectionToolbar: { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "12px" },
  input: { padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", backgroundColor: "white", minHeight: "38px" },
  textarea: { padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", minHeight: "72px", resize: "vertical" },
  fieldLabel: { display: "flex", flexDirection: "column", gap: "6px", color: "#4b5563", fontSize: "12px", fontWeight: 800 },
  accentButton: { backgroundColor: "#facc15", color: "#111827", border: "1px solid #eab308", borderRadius: "8px", padding: "9px 12px", fontWeight: 850, cursor: "pointer" },
  ghostButton: { backgroundColor: "#fff", color: "#111827", border: "1px solid #d1d5db", borderRadius: "8px", padding: "9px 12px", fontWeight: 800, cursor: "pointer" },
  smallButton: { backgroundColor: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "8px", padding: "7px 9px", fontWeight: 750, cursor: "pointer", fontSize: "13px" },
  inlineForm: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb", marginBottom: "14px" },
  inlineFormTitle: { margin: "0 0 10px", fontSize: "15px", color: "#111827", fontWeight: 850 },
  inlineFormGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", alignItems: "start" },
  classificationGrid: { display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "14px" },
  sideList: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", backgroundColor: "#f9fafb" },
  sectionTitle: { margin: "0 0 8px", fontSize: "15px", color: "#111827", fontWeight: 850 },
  listItem: { width: "100%", textAlign: "left", border: "1px solid #e5e7eb", borderRadius: "8px", backgroundColor: "#fff", padding: "10px", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "3px", cursor: "pointer" },
  listItemActive: { width: "100%", textAlign: "left", border: "1px solid #facc15", borderLeft: "4px solid #facc15", borderRadius: "8px", backgroundColor: "#fffbea", padding: "10px", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "3px", cursor: "pointer" },
  listHeader: { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start", marginBottom: "8px" },
  muted: { margin: 0, color: "#6b7280", fontSize: "13px", fontWeight: 650 },
  tableWrapper: { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "10px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "13px", backgroundColor: "#fff" },
  th: { textAlign: "left", padding: "9px 10px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb", color: "#374151", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.03em" },
  td: { padding: "9px 10px", borderBottom: "1px solid #f3f4f6", color: "#111827", verticalAlign: "top" },
  salaryCards: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginBottom: "12px" },
  salaryCard: { border: "1px solid #e5e7eb", borderLeft: "4px solid #facc15", borderRadius: "10px", padding: "10px", display: "flex", flexDirection: "column", gap: "3px", fontSize: "13px", backgroundColor: "#fff" },
  ruleSections: { display: "flex", flexDirection: "column", gap: "16px" },
  ruleSection: { display: "flex", flexDirection: "column", gap: "8px" },
  ruleTitle: { margin: 0, paddingBottom: "6px", borderBottom: "1px solid #e5e7eb", fontSize: "16px", fontWeight: 850, color: "#111827" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: "10px", maxWidth: "900px" },
  alertList: { margin: 0, paddingLeft: "18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "8px 18px" },
  alertItem: { color: "#92400e", fontWeight: 750, fontSize: "13px" },
  emptyAlert: { border: "1px solid #bbf7d0", borderRadius: "10px", padding: "12px", backgroundColor: "#f0fdf4", color: "#166534", fontWeight: 750 },
  empty: { border: "1px dashed #d1d5db", borderRadius: "10px", padding: "14px", color: "#6b7280", backgroundColor: "#fff", fontWeight: 700 },
};
