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
  deleteLeaveRule,
  deleteProfessionalCategory,
  deleteProfessionalGroup,
  deleteSalaryTable,
  deleteSalaryTableRow,
  deleteVacationRule,
  deleteWorkTimeRule,
  fetchCollectiveAgreement,
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
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "id").map(([key, value]) => [key, value === "" ? null : value]));
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

function rowActions(onEdit, onDelete) {
  return <div style={styles.rowActions}><button type="button" onClick={onEdit} style={styles.linkButton}>Editar</button><button type="button" onClick={onDelete} style={styles.dangerLink}>Eliminar</button></div>;
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
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
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
    fetchCollectiveAgreement(activeAgreement.id).then((data) => { setSelectedAgreement(data); setError(""); }).catch((err) => setError(err.message || "Error al cargar detalle del convenio"));
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
  const salaryRows = salaryTables.flatMap((table) => (table.rows || []).map((row) => ({ ...row, table_id: table.id, table_name: table.name, table_year: table.year })));
  const selectedStatus = getAgreementStatus(selectedAgreement || activeAgreement);
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

  const handleSeedDemo = () => submitAction(seedDemoCollectiveAgreement, "Convenio demo cargado correctamente");

  const handleCreateAgreement = (event) => {
    event.preventDefault();
    if (agreementForm.effective_from && agreementForm.effective_to && agreementForm.effective_to < agreementForm.effective_from) {
      setError("La fecha fin no puede ser anterior a la fecha de inicio.");
      return;
    }
    submitAction(() => createCollectiveAgreement(cleanPayload(agreementForm)), "Convenio creado correctamente", () => { setAgreementForm(initialAgreementForm); setAgreementModalOpen(false); });
  };

  const handleUpdateStatus = (status) => {
    if (!selectedAgreement?.id) return;
    submitAction(() => updateCollectiveAgreement(selectedAgreement.id, cleanPayload({ ...selectedAgreement, status })), status === "active" ? "Convenio marcado como activo" : "Convenio marcado como caducado", null, selectedAgreement.id);
  };

  const handleSaveGroup = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = groupForm.id ? () => updateProfessionalGroup(groupForm.id, cleanPayload(groupForm)) : () => createProfessionalGroup(activeAgreement.id, cleanPayload(groupForm));
    submitAction(action, groupForm.id ? "Grupo profesional actualizado" : "Grupo profesional creado", () => { setGroupForm(initialGroupForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleSaveCategory = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = categoryForm.id ? () => updateProfessionalCategory(categoryForm.id, cleanPayload(categoryForm)) : () => createProfessionalCategory(activeAgreement.id, cleanPayload(categoryForm));
    submitAction(action, categoryForm.id ? "Categoría profesional actualizada" : "Categoría profesional creada", () => { setCategoryForm(initialCategoryForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleSaveSalaryTable = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = salaryTableForm.id ? () => updateSalaryTable(salaryTableForm.id, cleanPayload(salaryTableForm)) : () => createSalaryTable(activeAgreement.id, cleanPayload(salaryTableForm));
    submitAction(action, salaryTableForm.id ? "Tabla salarial actualizada" : "Tabla salarial creada", () => { setSalaryTableForm(initialSalaryTableForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleSaveSalaryRow = (event) => {
    event.preventDefault();
    if (!salaryRowForm.salary_table_id) {
      setError("Selecciona una tabla salarial antes de guardar la fila.");
      return;
    }
    const category = categories.find((item) => String(item.id) === String(salaryRowForm.professional_category_id));
    const group = groups.find((item) => Number(item.id) === Number(category?.professional_group_id));
    const payload = cleanPayload({ ...salaryRowForm, category_name: category?.name || salaryRowForm.category_name || null, group_name: group?.name || salaryRowForm.group_name || null, professional_group_id: category?.professional_group_id || salaryRowForm.professional_group_id || null });
    const action = salaryRowForm.id ? () => updateSalaryTableRow(salaryRowForm.id, payload) : () => createSalaryTableRow(salaryRowForm.salary_table_id, payload);
    submitAction(action, salaryRowForm.id ? "Fila salarial actualizada" : "Fila salarial creada", () => { setSalaryRowForm(initialSalaryRowForm); setOpenPanel(""); }, activeAgreement?.id);
  };

  const handleSaveWorkTimeRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = workTimeRuleForm.id ? () => updateWorkTimeRule(workTimeRuleForm.id, cleanPayload(workTimeRuleForm)) : () => createWorkTimeRule(activeAgreement.id, cleanPayload(workTimeRuleForm));
    submitAction(action, workTimeRuleForm.id ? "Regla de jornada actualizada" : "Regla de jornada creada", () => { setWorkTimeRuleForm(initialWorkTimeRuleForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleSaveVacationRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = vacationRuleForm.id ? () => updateVacationRule(vacationRuleForm.id, cleanPayload(vacationRuleForm)) : () => createVacationRule(activeAgreement.id, cleanPayload(vacationRuleForm));
    submitAction(action, vacationRuleForm.id ? "Regla de vacaciones actualizada" : "Regla de vacaciones creada", () => { setVacationRuleForm(initialVacationRuleForm); setOpenPanel(""); }, activeAgreement.id);
  };

  const handleSaveLeaveRule = (event) => {
    event.preventDefault();
    if (!activeAgreement?.id) return;
    const action = leaveRuleForm.id ? () => updateLeaveRule(leaveRuleForm.id, cleanPayload(leaveRuleForm)) : () => createLeaveRule(activeAgreement.id, cleanPayload(leaveRuleForm));
    submitAction(action, leaveRuleForm.id ? "Permiso actualizado" : "Permiso creado", () => { setLeaveRuleForm(initialLeaveRuleForm); setOpenPanel(""); }, activeAgreement.id);
  };

  function togglePanel(panel) { setOpenPanel((current) => current === panel ? "" : panel); }
  function deleteItem(action, label) { if (window.confirm(`¿Eliminar ${label}?`)) submitAction(action, `${label} eliminado`, null, activeAgreement?.id); }
  function startCategoryForGroup(group) { setSelectedGroupId(String(group.id)); setCategoryForm({ ...initialCategoryForm, professional_group_id: group.id }); setOpenPanel("category"); }

  return (
    <div style={styles.wrapper}>
      <section style={styles.topBar}>
        <div style={styles.titleBlock}><h2 style={styles.pageTitle}>Convenios colectivos</h2><p style={styles.pageSubtitle}>Categorías, jornada, permisos y tablas salariales para simulación docente.</p></div>
        <div style={styles.toolbar}>
          <select value={activeAgreement?.id || ""} onChange={(event) => setSelectedAgreementId(event.target.value)} style={styles.selectLarge}>{collectiveAgreements.length === 0 && <option value="">Sin convenios</option>}{collectiveAgreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.agreement_code || "sin código"}</option>)}</select>
          <StatusBadge status={selectedStatus} />
          <button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.secondaryButton}>Cargar demo</button>
          <button type="button" onClick={() => setAgreementModalOpen(true)} style={styles.primaryButton}>Nuevo convenio</button>
        </div>
      </section>

      {selectedAgreement && <section style={styles.recordHeader}><div style={styles.recordMain}><span style={styles.recordEyebrow}>Convenio seleccionado</span><strong style={styles.recordTitle}>{selectedAgreement.name}</strong></div><RecordItem label="Código" value={selectedAgreement.agreement_code || "—"} /><RecordItem label="Sector" value={selectedAgreement.sector || "—"} /><RecordItem label="Vigencia" value={`${formatDate(selectedAgreement.effective_from)} - ${formatDate(selectedAgreement.effective_to)}`} /><div style={styles.recordActions}><button type="button" style={styles.linkButton} onClick={() => setAgreementModalOpen(true)}>Nuevo</button><button type="button" style={styles.linkButton} onClick={() => setMessage("Acción preparada para MVP posterior: duplicar convenio.")}>Duplicar</button><button type="button" style={styles.linkButton} onClick={() => handleUpdateStatus("active")}>Activar</button><button type="button" style={styles.linkButton} onClick={() => handleUpdateStatus("archived")}>Caducar</button></div></section>}

      {(message || error || loading) && <div style={error ? styles.feedbackError : styles.feedbackOk}>{message && <span>{message}</span>}{error && <span>{error}</span>}{loading && <span>Cargando datos...</span>}</div>}
      <nav style={styles.tabs}>{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={activeTab === tab.id ? styles.tabActive : styles.tab}>{tab.label}</button>)}</nav>

      {!selectedAgreement && <Section title="Sin convenio seleccionado"><button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.primaryButton}>Cargar convenio demo</button></Section>}

      {selectedAgreement && activeTab === "overview" && <div style={styles.overviewLayout}><Section title="Ficha administrativa" subtitle="Resumen del expediente de convenio."><DefinitionTable rows={[["Nombre", selectedAgreement.name], ["Código oficial", selectedAgreement.agreement_code || "—"], ["Sector", selectedAgreement.sector || "—"], ["Ámbito territorial", selectedAgreement.territorial_scope || "—"], ["Vigente desde", formatDate(selectedAgreement.effective_from)], ["Vigente hasta", formatDate(selectedAgreement.effective_to)], ["Estado", selectedStatus.label], ["Notas", selectedAgreement.notes || "Sin notas"]]} /></Section><aside style={styles.sidePanel}><h3 style={styles.sideTitle}>Control del convenio</h3><StatsList items={[["Grupos", groups.length], ["Categorías", categories.length], ["Tablas", salaryTables.length], ["Filas salariales", salaryRows.length], ["Jornada", workTimeRules.length], ["Vacaciones", vacationRules.length], ["Permisos", leaveRules.length], ["Complementos", complements.length]]} /><div style={styles.alertBlock}><h4 style={styles.alertTitle}>Alertas</h4><AlertsList alerts={alerts} /></div></aside></div>}

      {selectedAgreement && activeTab === "classification" && <Section title="Clasificación profesional" subtitle="Estructura del convenio por grupos y categorías."><ActionBar actions={[["+ Nuevo grupo", () => { setGroupForm(initialGroupForm); togglePanel("group"); }, "primary"], ["+ Nueva categoría", () => { setCategoryForm(initialCategoryForm); togglePanel("category"); }]]} />{openPanel === "group" && <InlineForm title={groupForm.id ? "Editar grupo profesional" : "Nuevo grupo profesional"} onSubmit={handleSaveGroup}><input style={styles.input} placeholder="Código" value={groupForm.code || ""} onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })} /><input style={styles.input} placeholder="Nombre del grupo" value={groupForm.name || ""} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} required /><textarea style={styles.textarea} placeholder="Descripción" value={groupForm.description || ""} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} /><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>}{openPanel === "category" && <InlineForm title={categoryForm.id ? "Editar categoría profesional" : "Nueva categoría profesional"} onSubmit={handleSaveCategory}><select style={styles.input} value={categoryForm.professional_group_id || ""} onChange={(e) => setCategoryForm({ ...categoryForm, professional_group_id: e.target.value })}><option value="">Sin grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><input style={styles.input} placeholder="Código" value={categoryForm.code || ""} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} /><input style={styles.input} placeholder="Nombre categoría" value={categoryForm.name || ""} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required /><input style={styles.input} placeholder="Nivel" value={categoryForm.level || ""} onChange={(e) => setCategoryForm({ ...categoryForm, level: e.target.value })} /><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>}<div style={styles.masterDetail}><div style={styles.masterList}><h3 style={styles.listTitle}>Grupos profesionales</h3>{groups.map((group) => <button key={group.id} type="button" onClick={() => setSelectedGroupId(String(group.id))} style={String(selectedGroup?.id) === String(group.id) ? styles.masterRowActive : styles.masterRow}><strong>{group.name}</strong><span>{group.code || "Sin código"}</span></button>)}{groups.length === 0 && <Empty text="Sin grupos registrados." />}</div><div><div style={styles.tableTop}><h3 style={styles.listTitle}>Categorías {selectedGroup ? `· ${selectedGroup.name}` : ""}</h3>{selectedGroup && <button type="button" onClick={() => startCategoryForGroup(selectedGroup)} style={styles.linkButton}>Añadir en este grupo</button>}</div><SimpleTable columns={["Grupo", "Código", "Categoría", "Nivel", "Acciones"]} empty="Sin categorías para este grupo." rows={filteredCategories.map((category) => [getGroupName(groups, category.professional_group_id), category.code || "—", category.name, category.level || "—", rowActions(() => { setCategoryForm({ ...initialCategoryForm, ...category }); setOpenPanel("category"); }, () => deleteItem(() => deleteProfessionalCategory(category.id), "categoría"))])} /></div></div><h3 style={styles.subsectionTitle}>Gestión de grupos</h3><SimpleTable columns={["Código", "Grupo", "Acciones"]} empty="Sin grupos." rows={groups.map((group) => [group.code || "—", group.name, rowActions(() => { setGroupForm({ ...initialGroupForm, ...group }); setOpenPanel("group"); }, () => deleteItem(() => deleteProfessionalGroup(group.id), "grupo"))])} /></Section>}

      {selectedAgreement && activeTab === "salary" && <Section title="Tablas salariales" subtitle="Estructura anual del convenio con importes de referencia."><ActionBar actions={[["+ Crear tabla", () => { setSalaryTableForm(initialSalaryTableForm); togglePanel("salary-table"); }, "primary"], ["+ Añadir fila", () => { setSalaryRowForm(initialSalaryRowForm); togglePanel("salary-row"); }]]} />{openPanel === "salary-table" && <SalaryTableForm form={salaryTableForm} setForm={setSalaryTableForm} onSubmit={handleSaveSalaryTable} submitting={submitting} />}{openPanel === "salary-row" && <SalaryRowForm form={salaryRowForm} setForm={setSalaryRowForm} salaryTables={salaryTables} categories={categories} onSubmit={handleSaveSalaryRow} submitting={submitting} />}<SalaryTablesSummary salaryTables={salaryTables} onEdit={(table) => { setSalaryTableForm({ ...initialSalaryTableForm, ...table }); setOpenPanel("salary-table"); }} onDelete={(table) => deleteItem(() => deleteSalaryTable(table.id), "tabla salarial")} /><SimpleTable columns={["Tabla", "Año", "Categoría", "Grupo", "Salario base", "Plus convenio", "Antigüedad", "Total", "Acciones"]} empty="Sin filas salariales." rows={salaryRows.map((row) => [row.table_name, row.table_year, row.category_name || "—", row.group_name || getGroupName(groups, row.professional_group_id), money(row.base_salary), money(row.agreement_plus), money(row.seniority_amount), money(row.total_amount), rowActions(() => { setSalaryRowForm({ ...initialSalaryRowForm, ...row, salary_table_id: row.table_id }); setOpenPanel("salary-row"); }, () => deleteItem(() => deleteSalaryTableRow(row.id), "fila salarial"))])} /></Section>}

      {selectedAgreement && activeTab === "rules" && <Section title="Jornada, vacaciones y permisos" subtitle="Reglas informativas separadas por bloque administrativo."><ActionBar actions={[["+ Nueva jornada", () => { setWorkTimeRuleForm(initialWorkTimeRuleForm); togglePanel("work-time"); }, "primary"], ["+ Vacaciones", () => { setVacationRuleForm(initialVacationRuleForm); togglePanel("vacation"); }], ["+ Permiso", () => { setLeaveRuleForm(initialLeaveRuleForm); togglePanel("leave"); }]]} />{openPanel === "work-time" && <WorkTimeForm form={workTimeRuleForm} setForm={setWorkTimeRuleForm} onSubmit={handleSaveWorkTimeRule} submitting={submitting} />}{openPanel === "vacation" && <VacationForm form={vacationRuleForm} setForm={setVacationRuleForm} onSubmit={handleSaveVacationRule} submitting={submitting} />}{openPanel === "leave" && <LeaveForm form={leaveRuleForm} setForm={setLeaveRuleForm} onSubmit={handleSaveLeaveRule} submitting={submitting} />}<RuleTables workTimeRules={workTimeRules} vacationRules={vacationRules} leaveRules={leaveRules} onEditWork={(rule) => { setWorkTimeRuleForm({ ...initialWorkTimeRuleForm, ...rule }); setOpenPanel("work-time"); }} onDeleteWork={(rule) => deleteItem(() => deleteWorkTimeRule(rule.id), "regla de jornada")} onEditVacation={(rule) => { setVacationRuleForm({ ...initialVacationRuleForm, ...rule }); setOpenPanel("vacation"); }} onDeleteVacation={(rule) => deleteItem(() => deleteVacationRule(rule.id), "regla de vacaciones")} onEditLeave={(rule) => { setLeaveRuleForm({ ...initialLeaveRuleForm, ...rule }); setOpenPanel("leave"); }} onDeleteLeave={(rule) => deleteItem(() => deleteLeaveRule(rule.id), "permiso")} /></Section>}

      {selectedAgreement && activeTab === "seniority" && <Section title="Antigüedad" subtitle="Importes de antigüedad informados en las filas salariales del convenio."><p style={styles.helpText}>En este MVP la antigüedad se gestiona como importe de referencia dentro de cada fila salarial. Más adelante puede separarse en trienios, quinquenios, reglas de devengo y topes.</p><SimpleTable columns={["Tabla", "Año", "Categoría", "Grupo", "Importe antigüedad", "Acciones"]} empty="Sin importes de antigüedad registrados." rows={salaryRows.map((row) => [row.table_name, row.table_year, row.category_name || "—", row.group_name || getGroupName(groups, row.professional_group_id), money(row.seniority_amount), rowActions(() => { setActiveTab("salary"); setSalaryRowForm({ ...initialSalaryRowForm, ...row, salary_table_id: row.table_id }); setOpenPanel("salary-row"); }, () => deleteItem(() => deleteSalaryTableRow(row.id), "fila salarial"))])} /></Section>}

      {agreementModalOpen && <Modal title="Nuevo convenio" onClose={() => setAgreementModalOpen(false)}><form onSubmit={handleCreateAgreement} style={styles.formGrid}><input style={styles.input} placeholder="Nombre" value={agreementForm.name} onChange={(e) => setAgreementForm({ ...agreementForm, name: e.target.value })} required /><input style={styles.input} placeholder="Código convenio" value={agreementForm.agreement_code} onChange={(e) => setAgreementForm({ ...agreementForm, agreement_code: e.target.value })} /><input style={styles.input} placeholder="Sector" value={agreementForm.sector} onChange={(e) => setAgreementForm({ ...agreementForm, sector: e.target.value })} /><input style={styles.input} placeholder="Ámbito territorial" value={agreementForm.territorial_scope} onChange={(e) => setAgreementForm({ ...agreementForm, territorial_scope: e.target.value })} /><label style={styles.fieldLabel}>Fecha entrada en vigor<input type="date" style={styles.input} value={agreementForm.effective_from} onChange={(e) => setAgreementForm({ ...agreementForm, effective_from: e.target.value })} /></label><label style={styles.fieldLabel}>Fecha fin vigencia<input type="date" style={styles.input} value={agreementForm.effective_to} onChange={(e) => setAgreementForm({ ...agreementForm, effective_to: e.target.value })} /></label><select style={styles.input} value={agreementForm.status} onChange={(e) => setAgreementForm({ ...agreementForm, status: e.target.value })}><option value="draft">Borrador</option><option value="active">Activo</option><option value="archived">Caducado</option></select><textarea style={{ ...styles.textarea, gridColumn: "1 / -1" }} placeholder="Notas" value={agreementForm.notes} onChange={(e) => setAgreementForm({ ...agreementForm, notes: e.target.value })} /><div style={styles.modalActions}><button type="button" onClick={() => setAgreementModalOpen(false)} style={styles.secondaryButton}>Cancelar</button><button type="submit" disabled={submitting} style={styles.primaryButton}>Crear convenio</button></div></form></Modal>}
    </div>
  );
}

function Section({ title, subtitle, children }) { return <section style={styles.section}><header style={styles.sectionHeader}><h3 style={styles.sectionTitle}>{title}</h3>{subtitle && <p style={styles.sectionSubtitle}>{subtitle}</p>}</header>{children}</section>; }
function InlineForm({ title, onSubmit, children }) { return <form onSubmit={onSubmit} style={styles.inlineForm}><h3 style={styles.inlineTitle}>{title}</h3><div style={styles.inlineGrid}>{children}</div></form>; }
function RecordItem({ label, value }) { return <div style={styles.recordItem}><span>{label}</span><strong>{value}</strong></div>; }
function StatusBadge({ status }) { return <span style={{ ...styles.statusBadge, ...(styles[`${status.tone}Status`] || {}) }}>{status.label}</span>; }
function DefinitionTable({ rows }) { return <div style={styles.definitionTable}>{rows.map(([label, value]) => <div key={label} style={styles.definitionRow}><span>{label}</span><strong>{value}</strong></div>)}</div>; }
function StatsList({ items }) { return <div style={styles.statsList}>{items.map(([label, value]) => <div key={label} style={styles.statRow}><span>{label}</span><strong>{value}</strong></div>)}</div>; }
function AlertsList({ alerts }) { if (!alerts.length) return <div style={styles.emptyAlert}>Sin alertas críticas.</div>; return <ul style={styles.alertList}>{alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul>; }
function ActionBar({ actions }) { return <div style={styles.actionBar}>{actions.map(([label, onClick, type]) => <button key={label} type="button" onClick={onClick} style={type === "primary" ? styles.primaryButton : styles.secondaryButton}>{label}</button>)}</div>; }
function Modal({ title, onClose, children }) { return <div style={styles.modalOverlay}><div style={styles.modal}><header style={styles.modalHeader}><h3>{title}</h3><button type="button" onClick={onClose} style={styles.closeButton}>×</button></header>{children}</div></div>; }
function SalaryTableForm({ form, setForm, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar tabla salarial" : "Nueva tabla salarial"} onSubmit={onSubmit}><input style={styles.input} placeholder="Nombre" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input style={styles.input} placeholder="Año" value={form.year || ""} onChange={(e) => setForm({ ...form, year: e.target.value })} /><input type="number" style={styles.input} placeholder="Nº pagas" value={form.number_of_payments || ""} onChange={(e) => setForm({ ...form, number_of_payments: Number(e.target.value) })} /><select style={styles.input} value={form.amount_type || "monthly"} onChange={(e) => setForm({ ...form, amount_type: e.target.value })}><option value="monthly">Mensual</option><option value="annual">Anual</option></select><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function SalaryRowForm({ form, setForm, salaryTables, categories, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar fila salarial" : "Nueva fila salarial"} onSubmit={onSubmit}><select style={styles.input} value={form.salary_table_id || ""} onChange={(e) => setForm({ ...form, salary_table_id: e.target.value })} required><option value="">Selecciona tabla</option>{salaryTables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select><select style={styles.input} value={form.professional_category_id || ""} onChange={(e) => setForm({ ...form, professional_category_id: e.target.value })}><option value="">Categoría manual</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><input type="number" style={styles.input} placeholder="Salario base" value={form.base_salary || ""} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} required /><input type="number" style={styles.input} placeholder="Plus convenio" value={form.agreement_plus || ""} onChange={(e) => setForm({ ...form, agreement_plus: e.target.value })} /><input type="number" style={styles.input} placeholder="Antigüedad" value={form.seniority_amount || ""} onChange={(e) => setForm({ ...form, seniority_amount: e.target.value })} /><input type="number" style={styles.input} placeholder="Total" value={form.total_amount || ""} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} /><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function WorkTimeForm({ form, setForm, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar jornada" : "Nueva jornada"} onSubmit={onSubmit}><input style={styles.input} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input type="number" style={styles.input} placeholder="Horas anuales" value={form.annual_hours || ""} onChange={(e) => setForm({ ...form, annual_hours: e.target.value })} /><input type="number" style={styles.input} placeholder="Horas semanales" value={form.weekly_hours || ""} onChange={(e) => setForm({ ...form, weekly_hours: e.target.value })} /><select style={styles.input} value={form.distribution_type || "regular"} onChange={(e) => setForm({ ...form, distribution_type: e.target.value })}><option value="regular">Regular</option><option value="irregular">Irregular</option></select><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function VacationForm({ form, setForm, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar vacaciones" : "Nuevas vacaciones"} onSubmit={onSubmit}><input style={styles.input} value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input type="number" style={styles.input} placeholder="Días naturales" value={form.natural_days || ""} onChange={(e) => setForm({ ...form, natural_days: e.target.value })} /><input type="number" style={styles.input} placeholder="Días laborables" value={form.working_days || ""} onChange={(e) => setForm({ ...form, working_days: e.target.value })} /><input style={styles.input} placeholder="Devengo" value={form.accrual_period || ""} onChange={(e) => setForm({ ...form, accrual_period: e.target.value })} /><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function LeaveForm({ form, setForm, onSubmit, submitting }) { return <InlineForm title={form.id ? "Editar permiso" : "Nuevo permiso"} onSubmit={onSubmit}><input style={styles.input} placeholder="Nombre" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><select style={styles.input} value={form.leave_type || "paid"} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}><option value="paid">Retribuido</option><option value="unpaid">No retribuido</option></select><input style={styles.input} placeholder="Causa" value={form.cause || ""} onChange={(e) => setForm({ ...form, cause: e.target.value })} /><input style={styles.input} placeholder="Duración" value={form.duration || ""} onChange={(e) => setForm({ ...form, duration: e.target.value })} /><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>; }
function SalaryTablesSummary({ salaryTables, onEdit, onDelete }) { if (!salaryTables.length) return <Empty text="Sin tablas salariales registradas." />; return <div style={styles.salarySummary}>{salaryTables.map((table) => <div key={table.id} style={styles.salaryLine}><strong>{table.name}</strong><span>{table.year || "—"}</span><span>{table.number_of_payments || "—"} pagas</span><span>{table.amount_type === "annual" ? "Anual" : "Mensual"}</span><span>{table.status || "—"}</span>{rowActions(() => onEdit(table), () => onDelete(table))}</div>)}</div>; }
function RuleTables({ workTimeRules, vacationRules, leaveRules, onEditWork, onDeleteWork, onEditVacation, onDeleteVacation, onEditLeave, onDeleteLeave }) { return <div style={styles.ruleStack}><RuleSection title="Jornada"><SimpleTable columns={["Nombre", "Horas año", "Horas semana", "Distribución", "Acciones"]} empty="Sin reglas de jornada." rows={workTimeRules.map((rule) => [rule.name, rule.annual_hours || "—", rule.weekly_hours || "—", rule.distribution_type === "irregular" ? "Irregular" : "Regular", rowActions(() => onEditWork(rule), () => onDeleteWork(rule))])} /></RuleSection><RuleSection title="Vacaciones"><SimpleTable columns={["Nombre", "Naturales", "Laborables", "Devengo", "Acciones"]} empty="Sin reglas de vacaciones." rows={vacationRules.map((rule) => [rule.name, rule.natural_days || "—", rule.working_days || "—", rule.accrual_period || "—", rowActions(() => onEditVacation(rule), () => onDeleteVacation(rule))])} /></RuleSection><RuleSection title="Permisos"><SimpleTable columns={["Nombre", "Tipo", "Duración", "Causa", "Acciones"]} empty="Sin permisos registrados." rows={leaveRules.map((rule) => [rule.name, formatLeaveType(rule.leave_type), rule.duration ? `${rule.duration} ${rule.duration_unit || ""}` : "—", rule.cause || "—", rowActions(() => onEditLeave(rule), () => onDeleteLeave(rule))])} /></RuleSection></div>; }
function RuleSection({ title, children }) { return <section><h3 style={styles.subsectionTitle}>{title}</h3>{children}</section>; }
function SimpleTable({ columns, rows, empty }) { return <div style={styles.tableBox}><table style={styles.table}><thead><tr>{columns.map((column) => <th key={column} style={styles.th}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} style={styles.td}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={columns.length} style={styles.td}>{empty}</td></tr>}</tbody></table></div>; }
function Empty({ text }) { return <div style={styles.empty}>{text}</div>; }

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "10px", color: "#111827" },
  topBar: { display: "grid", gridTemplateColumns: "minmax(260px, 360px) 1fr", gap: "16px", alignItems: "center", borderBottom: "1px solid #e5e7eb", padding: "6px 0 12px", backgroundColor: "#fff" },
  titleBlock: { display: "flex", flexDirection: "column", gap: "2px" },
  pageTitle: { margin: 0, fontSize: "22px", lineHeight: 1.15, fontWeight: 850, color: "#111827" },
  pageSubtitle: { margin: 0, maxWidth: "520px", color: "#6b7280", fontSize: "13px", fontWeight: 600 },
  toolbar: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "7px", flexWrap: "wrap" },
  selectLarge: { minWidth: "360px", height: "34px", padding: "6px 9px", border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#fff", fontSize: "13px" },
  primaryButton: { height: "32px", backgroundColor: "#facc15", color: "#111827", border: "1px solid #eab308", borderRadius: "6px", padding: "0 10px", fontWeight: 800, fontSize: "12px", cursor: "pointer" },
  secondaryButton: { height: "32px", backgroundColor: "#fff", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", padding: "0 10px", fontWeight: 750, fontSize: "12px", cursor: "pointer" },
  linkButton: { backgroundColor: "transparent", color: "#374151", border: "0", padding: "2px 4px", fontWeight: 750, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" },
  dangerLink: { backgroundColor: "transparent", color: "#b91c1c", border: "0", padding: "2px 4px", fontWeight: 750, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" },
  rowActions: { display: "flex", gap: "6px", alignItems: "center" },
  statusBadge: { height: "28px", display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "999px", padding: "0 10px", fontSize: "12px", fontWeight: 850, border: "1px solid #d1d5db", backgroundColor: "#f9fafb", color: "#374151" },
  activeStatus: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#166534" }, draftStatus: { borderColor: "#fde68a", backgroundColor: "#fffbeb", color: "#92400e" }, expiredStatus: { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" }, futureStatus: { borderColor: "#bfdbfe", backgroundColor: "#eff6ff", color: "#1d4ed8" },
  recordHeader: { display: "grid", gridTemplateColumns: "minmax(240px, 1.4fr) repeat(3, minmax(120px, 0.7fr)) auto", alignItems: "center", gap: "12px", border: "1px solid #e5e7eb", borderLeft: "3px solid #facc15", backgroundColor: "#fff", padding: "9px 12px" },
  recordMain: { minWidth: 0 }, recordEyebrow: { display: "block", color: "#6b7280", fontSize: "10px", fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.06em" }, recordTitle: { display: "block", marginTop: "2px", fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, recordItem: { display: "flex", flexDirection: "column", gap: "1px", fontSize: "12px" }, recordActions: { display: "flex", gap: "8px", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" },
  feedbackOk: { border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4", color: "#166534", padding: "8px 10px", fontSize: "13px", fontWeight: 750 }, feedbackError: { border: "1px solid #fecaca", backgroundColor: "#fef2f2", color: "#991b1b", padding: "8px 10px", fontSize: "13px", fontWeight: 750 },
  tabs: { display: "flex", gap: "2px", borderBottom: "1px solid #d1d5db", marginTop: "2px" }, tab: { border: 0, borderBottom: "2px solid transparent", backgroundColor: "transparent", padding: "9px 12px", color: "#4b5563", fontSize: "13px", fontWeight: 750, cursor: "pointer" }, tabActive: { border: 0, borderBottom: "2px solid #facc15", backgroundColor: "#fff", padding: "9px 12px", color: "#111827", fontSize: "13px", fontWeight: 850, cursor: "pointer" },
  section: { border: "1px solid #e5e7eb", backgroundColor: "#fff" }, sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", borderBottom: "1px solid #e5e7eb", padding: "10px 12px", backgroundColor: "#f9fafb" }, sectionTitle: { margin: 0, fontSize: "15px", fontWeight: 850, color: "#111827" }, sectionSubtitle: { margin: 0, color: "#6b7280", fontSize: "12px", fontWeight: 600 },
  overviewLayout: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 310px", gap: "10px" }, sidePanel: { border: "1px solid #e5e7eb", backgroundColor: "#fff", padding: "10px 12px" }, sideTitle: { margin: "0 0 8px", fontSize: "14px", fontWeight: 850 }, definitionTable: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", padding: "0 12px 12px" }, definitionRow: { display: "grid", gridTemplateColumns: "130px minmax(0, 1fr)", gap: "10px", borderBottom: "1px solid #f3f4f6", minHeight: "34px", alignItems: "center", fontSize: "13px" }, statsList: { borderTop: "1px solid #e5e7eb" }, statRow: { display: "flex", justifyContent: "space-between", gap: "12px", borderBottom: "1px solid #f3f4f6", padding: "7px 0", fontSize: "13px" }, alertBlock: { marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "10px" }, alertTitle: { margin: "0 0 6px", fontSize: "13px", fontWeight: 850 }, alertList: { margin: 0, paddingLeft: "18px", color: "#92400e", fontSize: "12px", lineHeight: 1.7, fontWeight: 700 }, emptyAlert: { color: "#166534", fontSize: "12px", fontWeight: 750 },
  actionBar: { display: "flex", gap: "6px", flexWrap: "wrap", padding: "10px 12px", borderBottom: "1px solid #f3f4f6" }, inlineForm: { margin: "10px 12px", border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", padding: "10px" }, inlineTitle: { margin: "0 0 8px", fontSize: "13px", fontWeight: 850 }, inlineGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "8px", alignItems: "start" },
  input: { height: "32px", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: "5px", fontSize: "13px", backgroundColor: "#fff" }, textarea: { minHeight: "64px", padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: "5px", fontSize: "13px", backgroundColor: "#fff", resize: "vertical" }, fieldLabel: { display: "flex", flexDirection: "column", gap: "4px", color: "#4b5563", fontSize: "12px", fontWeight: 750 },
  masterDetail: { display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", gap: "10px", padding: "12px" }, masterList: { border: "1px solid #e5e7eb", backgroundColor: "#f9fafb" }, listTitle: { margin: 0, padding: "8px 10px", borderBottom: "1px solid #e5e7eb", fontSize: "13px", fontWeight: 850, backgroundColor: "#fff" }, masterRow: { width: "100%", display: "flex", justifyContent: "space-between", gap: "8px", textAlign: "left", border: 0, borderBottom: "1px solid #e5e7eb", backgroundColor: "#fff", padding: "8px 10px", fontSize: "13px", cursor: "pointer" }, masterRowActive: { width: "100%", display: "flex", justifyContent: "space-between", gap: "8px", textAlign: "left", border: 0, borderLeft: "3px solid #facc15", borderBottom: "1px solid #e5e7eb", backgroundColor: "#fffbea", padding: "8px 10px", fontSize: "13px", cursor: "pointer" }, tableTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "8px" },
  tableBox: { overflowX: "auto", borderTop: "1px solid #e5e7eb" }, table: { width: "100%", borderCollapse: "collapse", fontSize: "12.5px", backgroundColor: "#fff" }, th: { textAlign: "left", padding: "7px 8px", borderBottom: "1px solid #d1d5db", backgroundColor: "#f9fafb", color: "#374151", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }, td: { padding: "7px 8px", borderBottom: "1px solid #f3f4f6", color: "#111827", verticalAlign: "top", whiteSpace: "nowrap" },
  salarySummary: { display: "flex", flexDirection: "column", borderTop: "1px solid #e5e7eb", margin: "0 12px 10px" }, salaryLine: { display: "grid", gridTemplateColumns: "1fr 80px 90px 90px 90px 110px", gap: "10px", borderBottom: "1px solid #f3f4f6", padding: "7px 0", fontSize: "13px" }, ruleStack: { display: "flex", flexDirection: "column", gap: "12px", padding: "12px" }, subsectionTitle: { margin: "0 0 6px", paddingBottom: "5px", borderBottom: "1px solid #e5e7eb", fontSize: "14px", fontWeight: 850 }, formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: "8px", maxWidth: "880px", padding: "12px" }, empty: { padding: "10px", color: "#6b7280", backgroundColor: "#fff", fontSize: "13px", fontWeight: 700 }, helpText: { margin: "12px", color: "#4b5563", fontSize: "13px" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }, modal: { width: "min(840px, calc(100vw - 40px))", backgroundColor: "#fff", border: "1px solid #d1d5db", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }, modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", padding: "10px 12px" }, closeButton: { border: 0, backgroundColor: "transparent", fontSize: "22px", cursor: "pointer" }, modalActions: { gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "8px" },
};
