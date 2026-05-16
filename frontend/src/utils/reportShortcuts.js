export function openReportPreset({ category, reportId, companyId = "all", year = "", month = "" }) {
  const preset = {
    category,
    reportId,
    companyId,
    year,
    month,
  };

  window.sessionStorage.setItem("aulanomina:reportPreset", JSON.stringify(preset));
  window.location.hash = "reports";
  window.dispatchEvent(new Event("aulanomina-route-change"));
}
