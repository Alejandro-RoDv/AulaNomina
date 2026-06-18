import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";

import AgreementCriteriaWorkspace from "../components/agreements/AgreementCriteriaWorkspace";
import AgreementSalaryWorkspace from "../components/agreements/AgreementSalaryWorkspace";
import AgreementSeniorityPanel from "../components/agreements/AgreementSeniorityPanel";
import {
  cleanPayload,
  formatDate,
  getAgreementStatus,
  money,
} from "../components/agreements/management/managementConfig";
import CollectiveAgreementsManagementPage from "../pages/CollectiveAgreementsManagementPage.jsx";

const agreement = {
  id: 1,
  name: "Convenio de prueba",
  agreement_code: "TEST-2026",
  sector: "Educación",
  territorial_scope: "Córdoba",
  effective_from: "2026-01-01",
  effective_to: "2026-12-31",
  status: "active",
  notes: "Convenio usado para las pruebas SSR.",
  professional_groups: [
    { id: 10, code: "G1", name: "Grupo profesional 1", description: "Grupo de prueba" },
  ],
  professional_categories: [
    { id: 20, professional_group_id: 10, code: "C1", name: "Categoría profesional 1", level: "Nivel 1" },
  ],
  salary_tables: [
    {
      id: 30,
      name: "Tabla salarial 2026",
      year: 2026,
      number_of_payments: 14,
      amount_type: "monthly",
      status: "active",
      rows: [
        {
          id: 40,
          professional_category_id: 20,
          professional_group_id: 10,
          category_name: "Categoría profesional 1",
          group_name: "Grupo profesional 1",
          base_salary: 1500,
          agreement_plus: 125,
          seniority_amount: 45,
          total_amount: 1670,
        },
      ],
    },
  ],
  complements: [{ id: 50, name: "Plus convenio" }],
  work_time_rules: [
    { id: 60, name: "Jornada ordinaria", annual_hours: 1760, weekly_hours: 40, distribution_type: "regular" },
  ],
  vacation_rules: [
    { id: 70, name: "Vacaciones anuales", natural_days: 30, working_days: 22, accrual_period: "Año natural" },
  ],
  leave_rules: [
    { id: 80, name: "Permiso retribuido", leave_type: "paid", duration: 2, duration_unit: "working_days", cause: "Causa de prueba" },
  ],
};

function renderManagement(activeTab) {
  return renderToString(
    <CollectiveAgreementsManagementPage
      loading={false}
      collectiveAgreements={[agreement]}
      selectedAgreement={agreement}
      selectedAgreementId={agreement.id}
      onSelectedAgreementIdChange={() => {}}
      activeTab={activeTab}
      onActiveTabChange={() => {}}
      onAgreementChanged={async () => agreement}
    />
  );
}

function assertIncludes(markup, text, context) {
  assert.ok(markup.includes(text), `${context}: no aparece “${text}”`);
}

function assertNotIncludes(markup, text, context) {
  assert.ok(!markup.includes(text), `${context}: aparece el texto no permitido “${text}”`);
}

export async function runConveniosSmokeTests() {
  const overview = renderManagement("overview");
  assertIncludes(overview, "Ficha administrativa", "Resumen");
  assertIncludes(overview, "Convenio de prueba", "Resumen");
  assertIncludes(overview, "Control del convenio", "Resumen");

  const classification = renderManagement("classification");
  assertIncludes(classification, "Clasificación profesional", "Clasificación");
  assertIncludes(classification, "Grupo profesional 1", "Clasificación");
  assertIncludes(classification, "Categoría profesional 1", "Clasificación");

  const salary = renderManagement("salary");
  assertIncludes(salary, "Tablas salariales", "Tablas salariales");
  assertIncludes(salary, "Tabla salarial 2026", "Tablas salariales");
  assertIncludes(salary, "1500,00", "Tablas salariales");

  const rules = renderManagement("rules");
  assertIncludes(rules, "Jornada, vacaciones y permisos", "Jornada y permisos");
  assertIncludes(rules, "Jornada ordinaria", "Jornada y permisos");
  assertIncludes(rules, "Vacaciones anuales", "Jornada y permisos");
  assertIncludes(rules, "Permiso retribuido", "Jornada y permisos");

  const seniority = renderManagement("seniority");
  assertIncludes(seniority, "Importe antigüedad", "Antigüedad histórica");
  assertIncludes(seniority, "45,00", "Antigüedad histórica");

  const loadingManagement = renderToString(
    <CollectiveAgreementsManagementPage
      loading
      collectiveAgreements={[agreement]}
      selectedAgreement={null}
      selectedAgreementId={agreement.id}
      onSelectedAgreementIdChange={() => {}}
      activeTab="overview"
      onActiveTabChange={() => {}}
      onAgreementChanged={async () => agreement}
    />
  );
  assertIncludes(loadingManagement, "Preparando convenio", "Carga interna de Gestión");
  assertNotIncludes(loadingManagement, "Cargando datos...", "Carga interna de Gestión");
  assertNotIncludes(loadingManagement, "Sin convenio seleccionado", "Carga interna de Gestión");
  assertNotIncludes(loadingManagement, "Convenio demo cargado correctamente", "Carga interna de Gestión");

  const salaryWorkspace = renderToString(
    <AgreementSalaryWorkspace
      agreement={{ ...agreement, salary_tables: [] }}
      onAgreementChanged={async () => agreement}
    />
  );
  assertIncludes(salaryWorkspace, "Conceptos", "Workspace salarial");
  assertIncludes(salaryWorkspace, "Revisión", "Workspace salarial");
  assertIncludes(salaryWorkspace, "Activación y contratos", "Workspace salarial");
  assertIncludes(salaryWorkspace, "Atrasos", "Workspace salarial");
  assertIncludes(salaryWorkspace, "Pagas extra", "Workspace salarial");
  assertIncludes(salaryWorkspace, "Cálculo por contrato", "Workspace salarial");
  assertIncludes(salaryWorkspace, "Crea primero una tabla salarial", "Workspace salarial");

  const criteriaWorkspace = renderToString(
    <AgreementCriteriaWorkspace
      agreement={agreement}
      onAgreementChanged={async () => agreement}
      onOpenManagementTab={() => {}}
    />
  );
  assertIncludes(criteriaWorkspace, "Criterios generales", "Workspace de criterios");
  assertIncludes(criteriaWorkspace, "Antigüedad y vencimientos", "Workspace de criterios");
  assertIncludes(criteriaWorkspace, "Cargando apartado laboral", "Workspace de criterios");

  const seniorityPanel = renderToString(
    <AgreementSeniorityPanel agreement={agreement} onChanged={async () => agreement} />
  );
  assertIncludes(seniorityPanel, "Calcular vencimientos", "Antigüedad bajo petición");
  assertIncludes(seniorityPanel, "Selecciona una fecha", "Antigüedad bajo petición");

  assert.equal(formatDate("2026-06-16"), "16/06/2026");
  assert.equal(money(1500), "1500,00 €");
  assert.equal(getAgreementStatus(agreement).label, "Activo");
  assert.deepEqual(
    cleanPayload({ id: 1, name: "Prueba", notes: "", table_id: 3 }),
    { name: "Prueba", notes: null }
  );
}
