const HEADER_EVENT = "aulanomina-header-context";

function applyHeaderContext(detail) {
  if (!detail || typeof document === "undefined") return;
  const titleNode = document.querySelector("header h1");
  if (!titleNode) return;
  titleNode.textContent = detail.title || titleNode.textContent;
  const subtitleNode = titleNode.nextElementSibling;
  if (subtitleNode?.tagName === "P" && detail.subtitle) {
    subtitleNode.textContent = detail.subtitle;
  }
}

if (typeof window !== "undefined" && !window.__aulanominaHeaderContextBridge) {
  window.__aulanominaHeaderContextBridge = true;
  window.addEventListener(HEADER_EVENT, (event) => applyHeaderContext(event.detail));
}
