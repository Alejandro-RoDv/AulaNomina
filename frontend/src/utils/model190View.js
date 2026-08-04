export function recipientDisplayName(recipient) {
  return [recipient?.surname, recipient?.name].filter(Boolean).join(", ") || recipient?.name || "Sin nombre";
}

export function filterModel190Recipients(recipients, filters) {
  const search = String(filters.search || "").trim().toLocaleLowerCase("es-ES");
  const key = String(filters.key || "").trim().toUpperCase();
  const subkey = String(filters.subkey || "").trim().toUpperCase();
  const recipientType = String(filters.recipientType || "").trim();
  const accrualYear = String(filters.accrualYear || "").trim();

  return (recipients || []).filter((recipient) => {
    const haystack = [
      recipient.nif,
      recipient.name,
      recipient.surname,
      recipient.key,
      recipient.subkey,
      recipient.accrual_year,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLocaleLowerCase("es-ES");

    if (search && !haystack.includes(search)) return false;
    if (key && String(recipient.key || "").toUpperCase() !== key) return false;
    if (subkey && String(recipient.subkey || "").toUpperCase() !== subkey) return false;
    if (recipientType && recipient.recipient_type !== recipientType) return false;
    if (accrualYear && String(recipient.accrual_year || "") !== accrualYear) return false;
    return true;
  });
}

function addValidation(items, level, code, message, context = {}) {
  items.push({ level, code, message, ...context });
}

export function buildModel190Validations(preview, reconciliation) {
  const items = [];
  const recipients = preview?.recipients || [];

  if (!preview?.has_operations) {
    addValidation(items, "warning", "NO_OPERATIONS", "No existen operaciones declarables para el ejercicio seleccionado.");
  }

  recipients.forEach((recipient) => {
    const label = `${recipient.nif || "Sin NIF"} · ${recipientDisplayName(recipient)}`;
    if (!String(recipient.nif || "").trim()) {
      addValidation(items, "error", "RECIPIENT_NIF_REQUIRED", `${label}: falta el NIF del perceptor.`, { recipientKey: recipient.recipient_key });
    }
    if (!String(recipient.key || "").trim()) {
      addValidation(items, "error", "RECIPIENT_KEY_REQUIRED", `${label}: falta la clave fiscal.`, { recipientKey: recipient.recipient_key });
    }
    if (recipient.key === "G" && !recipient.subkey) {
      addValidation(items, "error", "PROFESSIONAL_SUBKEY_REQUIRED", `${label}: la clave G requiere subclave.`, { recipientKey: recipient.recipient_key });
    }
    if (recipient.key === "A" && recipient.subkey) {
      addValidation(items, "warning", "WORK_SUBKEY_UNEXPECTED", `${label}: la clave A no debería llevar subclave en el catálogo educativo actual.`, { recipientKey: recipient.recipient_key });
    }
    if (!recipient.accrual_year) {
      addValidation(items, "error", "ACCRUAL_YEAR_REQUIRED", `${label}: falta el ejercicio de devengo.`, { recipientKey: recipient.recipient_key });
    }
    if (recipient.classification_source === "automatic" && !recipient.classification_confirmed) {
      addValidation(items, "information", "AUTOMATIC_CLASSIFICATION", `${label}: clasificación automática pendiente de revisión docente.`, { recipientKey: recipient.recipient_key });
    }
  });

  const capabilities = preview?.capabilities || {};
  if (capabilities.in_kind_income === false) {
    addValidation(items, "information", "IN_KIND_NOT_SUPPORTED", "Las percepciones en especie todavía no se separan de forma fiable.");
  }
  if (capabilities.reductions === false) {
    addValidation(items, "information", "REDUCTIONS_NOT_SUPPORTED", "Las reducciones fiscales todavía no están habilitadas en el motor anual.");
  }
  if (capabilities.exempt_income === false) {
    addValidation(items, "information", "EXEMPT_INCOME_NOT_SUPPORTED", "Las rentas exentas y dietas todavía no se acumulan en campos específicos.");
  }

  (reconciliation?.alerts || []).forEach((alert) => {
    addValidation(
      items,
      alert.level === "warning" ? "warning" : "information",
      alert.code || "RECONCILIATION_ALERT",
      alert.message,
      { quarter: alert.quarter, category: alert.category }
    );
  });

  const counts = items.reduce(
    (result, item) => ({ ...result, [item.level]: (result[item.level] || 0) + 1 }),
    { error: 0, warning: 0, information: 0 }
  );

  return {
    items,
    counts,
    isValid: counts.error === 0,
  };
}

export function reconciliationDifferenceTotal(reconciliation) {
  const annual = reconciliation?.annual?.differences || {};
  return Object.values(annual).reduce(
    (total, category) => total + Math.abs(Number(category?.income || 0)) + Math.abs(Number(category?.withholding || 0)),
    0
  );
}
