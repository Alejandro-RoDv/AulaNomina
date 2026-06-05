import { apiRequest } from "./httpClient";

export async function fetchContracts() {
  return apiRequest("/contracts", {}, "Error al cargar contratos");
}

export async function fetchCatalogs() {
  return apiRequest("/catalogs/all", {}, "Error al cargar catálogos laborales");
}

export async function fetchEmployees() {
  return apiRequest("/employees/all", {}, "Error al cargar trabajadores");
}

export async function resetDemo() {
  return apiRequest(
    "/demo/reset",
    { method: "POST" },
    "Error al reiniciar la demo"
  );
}

export async function fetchPayrollConcepts() {
  return apiRequest("/payroll-concepts", {}, "Error al cargar conceptos salariales");
}

export async function fetchContractSalarySummary(contractId) {
  return apiRequest(
    `/contracts/${contractId}/salary-summary`,
    {},
    "Error al cargar resumen retributivo del contrato"
  );
}

export async function simulateContractWorkday(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/simulate-workday`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al simular cambio de jornada"
  );
}

export async function createSocialSecurityRegistration(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/social-security-registration`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear alta SS simulada"
  );
}

export async function updateSocialSecurityRegistration(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/social-security-registration`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al actualizar alta SS simulada"
  );
}

async function upsertSocialSecurityRegistration(contractId, payload) {
  if (!payload || !contractId) return null;

  try {
    return await updateSocialSecurityRegistration(contractId, payload);
  } catch (error) {
    if (String(error.message || "").includes("no encontrada")) {
      return createSocialSecurityRegistration(contractId, payload);
    }
    throw error;
  }
}

function normalizeConceptCode(value) {
  return String(value || "PLUS")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase()
    .slice(0, 32) || "PLUS";
}

function normalizeConceptCategory(type) {
  if (type === "plus") return "PLUS";
  if (type === "improvement") return "COMPLEMENTO";
  return "COMPLEMENTO";
}

export async function createPayrollConcept(payload) {
  return apiRequest(
    "/payroll-concepts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al crear concepto salarial"
  );
}

export async function createContractPayrollConcept(contractId, payload) {
  return apiRequest(
    `/contracts/${contractId}/payroll-concepts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Error al asociar concepto permanente al contrato"
  );
}

export async function createContractSalaryLines(contractId, salaryLines = []) {
  if (!contractId || !salaryLines.length) return [];

  const createdLines = [];
  for (const [index, line] of salaryLines.entries()) {
    const amount = Number(line.amount || 0);
    if (!line.name || amount <= 0) continue;

    let concept = null;
    if (line.concept_id) {
      concept = { id: Number(line.concept_id), name: line.name };
    } else {
      concept = await createPayrollConcept({
        name: line.name,
        code: `CTO_${contractId}_${index + 1}_${normalizeConceptCode(line.name)}`,
        category: normalizeConceptCategory(line.type),
        concept_type: "DEVENGO",
        salary_nature: "SALARIAL",
        source_type: "CUSTOM",
        calculation_type: "FIXED_AMOUNT",
        default_amount: amount,
        default_unit_price: amount,
        applies_workday_percentage: line.applies_workday_percentage ?? true,
        is_system: false,
        is_taxable: true,
        is_contribution_base: true,
        is_active: true,
        display_order: 100 + index,
        notes: "Creado desde la estructura retributiva del contrato",
      });
    }

    const contractLine = await createContractPayrollConcept(contractId, {
      concept_id: concept.id,
      description: line.name,
      quantity: 1,
      unit_price: amount,
      amount,
      is_active: true,
      display_order: 100 + index,
      notes: `Tipo: ${line.type || "complement"}${line.source_type ? ` · Origen: ${line.source_type}` : ""}`,
    });

    createdLines.push(contractLine);
  }

  return createdLines;
}

export async function createContract(contractPayload, socialSecurityPayload = null, salaryLines = []) {
  const contract = await apiRequest(
    "/contracts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contractPayload),
    },
    "Error al crear contrato"
  );

  if (socialSecurityPayload && contract?.id) {
    await createSocialSecurityRegistration(contract.id, socialSecurityPayload);
  }

  if (contract?.id && salaryLines.length) {
    await createContractSalaryLines(contract.id, salaryLines);
  }

  return contract;
}

export async function updateContract(contractId, contractPayload, socialSecurityPayload = null) {
  const contract = await apiRequest(
    `/contracts/${contractId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(contractPayload),
    },
    "Error al actualizar contrato"
  );

  if (socialSecurityPayload) {
    await upsertSocialSecurityRegistration(contractId, socialSecurityPayload);
  }

  return contract;
}

export async function deleteContract(contractId) {
  return apiRequest(
    `/contracts/${contractId}`,
    { method: "DELETE" },
    "Error al eliminar contrato"
  );
}
