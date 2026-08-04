export const MODEL190_DEMO_STAGES = {
  not_prepared: {
    label: "Caso no preparado",
    description: "Crea un escenario anual independiente con errores deliberados.",
    tone: "neutral",
  },
  needs_correction: {
    label: "Diagnóstico pendiente",
    description: "Existe una subclave errónea y una diferencia deliberada en el 2T.",
    tone: "warning",
  },
  ready_to_generate: {
    label: "Listo para generar",
    description: "Las validaciones y la conciliación anual están resueltas.",
    tone: "success",
  },
  generated: {
    label: "Declaración congelada",
    description: "El fichero está preparado para importarse en la AEAT simulada.",
    tone: "success",
  },
  presented: {
    label: "Caso completado",
    description: "La declaración está presentada y sus documentos están disponibles.",
    tone: "success",
  },
};

export function model190DemoStageMeta(status) {
  return MODEL190_DEMO_STAGES[status?.stage] || MODEL190_DEMO_STAGES.not_prepared;
}

export function model190DemoCanPrepare(status) {
  return !status?.prepared && !status?.declaration;
}

export function model190DemoCanCorrect(status) {
  return status?.stage === "needs_correction";
}

export function model190DemoCompletion(status) {
  const checks = status?.checks || [];
  return {
    completed: checks.filter((item) => item.completed).length,
    total: checks.length,
  };
}
