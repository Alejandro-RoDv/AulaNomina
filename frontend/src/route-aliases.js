const HASH_ALIASES = new Map([
  ["#company-companies", "#company-new"],
]);

function normalizeRouteAlias() {
  const canonicalHash = HASH_ALIASES.get(window.location.hash);
  if (!canonicalHash) return;

  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${canonicalHash}`,
  );
  window.dispatchEvent(new Event("aulanomina-route-change"));
}

normalizeRouteAlias();
window.addEventListener("hashchange", normalizeRouteAlias);
