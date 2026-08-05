import { useEffect } from "react";


function readNavigationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  if (!page) return null;
  return {
    page,
    assignmentId: params.get("caseAssignmentId"),
    taskId: params.get("caseTaskId"),
    scenarioCode: params.get("scenario"),
    employeeName: params.get("employee"),
  };
}


function publishNavigation(context) {
  if (!context?.page) return;
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
