let workspacePromise;

export function preloadCollectiveAgreementsWorkspace() {
  if (!workspacePromise) {
    workspacePromise = import("./CollectiveAgreementsWorkspacePage.jsx");
  }
  return workspacePromise;
}
