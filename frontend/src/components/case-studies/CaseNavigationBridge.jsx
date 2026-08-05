import { useEffect } from "react";


function readNavigationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  if (!page) return null;
  return {
    page,
    actionCode: params.get("caseAction"),
    assignmentId: params.get("caseAssignmentId"),
    taskId: params.get("caseTaskId"),
    scenarioCode: params.get("scenario"),
    employeeName: params.get("employee"),
    employeeId: params.get("employeeId"),
    companyId: params.get("companyId"),
    period: params.get("period"),
    startDate: params.get("startDate"),
    relatedEntityType: params.get("entityType"),
    relatedEntityId: params.get("entityId"),
    incidentCategory: params.get("incidentCategory"),
  };
}


function persistContext(context) {
  if (!context) return;
  try {
    window.sessionStorage.setItem("aulanomina:active-case-context", JSON.stringify(context));
    if (context.employeeId) {
      window.sessionStorage.setItem("aulanomina:selectedEmployeeId", String(context.employeeId));
    }
    if (context.period) {
      window.sessionStorage.setItem("aulanomina:casePayrollPeriod", String(context.period));
    }
    if (context.incidentCategory) {
      window.sessionStorage.setItem("aulanomina:caseIncidentCategory", context.incidentCategory);
    }
  } catch {
    // La navegación principal debe continuar aunque el almacenamiento esté bloqueado.
  }
}


function publishNavigation(context) {
  if (!context?.page) return;
  persistContext(context);
  window.dispatchEvent(new CustomEvent("aulanomina-open-page", {
    detail: {
      page: context.page,
      caseContext: context,
    },
  }));
  window.dispatchEvent(new CustomEvent("aulanomina-case-context", { detail: context }));
}


export default function CaseNavigationBridge() {
  useEffect(() => {
    const initialContext = readNavigationFromUrl();
    const timer = window.setTimeout(() => publishNavigation(initialContext), 0);

    const handleStorage = (event) => {
      if (event.key !== "aulanomina:active-case-context" || !event.newValue) return;
      try {
        publishNavigation(JSON.parse(event.newValue));
      } catch {
        // Ignora contextos corruptos y conserva la navegación actual.
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return null;
}
