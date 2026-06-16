import { useMemo, useState } from "react";

import {
  createCollectiveAgreement,
  createLeaveRule,
  createProfessionalCategory,
  createProfessionalGroup,
  createSalaryTable,
  createSalaryTableRow,
  createVacationRule,
  createWorkTimeRule,
  deleteLeaveRule,
  deleteProfessionalCategory,
  deleteProfessionalGroup,
  deleteSalaryTable,
  deleteSalaryTableRow,
  deleteVacationRule,
  deleteWorkTimeRule,
  seedDemoCollectiveAgreement,
  updateCollectiveAgreement,
  updateLeaveRule,
  updateProfessionalCategory,
  updateProfessionalGroup,
  updateSalaryTable,
  updateSalaryTableRow,
  updateVacationRule,
  updateWorkTimeRule,
} from "../services/collectiveAgreementApi";

const tabs = [
  { id: "overview", label: "Resumen" },
  { id: "classification", label: "Clasificación" },
  { id: "salary", label: "Tablas salariales" },
  { id: "rules", label: "Jornada y permisos" },
  { id: "seniority", label: "Antigüedad" },
];

const initialAgreementForm = { name: "", agreement_code: "", sector: "", territorial_scope: "", effective_from: "", effective_to: "", status: "draft", notes: "" };
const initialGroupForm = { id: null, code: "", name: "", description: "", display_order: 1 };
const initialCategoryForm = { id: null, professional_group_id: "", code: "", name: "", level: "", functional_description: "", display_order: 1 };
const initialSalaryTableForm = { id: null, name: "Tabla salarial 2026", year: "2026", number_of_payments: 14, amount_type: "monthly", status: "active", notes: "" };
const initialSalaryRowForm = { id: null, salary_table_id: "", professional_category_id: "", base_salary: "", seniority_amount: "", agreement_plus: "", total_amount: "", amount_unit: "monthly", notes: "" };
const initialWorkTimeRuleForm = { id: null, name: "Jornada ordinaria general", annual_hours: "", weekly_hours: "", daily_max_hours: "", distribution_type: "regular", notes: "" };
const initialVacationRuleForm = { id: null, name: "Vacaciones anuales ordinarias", natural_days: "30", working_days: "", accrual_period: "Año natural", notes: "" };
const initialLeaveRuleForm = { id: null, name: "", leave_type: "paid", cause: "", duration: "", duration_unit: "working_days", paid: true, requires_notice: false, requires_justification: true, salary_treatment: "", notes: "" };

function cleanPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => !["id", "table_id", "table_name", "table_year"].includes(key))
      .map(([key, value]) => [key, value === "" ? null : value])
  );
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

export default function CollectiveAgreementsManagementPageV2({
  loading,
  collectiveAgreements = [],
  selectedAgreement,
  selectedAgreementId,
  onSelectedAgreementIdChange,
  activeTab = "overview",
  onActiveTabChange,
  onAgreementChanged,
}) {
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
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const activeAgreement = selectedAgreement || collectiveAgreements.find((item) => String(item.id) === String(selectedAgreementId)) || null;
  const groups = selectedAgreement?.professional_groups || [];
  const categories = selectedAgreement?.professional_categories || [];
  const salaryTables = selectedAgreement?.salary_tables || [];
  const complements = selectedAgreement?.complements || [];
  const workTimeRules = selectedAgreement?.work_time_rules || [];
  const vacationRules = selectedAgreement?.vacation_rules || [];
  const leaveRules = selectedAgreement?.leave_rules || [];
  const salaryRows = salaryTables.flatMap((table) => (table.rows || []).map((row) => ({ ...row, table_id: table.id, table_name: table.name, table_year: table.year })));
  const selectedStatus = getAgreementStatus(activeAgreement);
  const selectedGroup = groups.find((group) => String(group.id) === String(selectedGroupId)) || groups[0] || null;
  const filteredCategories = selectedGroup ? categories.filter((category) => Number(category.professional_group_id) === Number(selectedGroup.id)) : categories;

  const alerts = useMemo(() => {
    if (!selectedAgreement) return [];
    const items = [];
    if (!selectedAgreement.effective_from) items.push("Sin fecha de entrada en vigor");
    if (!selectedAgreement.effective_to) items.push("Sin fecha fin");
    if (!groups.length) items.push("Sin grupos profesionales");
    if (!categories.length) items.push("Sin categorías");
    if (!salaryTables.length) items.push("Sin tabla salarial");
    salaryTables.forEach((table) => { if (!table.rows?.length) items.push(`Tabla sin filas: ${table.name}`); });
    if (!workTimeRules.some((rule) => rule.annual_hours)) items.push("Jornada anual no informada");
    if (!vacationRules.length) items.push("Vacaciones no informadas");
    if (getAgreementStatus(selectedAgreement).tone === "expired") items.push("Convenio caducado");
    return items;
  }, [selectedAgreement, groups.length, categories.length, salaryTables, workTimeRules, vacationRules.length]);

  async function submitAction(action, successMessage, options = {}) {
    setError("");
    setMessage("");
    try {
      setSubmitting(true);
      const result = await action();
      const targetAgreementId = options.agreementId || result?.agreement_id || result?.collective_agreement_id || result?.id || activeAgreement?.id;
      await onAgreementChanged?.({ agreementId: targetAgreementId, refreshList: Boolean(options.refreshList) });
      options.reset?.();
      setMessage(successMessage);
      return result;
    } catch (err) {
      setError(err.message || "Error en la operación");
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  const handleSeedDemo = () => submitAction(seedDemoCollectiveAgreement, "Convenio demo cargado correctamente", { refreshList: true });

  function handleCreateAgreement(event) {
    event.preventDefault();
    if (agreementForm.effective_from && agreementForm.effective_to && agreementForm.effective_to < agreementForm.effective_from) {
      setError("La fecha fin no puede ser anterior a la fecha de inicio.");
      return;
    }
    submitAction(
      () => createCollectiveAgreement(cleanPayload(agreementForm)),
      "Convenio creado correctamente",
      { refreshList: true, reset: () => { setAgreementForm(initialAgreementForm); setAgreementModalOpen(false); } }
    );
  }

  function handleUpdateStatus(status) {
    if (!selectedAgreement?.id) return;
    submitAction(
      () => updateCollectiveAgreement(selectedAgreement.id, cleanPayload({ ...selectedAgreement, status })),
      status === "active" ? "Convenio marcado como activo" : "Convenio marcado como caducado",
      { agreementId: selectedAgreement.id, refreshList: true }
    );
  }

  function handleSaveGroup(event) {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = groupForm.id ? () => updateProfessionalGroup(groupForm.id, cleanPayload(groupForm)) : () => createProfessionalGroup(activeAgreement.id, cleanPayload(groupForm));
    submitAction(action, groupForm.id ? "Grupo profesional actualizado" : "Grupo profesional creado", { agreementId: activeAgreement.id, reset: () => { setGroupForm(initialGroupForm); setOpenPanel(""); } });
  }

  function handleSaveCategory(event) {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = categoryForm.id ? () => updateProfessionalCategory(categoryForm.id, cleanPayload(categoryForm)) : () => createProfessionalCategory(activeAgreement.id, cleanPayload(categoryForm));
    submitAction(action, categoryForm.id ? "Categoría profesional actualizada" : "Categoría profesional creada", { agreementId: activeAgreement.id, reset: () => { setCategoryForm(initialCategoryForm); setOpenPanel(""); } });
  }

  function handleSaveSalaryTable(event) {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = salaryTableForm.id ? () => updateSalaryTable(salaryTableForm.id, cleanPayload(salaryTableForm)) : () => createSalaryTable(activeAgreement.id, cleanPayload(salaryTableForm));
    submitAction(action, salaryTableForm.id ? "Tabla salarial actualizada" : "Tabla salarial creada", { agreementId: activeAgreement.id, reset: () => { setSalaryTableForm(initialSalaryTableForm); setOpenPanel(""); } });
  }

  function handleSaveSalaryRow(event) {
    event.preventDefault();
    if (!salaryRowForm.salary_table_id) return setError("Selecciona una tabla salarial antes de guardar la fila.");
    const category = categories.find((item) => String(item.id) === String(salaryRowForm.professional_category_id));
    const group = groups.find((item) => Number(item.id) === Number(category?.professional_group_id));
    const payload = cleanPayload({ ...salaryRowForm, category_name: category?.name || salaryRowForm.category_name || null, group_name: group?.name || salaryRowForm.group_name || null, professional_group_id: category?.professional_group_id || salaryRowForm.professional_group_id || null });
    const action = salaryRowForm.id ? () => updateSalaryTableRow(salaryRowForm.id, payload) : () => createSalaryTableRow(salaryRowForm.salary_table_id, payload);
    submitAction(action, salaryRowForm.id ? "Fila salarial actualizada" : "Fila salarial creada", { agreementId: activeAgreement?.id, reset: () => { setSalaryRowForm(initialSalaryRowForm); setOpenPanel(""); } });
  }

  function handleSaveWorkTimeRule(event) {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = workTimeRuleForm.id ? () => updateWorkTimeRule(workTimeRuleForm.id, cleanPayload(workTimeRuleForm)) : () => createWorkTimeRule(activeAgreement.id, cleanPayload(workTimeRuleForm));
    submitAction(action, workTimeRuleForm.id ? "Regla de jornada actualizada" : "Regla de jornada creada", { agreementId: activeAgreement.id, reset: () => { setWorkTimeRuleForm(initialWorkTimeRuleForm); setOpenPanel(""); } });
  }

  function handleSaveVacationRule(event) {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = vacationRuleForm.id ? () => updateVacationRule(vacationRuleForm.id, cleanPayload(vacationRuleForm)) : () => createVacationRule(activeAgreement.id, cleanPayload(vacationRuleForm));
    submitAction(action, vacationRuleForm.id ? "Regla de vacaciones actualizada" : "Regla de vacaciones creada", { agreementId: activeAgreement.id, reset: () => { setVacationRuleForm(initialVacationRuleForm); setOpenPanel(""); } });
  }

  function handleSaveLeaveRule(event) {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = leaveRuleForm.id ? () => updateLeaveRule(leaveRuleForm.id, cleanPayload(leaveRuleForm)) : () => createLeaveRule(activeAgreement.id, cleanPayload(leaveRuleForm));
    submitAction(action, leaveRuleForm.id ? "Permiso actualizado" : "Permiso creado", { agreementId: activeAgreement.id, reset: () => { setLeaveRuleForm(initialLeaveRuleForm); setOpenPanel(""); } });
  }

  function togglePanel(panel) {
    setOpenPanel((current) => current === panel ? "" : panel);
  }

  function deleteItem(action, label) {
    if (!window.confirm(`¿Eliminar ${label}?`)) return;
    submitAction(action, `${label} eliminado`, { agreementId: activeAgreement?.id });
  }

  function startCategoryForGroup(group) {
    setSelectedGroupId(String(group.id));
    setCategoryForm({ ...initialCategoryForm, professional_group_id: group.id });
    setOpenPanel("category");
  }

  return (
    <div style={styles.wrapper}>
      <section style={styles.topBar}>
        <div style={styles.titleBlock}>
          <h2 style={styles.pageTitle}>Convenios colectivos</h2>
          <p style={styles.pageSubtitle}>Categorías, jornada, permisos y tablas salariales para simulación docente.</p>
        </div>
        <div style={styles.toolbar}>
          <select value={selectedAgreementId || ""} onChange={(event) => onSelectedAgreementIdChange?.(event.target.value)} style={styles.selectLarge}>
            {!collectiveAgreements.length && <option value="">Sin convenios</option>}
            {collectiveAgreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.agreement_code || "sin código"}</option>)}
          </select>
          <StatusBadge status={selectedStatus} />
          <button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.secondaryButton}>Cargar demo</button>
          <button type="button" onClick={() => setAgreementModalOpen(true)} style={styles.primaryButton}>Nuevo convenio</button>
        </div>
      </section>

      {selectedAgreement && (
        <section style={styles.recordHeader}>
          <div style={styles.recordMain}><span style={styles.recordEyebrow}>Convenio seleccionado</span><strong style={styles.recordTitle}>{selectedAgreement.name}</strong></div>
          <RecordItem label="Código" value={selectedAgreement.agreement_code || "—"} />
          <RecordItem label="Sector" value={selectedAgreement.sector || "—"} />
          <RecordItem label="Vigencia" value={`${formatDate(selectedAgreement.effective_from)} - ${formatDate(selectedAgreement.effective_to)}`} />
          <div style={styles.recordActions}>
            <button type="button" style={styles.linkButton} onClick={() => setAgreementModalOpen(true)}>Nuevo</button>
            <button type="button" style={styles.linkButton} onClick={() => setMessage("Acción preparada para MVP posterior: duplicar convenio.")}>Duplicar</button>
            <button type="button" style={styles.linkButton} onClick={() => handleUpdateStatus("active")}>Activar</button>
            <button type="button" style={styles.linkButton} onClick={() => handleUpdateStatus("archived")}>Caducar</button>
          </div>
        </section>
      )}

      {(message || error || loading) && <div style={error ? styles.feedbackError : styles.feedbackOk}>{message && <span>{message}</span>}{error && <span>{error}</span>}{loading && <span>Cargando datos...</span>}</div>}
      <nav style={styles.tabs}>{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => onActiveTabChange?.(tab.id)} style={activeTab === tab.id ? styles.tabActive : styles.tab}>{tab.label}</button>)}</nav>

      {!selectedAgreement && <Section title="Sin convenio seleccionado"><button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.primaryButton}>Cargar convenio demo</button></Section>}

      {selectedAgreement && activeTab === "overview" && (
        <div style={styles.overviewLayout}>
          <Section title="Ficha administrativa" subtitle="Resumen del expediente de convenio.">
            <DefinitionTable rows={[["Nombre", selectedAgreement.name], ["Código oficial", selectedAgreement.agreement_code || "—"], ["Sector", selectedAgreement.sector || "—"], ["Ámbito territorial", selectedAgreement.territorial_scope || "—"], ["Vigente desde", formatDate(selectedAgreement.effective_from)], ["Vigente hasta", formatDate(selectedAgreement.effective_to)], ["Estado", selectedStatus.label], ["Notas", selectedAgreement.notes || "Sin notas"]]} />
          </Section>
          <Section title="Control del convenio" subtitle="Indicadores y alertas.">
            <StatsGrid items={[["Grupos", groups.length], ["Categorías", categories.length], ["Tablas", salaryTables.length], ["Filas salariales", salaryRows.length], ["Jornada", workTimeRules.length], ["Vacaciones", vacationRules.length], ["Permisos", leaveRules.length], ["Complementos", complements.length]]} />
            <div style={styles.alertBlock}><h4 style={styles.alertTitle}>Alertas</h4><AlertsList alerts={alerts} /></div>
          </Section>
        </div>
      )}

      {selectedAgreement && activeTab === "classification" && (
        <Section title="Clasificación profesional" subtitle="Selecciona un grupo y gestiona sus categorías.">
          <ActionBar actions={[["+ Nuevo grupo", () => { setGroupForm(initialGroupForm); togglePanel("group"); }, "primary"], ["+ Nueva categoría", () => { setCategoryForm(selectedGroup ? { ...initialCategoryForm, professional_group_id: selectedGroup.id } : initialCategoryForm); togglePanel("category"); }]]} />
          {openPanel === "group" && <InlineForm title={groupForm.id ? "Editar grupo profesional" : "Nuevo grupo profesional"} onSubmit={handleSaveGroup}><Field label="Nombre del grupo"><input style={styles.input} value={groupForm.name || ""} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} required /></Field><Field label="Código"><input style={styles.input} value={groupForm.code || ""} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })} /></Field><Field label="Descripción"><textarea style={styles.textarea} value={groupForm.description || ""} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} /></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>}
          {openPanel === "category" && <InlineForm title={categoryForm.id ? "Editar categoría profesional" : "Nueva categoría profesional"} onSubmit={handleSaveCategory}><Field label="Grupo"><select style={styles.input} value={categoryForm.professional_group_id || ""} onChange={(event) => setCategoryForm({ ...categoryForm, professional_group_id: event.target.value })}><option value="">Sin grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field><Field label="Código"><input style={styles.input} value={categoryForm.code || ""} onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })} /></Field><Field label="Categoría"><input style={styles.input} value={categoryForm.name || ""} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required /></Field><Field label="Nivel"><input style={styles.input} value={categoryForm.level || ""} onChange={(event) => setCategoryForm({ ...categoryForm, level: event.target.value })} /></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>}
          <div style={styles.classificationLayout}>
            <section style={styles.leftPane}><div style={styles.paneTitle}>Grupos profesionales</div><SimpleTable columns={["Grupo", "Código", "Acciones"]} empty="Sin grupos registrados." rows={groups.map((group) => [<button key={group.id} type="button" onClick={() => setSelectedGroupId(String(group.id))} style={String(selectedGroup?.id) === String(group.id) ? styles.rowSelectActive : styles.rowSelect}>{group.name}</button>, group.code || "—", rowActions(() => { setGroupForm({ ...initialGroupForm, ...group }); setOpenPanel("group"); }, () => deleteItem(() => deleteProfessionalGroup(group.id), "grupo"))])} /></section>
            <section style={styles.rightPane}><div style={styles.paneHeader}><div><h3 style={styles.paneHeading}>{selectedGroup ? `Categorías de ${selectedGroup.name}` : "Categorías"}</h3><p style={styles.paneSubtitle}>{filteredCategories.length} categorías en el grupo seleccionado</p></div>{selectedGroup && <button type="button" onClick={() => startCategoryForGroup(selectedGroup)} style={styles.secondaryButton}>Añadir categoría</button>}</div><SimpleTable columns={["Código", "Categoría", "Nivel", "Acciones"]} empty="Sin categorías para este grupo." rows={filteredCategories.map((category) => [category.code || "—", category.name, category.level || "—", rowActions(() => { setCategoryForm({ ...initialCategoryForm, ...category }); setOpenPanel("category"); }, () => deleteItem(() => deleteProfessionalCategory(category.id), "categoría"))])} /></section>
          </div>
        </Section>
      )}

      {selectedAgreement && activeTab === "salary" && (
        <Section title="Tablas salariales" subtitle="Tablas anuales arriba; filas salariales abajo.">
          <ActionBar actions={[["+ Crear tabla", () => { setSalaryTableForm(initialSalaryTableForm); togglePanel("salary-table"); }, "primary"], ["+ Añadir fila", () => { setSalaryRowForm(initialSalaryRowForm); togglePanel("salary-row"); }]]} />
          {openPanel === "salary-table" && <SalaryTableForm form={salaryTableForm} setForm={setSalaryTableForm} onSubmit={handleSaveSalaryTable} submitting={submitting} />}
          {openPanel === "salary-row" && <SalaryRowForm form={salaryRowForm} setForm={setSalaryRowForm} salaryTables={salaryTables} categories={categories} onSubmit={handleSaveSalaryRow} submitting={submitting} />}
          <div style={styles.salaryBlock}><h3 style={styles.subsectionTitle}>Tablas del convenio</h3><SalaryTablesSummary salaryTables={salaryTables} onEdit={(table) => { setSalaryTableForm({ ...initialSalaryTableForm, ...table }); setOpenPanel("salary-table"); }} onDelete={(table) => deleteItem(() => deleteSalaryTable(table.id), "tabla salarial")} /></div>
          <div style={styles.salaryBlock}><h3 style={styles.subsectionTitle}>Filas salariales</h3><SimpleTable columns={["Tabla", "Año", "Categoría", "Grupo", "Salario base", "Plus convenio", "Antigüedad", "Total", "Acciones"]} empty="Sin filas salariales." rows={salaryRows.map((row) => [row.table_name, row.table_year, row.category_name || "—", row.group_name || getGroupName(groups, row.professional_group_id), money(row.base_salary), money(row.agreement_plus), money(row.seniority_amount), money(row.total_amount), rowActions(() => { setSalaryRowForm({ ...initialSalaryRowForm, ...row, salary_table_id: row.table_id }); setOpenPanel("salary-row"); }, () => deleteItem(() => deleteSalaryTableRow(row.id), "fila salarial"))])} /></div>
        </Section>
      )}

      {selectedAgreement && activeTab === "rules" && (
        <Section title="Jornada, vacaciones y permisos" subtitle="Reglas informativas separadas por bloque administrativo.">
          <ActionBar actions={[["+ Nueva jornada", () => { setWorkTimeRuleForm(initialWorkTimeRuleForm); togglePanel("work-time"); }, "primary"], ["+ Vacaciones", () => { setVacationRuleForm(initialVacationRuleForm); togglePanel("vacation"); }], ["+ Permiso", () => { setLeaveRuleForm(initialLeaveRuleForm); togglePanel("leave"); }]]} />
          {openPanel === "work-time" && <WorkTimeForm form={workTimeRuleForm} setForm={setWorkTimeRuleForm} onSubmit={handleSaveWorkTimeRule} submitting={submitting} />}
          {openPanel === "vacation" && <VacationForm form={vacationRuleForm} setForm={setVacationRuleForm} onSubmit={handleSaveVacationRule} submitting={submitting} />}
          {openPanel === "leave" && <LeaveForm form={leaveRuleForm} setForm={setLeaveRuleForm} onSubmit={handleSaveLeaveRule} submitting={submitting} />}
          <RuleTables workTimeRules={workTimeRules} vacationRules={vacationRules} leaveRules={leaveRules} onEditWork={(rule) => { setWorkTimeRuleForm({ ...initialWorkTimeRuleForm, ...rule }); setOpenPanel("work-time"); }} onDeleteWork={(rule) => deleteItem(() => deleteWorkTimeRule(rule.id), "regla de jornada")} onEditVacation={(rule) => { setVacationRuleForm({ ...initialVacationRuleForm, ...rule }); setOpenPanel("vacation"); }} onDeleteVacation={(rule) => deleteItem(() => deleteVacationRule(rule.id), "regla de vacaciones")} onEditLeave={(rule) => { setLeaveRuleForm({ ...initialLeaveRuleForm, ...rule }); setOpenPanel("leave"); }} onDeleteLeave={(rule) => deleteItem(() => deleteLeaveRule(rule.id), "permiso")} />
        </Section>
      )}

      {selectedAgreement && activeTab === "seniority" && (
        <Section title="Antigüedad" subtitle="Importes de antigüedad informados en las filas salariales del convenio.">
          <p style={styles.helpText}>Esta vista conserva los importes históricos de cada fila salarial. La configuración de módulos y vencimientos se encuentra en Criterios laborales.</p>
          <SimpleTable columns={["Tabla", "Año", "Categoría", "Grupo", "Importe antigüedad", "Acciones"]} empty="Sin importes de antigüedad registrados." rows={salaryRows.map((row) => [row.table_name, row.table_year, row.category_name || "—", row.group_name || getGroupName(groups, row.professional_group_id), money(row.seniority_amount), rowActions(() => { onActiveTabChange?.("salary"); setSalaryRowForm({ ...initialSalaryRowForm, ...row, salary_table_id: row.table_id }); setOpenPanel("salary-row"); }, () => deleteItem(() => deleteSalaryTableRow(row.id), "fila salarial"))])} />
        </Section>
      )}

      {agreementModalOpen && (
        <Modal title="Nuevo convenio" onClose={() => setAgreementModalOpen(false)}>
          <form onSubmit={handleCreateAgreement} style={styles.modalForm}>
            <div style={styles.modalGroup}><h4>Identificación</h4><div style={styles.formGrid}><Field label="Nombre del convenio"><input style={styles.input} value={agreementForm.name} onChange={(event) => setAgreementForm({ ...agreementForm, name: event.target.value })} required /></Field><Field label="Código oficial"><input style={styles.input} value={agreementForm.agreement_code} onChange={(event) => setAgreementForm({ ...agreementForm, agreement_code: event.target.value })} /></Field><Field label="Sector"><input style={styles.input} value={agreementForm.sector} onChange={(event) => setAgreementForm({ ...agreementForm, sector: event.target.value })} /></Field><Field label="Ámbito territorial"><input style={styles.input} value={agreementForm.territorial_scope} onChange={(event) => setAgreementForm({ ...agreementForm, territorial_scope: event.target.value })} /></Field></div></div>
            <div style={styles.modalGroup}><h4>Vigencia y estado</h4><div style={styles.formGridThree}><Field label="Fecha entrada en vigor"><input type="date" style={styles.input} value={agreementForm.effective_from} onChange={(event) => setAgreementForm({ ...agreementForm, effective_from: event.target.value })} /></Field><Field label="Fecha fin vigencia"><input type="date" style={styles.input} value={agreementForm.effective_to} onChange={(event) => setAgreementForm({ ...agreementForm, effective_to: event.target.value })} /></Field><Field label="Estado"><select style={styles.input} value={agreementForm.status} onChange={(event) => setAgreementForm({ ...agreementForm, status: event.target.value })}><option value="draft">Borrador</option><option value="active">Activo</option><option value="archived">Caducado</option></select></Field></div></div>
            <div style={styles.modalGroup}><h4>Notas internas</h4><textarea style={{ ...styles.textarea, minHeight: "110px" }} value={agreementForm.notes} onChange={(event) => setAgreementForm({ ...agreementForm, notes: event.target.value })} /></div>
            <div style={styles.modalActions}><button type="button" onClick={() => setAgreementModalOpen(false)} style={styles.secondaryButton}>Cancelar</button><button type="submit" disabled={submitting} style={styles.primaryButton}>Crear convenio</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function rowActions(onEdit, onDelete) { return <div style={styles.rowActions}><button type="button" onClick={onEdit} style={styles.linkButton}>Editar</button><button type="button" onClick={onDelete} style={styles.dangerLink}>Eliminar</button></div>; }
function Section({ title, subtitle, children }) { return <section style={styles.section}><header style={styles.sectionHeader}><h3 style={styles.sectionTitle}>{title}</h3>{subtitle && <p style={styles.sectionSubtitle}>{subtitle}</p>}</header>{children}</section>; }
function InlineForm({ title, onSubmit, children }) { return <form onSubmit={onSubmit} style={styles.inlineForm}><h3 style={styles.inlineTitle}>{title}</h3><div style={styles.inlineGrid}>{children}</div></form>; }
function Field({ label, children }) { return <label style={styles.field}>{label}{children}</label>; }
function RecordItem({ label, value }) { return <div style={styles.recordItem}><span>{label}</span><strong>{value}</strong></div>; }
function StatusBadge({ status }) { return <span style={{ ...styles.statusBadge, ...(styles[`${status.tone}Status`] || {}) }}>{status.label}</span>; }
function DefinitionTable({ rows }) { return <div style={styles.definitionTable}>{rows.map(([label, value]) => <div key={label} style={styles.definitionRow}><span>{label}</span><strong>{value}</strong></div>)}</div>; }
function StatsGrid({ items }) { return <div style={styles.statsGrid}>{items.map(([label, value]) => <div key={label} style={styles.statCard}><strong>{value}</strong><span>{label}</span></div>)}</div>; }
function AlertsList({ alerts }) { return alerts.length ? <ul style={styles.alertList}>{alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul> : <div style={styles.emptyAlert}>Sin alertas críticas.</div>; }
function ActionBar({ actions }) { return <div style={styles.actionBar}>{actions.map(([label, onClick, type]) => <button key={label} type="button" onClick={onClick} style={type === "primary" ? styles.primaryButton : styles.secondaryButton}>{label}</button>)}</div>; }
function Modal({ title, onClose, children }) { return <div style={styles.modalOverlay}><div style={styles.modal}><header style={styles.modalHeader}><h3>{title}</h3><button type="button" onClick={onClose} style={styles.closeButton}>×</button></header>{children}</div></div>; }
function SalaryTableForm({ form, setForm, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar tabla salarial" : "Nueva tabla salarial"} onSubmit={onSubmit}><Field label="Nombre de la tabla"><input style={styles.input} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><Field label="Año"><input style={styles.input} value={form.year || ""} onChange={(event) => setForm({ ...form, year: event.target.value })} /></Field><Field label="Nº pagas"><input type="number" style={styles.input} value={form.number_of_payments || ""} onChange={(event) => setForm({ ...form, number_of_payments: Number(event.target.value) })} /></Field><Field label="Tipo importe"><select style={styles.input} value={form.amount_type || "monthly"} onChange={(event) => setForm({ ...form, amount_type: event.target.value })}><option value="monthly">Mensual</option><option value="annual">Anual</option></select></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function SalaryRowForm({ form, setForm, salaryTables, categories, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar fila salarial" : "Nueva fila salarial"} onSubmit={onSubmit}><Field label="Tabla salarial"><select style={styles.input} value={form.salary_table_id || ""} onChange={(event) => setForm({ ...form, salary_table_id: event.target.value })} required><option value="">Selecciona tabla</option>{salaryTables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select></Field><Field label="Categoría"><select style={styles.input} value={form.professional_category_id || ""} onChange={(event) => setForm({ ...form, professional_category_id: event.target.value })}><option value="">Categoría manual</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field><Field label="Salario base"><input type="number" style={styles.input} value={form.base_salary || ""} onChange={(event) => setForm({ ...form, base_salary: event.target.value })} required /></Field><Field label="Plus convenio"><input type="number" style={styles.input} value={form.agreement_plus || ""} onChange={(event) => setForm({ ...form, agreement_plus: event.target.value })} /></Field><Field label="Antigüedad"><input type="number" style={styles.input} value={form.seniority_amount || ""} onChange={(event) => setForm({ ...form, seniority_amount: event.target.value })} /></Field><Field label="Total"><input type="number" style={styles.input} value={form.total_amount || ""} onChange={(event) => setForm({ ...form, total_amount: event.target.value })} /></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function WorkTimeForm({ form, setForm, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar jornada" : "Nueva jornada"} onSubmit={onSubmit}><Field label="Nombre"><input style={styles.input} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><Field label="Horas anuales"><input type="number" style={styles.input} value={form.annual_hours || ""} onChange={(event) => setForm({ ...form, annual_hours: event.target.value })} /></Field><Field label="Horas semanales"><input type="number" style={styles.input} value={form.weekly_hours || ""} onChange={(event) => setForm({ ...form, weekly_hours: event.target.value })} /></Field><Field label="Distribución"><select style={styles.input} value={form.distribution_type || "regular"} onChange={(event) => setForm({ ...form, distribution_type: event.target.value })}><option value="regular">Regular</option><option value="irregular">Irregular</option></select></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function VacationForm({ form, setForm, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar vacaciones" : "Nuevas vacaciones"} onSubmit={onSubmit}><Field label="Nombre"><input style={styles.input} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><Field label="Días naturales"><input type="number" style={styles.input} value={form.natural_days || ""} onChange={(event) => setForm({ ...form, natural_days: event.target.value })} /></Field><Field label="Días laborables"><input type="number" style={styles.input} value={form.working_days || ""} onChange={(event) => setForm({ ...form, working_days: event.target.value })} /></Field><Field label="Devengo"><input style={styles.input} value={form.accrual_period || ""} onChange={(event) => setForm({ ...form, accrual_period: event.target.value })} /></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function LeaveForm({ form, setForm, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar permiso" : "Nuevo permiso"} onSubmit={onSubmit}><Field label="Nombre"><input style={styles.input} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><Field label="Tipo"><select style={styles.input} value={form.leave_type || "paid"} onChange={(event) => setForm({ ...form, leave_type: event.target.value })}><option value="paid">Retribuido</option><option value="unpaid">No retribuido</option></select></Field><Field label="Causa"><input style={styles.input} value={form.cause || ""} onChange={(event) => setForm({ ...form, cause: event.target.value })} /></Field><Field label="Duración"><input style={styles.input} value={form.duration || ""} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function SalaryTablesSummary({ salaryTables, onEdit, onDelete }) { return <SimpleTable columns={["Nombre", "Año", "Pagas", "Tipo", "Estado", "Acciones"]} empty="Sin tablas salariales registradas." rows={salaryTables.map((table) => [table.name, table.year || "—", table.number_of_payments || "—", table.amount_type === "annual" ? "Anual" : "Mensual", table.status || "—", rowActions(() => onEdit(table), () => onDelete(table))])} />; }
function RuleTables({ workTimeRules, vacationRules, leaveRules, onEditWork, onDeleteWork, onEditVacation, onDeleteVacation, onEditLeave, onDeleteLeave }) { return <div style={styles.ruleStack}><RuleSection title="Jornada"><SimpleTable columns={["Nombre", "Horas año", "Horas semana", "Distribución", "Acciones"]} empty="Sin reglas de jornada." rows={workTimeRules.map((rule) => [rule.name, rule.annual_hours || "—", rule.weekly_hours || "—", rule.distribution_type === "irregular" ? "Irregular" : "Regular", rowActions(() => onEditWork(rule), () => onDeleteWork(rule))])} /></RuleSection><RuleSection title="Vacaciones"><SimpleTable columns={["Nombre", "Naturales", "Laborables", "Devengo", "Acciones"]} empty="Sin reglas de vacaciones." rows={vacationRules.map((rule) => [rule.name, rule.natural_days || "—", rule.working_days || "—", rule.accrual_period || "—", rowActions(() => onEditVacation(rule), () => onDeleteVacation(rule))])} /></RuleSection><RuleSection title="Permisos"><SimpleTable columns={["Nombre", "Tipo", "Duración", "Causa", "Acciones"]} empty="Sin permisos registrados." rows={leaveRules.map((rule) => [rule.name, formatLeaveType(rule.leave_type), rule.duration ? `${rule.duration} ${rule.duration_unit || ""}` : "—", rule.cause || "—", rowActions(() => onEditLeave(rule), () => onDeleteLeave(rule))])} /></RuleSection></div>; }
function RuleSection({ title, children }) { return <section><h3 style={styles.subsectionTitle}>{title}</h3>{children}</section>; }
function SimpleTable({ columns, rows, empty }) { return <div style={styles.tableBox}><table style={styles.table}><thead><tr>{columns.map((column) => <th key={column} style={styles.th}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} style={styles.td}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={columns.length} style={styles.td}>{empty}</td></tr>}</tbody></table></div>; }

const styles = {
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
