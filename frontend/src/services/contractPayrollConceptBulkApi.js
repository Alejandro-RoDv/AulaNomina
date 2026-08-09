import {
  createContractPayrollConcept,
  fetchContractPayrollConcepts,
  updateContractPayrollConcept,
} from "./payrollApi";

const BULK_CONCURRENCY = 8;

function normalizeContractIds(contractIds) {
  return Array.from(new Set((contractIds || []).map(Number).filter(Number.isFinite)));
}

async function assignToContract(contractId, payload) {
  const existingItems = await fetchContractPayrollConcepts(contractId, true);
  const matches = (existingItems || []).filter(
    (item) => Number(item.concept_id) === Number(payload.concept_id)
  );
  const active = matches.find((item) => item.is_active);
  if (active) {
    return {
      contract_id: contractId,
      status: "skipped",
      line_id: active.id,
      message: "El contrato ya tiene este concepto activo.",
    };
  }

  const inactive = matches.find((item) => !item.is_active);
  if (inactive) {
    const updatePayload = { ...payload, is_active: true };
    if (updatePayload.amount === null || updatePayload.amount === undefined) delete updatePayload.amount;
    const updated = await updateContractPayrollConcept(inactive.id, updatePayload);
    return {
      contract_id: contractId,
      status: "reactivated",
      line_id: updated?.id || inactive.id,
      message: "Concepto reactivado y actualizado.",
    };
  }

  const created = await createContractPayrollConcept(contractId, payload);
  return {
    contract_id: contractId,
    status: "created",
    line_id: created?.id || null,
    message: "Concepto añadido.",
  };
}

export async function assignPermanentConceptToContracts(contractIds, payload) {
  const ids = normalizeContractIds(contractIds);
  const items = [];

  for (let index = 0; index < ids.length; index += BULK_CONCURRENCY) {
    const batch = ids.slice(index, index + BULK_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((contractId) => assignToContract(contractId, payload)));
    settled.forEach((result, batchIndex) => {
      const contractId = batch[batchIndex];
      if (result.status === "fulfilled") {
        items.push(result.value);
      } else {
        items.push({
          contract_id: contractId,
          status: "error",
          line_id: null,
          message: result.reason?.message || "No se pudo aplicar el concepto.",
        });
      }
    });
  }

  return {
    requested_count: ids.length,
    created_count: items.filter((item) => item.status === "created").length,
    reactivated_count: items.filter((item) => item.status === "reactivated").length,
    skipped_count: items.filter((item) => item.status === "skipped").length,
    error_count: items.filter((item) => item.status === "error").length,
    items,
  };
}
