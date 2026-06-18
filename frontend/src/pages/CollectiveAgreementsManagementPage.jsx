import { useMemo, useState } from "react";

import AgreementClassificationTab from "../components/agreements/management/AgreementClassificationTab";
import { CreateAgreementModal, ManagementHeader, ManagementTabs } from "../components/agreements/management/AgreementManagementShell";
import AgreementOverviewTab from "../components/agreements/management/AgreementOverviewTab";
import AgreementRulesTab from "../components/agreements/management/AgreementRulesTab";
import AgreementSalaryTablesTab from "../components/agreements/management/AgreementSalaryTablesTab";
import AgreementSeniorityHistoryTab from "../components/agreements/management/AgreementSeniorityHistoryTab";
import { Section, styles } from "../components/agreements/management/ManagementUi";
import {
  cleanPayload,
  getAgreementStatus,
  initialAgreementForm,
  initialCategoryForm,
  initialGroupForm,
  initialLeaveRuleForm,
  initialSalaryRowForm,
  initialSalaryTableForm,
  initialVacationRuleForm,
  initialWorkTimeRuleForm,
} from "../components/agreements/management/managementConfig";
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

export default function CollectiveAgreementsManagementPage({
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
  const [operation, setOperation] = useState("");
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
  const waitingForAgreement = !selectedAgreement && (loading || submitting);

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
      setOperation(options.operation || "save");
      const result = await action();
      const targetAgreementId = options.agreementId || result?.agreement_id || result?.collective_agreement_id || result?.id || activeAgreement?.id;
      await onAgreementChanged?.({ agreementId: targetAgreementId, refreshList: Boolean(options.refreshList) });
      options.reset?.();
      if (successMessage) setMessage(successMessage);
      return result;
    } catch (err) {
      setError(err.message || "Error en la operación");
      return null;
    } finally {
      setSubmitting(false);
      setOperation("");
    }
  }

  const handleSeedDemo = () => submitAction(seedDemoCollectiveAgreement, "", { refreshList: true, operation: "seed-demo" });

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
    if (!salaryRowForm.salary_table_id) {
      setError("Selecciona una tabla salarial antes de guardar la fila.");
      return;
    }
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

  function deleteItem(action, label) {
    if (!window.confirm(`¿Eliminar ${label}?`)) return;
    submitAction(action, `${label} eliminado`, { agreementId: activeAgreement?.id });
  }

  return (
    <div style={styles.wrapper}>
      <ManagementHeader
        agreements={collectiveAgreements}
        selectedAgreement={selectedAgreement}
        selectedAgreementId={selectedAgreementId}
        onSelectedAgreementIdChange={onSelectedAgreementIdChange}
        status={selectedStatus}
        submitting={submitting}
        seedDemoLoading={operation === "seed-demo"}
        onSeedDemo={handleSeedDemo}
        onOpenCreate={() => setAgreementModalOpen(true)}
        onDuplicate={() => setMessage("Acción preparada para MVP posterior: duplicar convenio.")}
        onActivate={() => handleUpdateStatus("active")}
        onArchive={() => handleUpdateStatus("archived")}
      />

      {error && <div style={styles.feedbackError} role="alert">{error}</div>}
      {message && <div style={localStyles.statusLine} role="status"><span style={localStyles.statusDot} />{message}</div>}
      <ManagementTabs activeTab={activeTab} onActiveTabChange={onActiveTabChange} />

      {waitingForAgreement && <ManagementLoadingState />}

      {!selectedAgreement && !waitingForAgreement && (
        <Section title="Sin convenios disponibles" subtitle="Crea un convenio o carga los datos de demostración para empezar.">
          <div style={localStyles.emptyActions}>
            <button type="button" onClick={handleSeedDemo} disabled={submitting} style={styles.secondaryButton}>Cargar demo</button>
            <button type="button" onClick={() => setAgreementModalOpen(true)} disabled={submitting} style={styles.primaryButton}>Nuevo convenio</button>
          </div>
        </Section>
      )}

      {selectedAgreement && activeTab === "overview" && (
        <AgreementOverviewTab agreement={selectedAgreement} status={selectedStatus} groups={groups} categories={categories} salaryTables={salaryTables} salaryRows={salaryRows} workTimeRules={workTimeRules} vacationRules={vacationRules} leaveRules={leaveRules} complements={complements} alerts={alerts} />
      )}

      {selectedAgreement && activeTab === "classification" && (
        <AgreementClassificationTab
          groups={groups}
          categories={categories}
          selectedGroup={selectedGroup}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          filteredCategories={filteredCategories}
          groupForm={groupForm}
          setGroupForm={setGroupForm}
          categoryForm={categoryForm}
          setCategoryForm={setCategoryForm}
          openPanel={openPanel}
          setOpenPanel={setOpenPanel}
          submitting={submitting}
          onSaveGroup={handleSaveGroup}
          onSaveCategory={handleSaveCategory}
          onDeleteGroup={(group) => deleteItem(() => deleteProfessionalGroup(group.id), "grupo")}
          onDeleteCategory={(category) => deleteItem(() => deleteProfessionalCategory(category.id), "categoría")}
          initialGroupForm={initialGroupForm}
          initialCategoryForm={initialCategoryForm}
        />
      )}

      {selectedAgreement && activeTab === "salary" && (
        <AgreementSalaryTablesTab
          salaryTables={salaryTables}
          salaryRows={salaryRows}
          categories={categories}
          groups={groups}
          salaryTableForm={salaryTableForm}
          setSalaryTableForm={setSalaryTableForm}
          salaryRowForm={salaryRowForm}
          setSalaryRowForm={setSalaryRowForm}
          openPanel={openPanel}
          setOpenPanel={setOpenPanel}
          submitting={submitting}
          onSaveSalaryTable={handleSaveSalaryTable}
          onSaveSalaryRow={handleSaveSalaryRow}
          onDeleteSalaryTable={(table) => deleteItem(() => deleteSalaryTable(table.id), "tabla salarial")}
          onDeleteSalaryRow={(row) => deleteItem(() => deleteSalaryTableRow(row.id), "fila salarial")}
          initialSalaryTableForm={initialSalaryTableForm}
          initialSalaryRowForm={initialSalaryRowForm}
        />
      )}

      {selectedAgreement && activeTab === "rules" && (
        <AgreementRulesTab
          workTimeRules={workTimeRules}
          vacationRules={vacationRules}
          leaveRules={leaveRules}
          workTimeRuleForm={workTimeRuleForm}
          setWorkTimeRuleForm={setWorkTimeRuleForm}
          vacationRuleForm={vacationRuleForm}
          setVacationRuleForm={setVacationRuleForm}
          leaveRuleForm={leaveRuleForm}
          setLeaveRuleForm={setLeaveRuleForm}
          openPanel={openPanel}
          setOpenPanel={setOpenPanel}
          submitting={submitting}
          onSaveWorkTimeRule={handleSaveWorkTimeRule}
          onSaveVacationRule={handleSaveVacationRule}
          onSaveLeaveRule={handleSaveLeaveRule}
          onDeleteWorkTimeRule={(rule) => deleteItem(() => deleteWorkTimeRule(rule.id), "regla de jornada")}
          onDeleteVacationRule={(rule) => deleteItem(() => deleteVacationRule(rule.id), "regla de vacaciones")}
          onDeleteLeaveRule={(rule) => deleteItem(() => deleteLeaveRule(rule.id), "permiso")}
          initialWorkTimeRuleForm={initialWorkTimeRuleForm}
          initialVacationRuleForm={initialVacationRuleForm}
          initialLeaveRuleForm={initialLeaveRuleForm}
        />
      )}

      {selectedAgreement && activeTab === "seniority" && (
        <AgreementSeniorityHistoryTab
          salaryRows={salaryRows}
          groups={groups}
          onEditSalaryRow={(row) => { onActiveTabChange?.("salary"); setSalaryRowForm({ ...initialSalaryRowForm, ...row, salary_table_id: row.table_id }); setOpenPanel("salary-row"); }}
          onDeleteSalaryRow={(row) => deleteItem(() => deleteSalaryTableRow(row.id), "fila salarial")}
        />
      )}

      {agreementModalOpen && <CreateAgreementModal form={agreementForm} setForm={setAgreementForm} submitting={submitting} onSubmit={handleCreateAgreement} onClose={() => setAgreementModalOpen(false)} />}
    </div>
  );
}

function ManagementLoadingState() {
  return (
    <section style={localStyles.loadingPanel} aria-label="Preparando convenio">
      <div style={localStyles.loadingHeader}>
        <div style={{ ...localStyles.loadingLine, width: "210px", height: "16px" }} />
        <div style={{ ...localStyles.loadingLine, width: "120px", height: "30px" }} />
      </div>
      <div style={localStyles.loadingGrid}>
        {["72%", "58%", "66%", "52%", "76%", "61%", "69%", "55%"].map((width, index) => (
          <div key={index} style={localStyles.loadingCell}>
            <div style={{ ...localStyles.loadingLine, width: "64px", height: "9px" }} />
            <div style={{ ...localStyles.loadingLine, width, height: "13px" }} />
          </div>
        ))}
      </div>
    </section>
  );
}

const localStyles = {
  statusLine: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    minHeight: "22px",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 750,
  },
  statusDot: {
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    backgroundColor: "#22c55e",
  },
  emptyActions: {
    display: "flex",
    gap: "8px",
    padding: "12px",
  },
  loadingPanel: {
    border: "1px solid #e5e7eb",
    backgroundColor: "#fff",
  },
  loadingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    padding: "12px",
  },
  loadingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0 20px",
    padding: "8px 12px 14px",
  },
  loadingCell: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    minHeight: "48px",
    justifyContent: "center",
    borderBottom: "1px solid #f3f4f6",
  },
  loadingLine: {
    borderRadius: "4px",
    backgroundColor: "#e7eaee",
  },
};
