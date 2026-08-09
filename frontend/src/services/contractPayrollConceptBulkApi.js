import {
  createContractPayrollConcept,
  fetchContractPayrollConcepts,
  updateContractPayrollConcept,
} from "./payrollApi";

function normalizeContractIds(contractIds) {
  return Array.from(new Set((contractIds || []).map(Number).filter(Number.isFinite)));
}

export async function assignPermanentConceptToContracts(contractIds, payload) {
  const ids = normalizeContractIds(contractIds);
  const settled = await Promise.allSettled(ids.map(async (contractId) => {
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
      const updated = await updateContractPayrollConcept(inactive.id, {
        ...payload,
        is_active: true,
      });
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
  }));

  const items = settled.map((result, index) => {
    const contractId = ids[index];
    if (result.status === "fulfilled") return result.value;
    return {
      contract_id: contractId,
      status: "error",
      line_id: null,
      message: result.reason?.message || "No se pudo aplicar el concepto.",
    };
  });

  return {
    requested_count: ids.length,
    created_count: items.filter((item) => item.status === "created").length,
    reactivated_count: items.filter((item) => item.status === "reactivated").length,
    skipped_count: items.filter((item) => item.status === "skipped").length,
    error_count: items.filter((item) => item.status === "error").length,
    items,
  };
}
