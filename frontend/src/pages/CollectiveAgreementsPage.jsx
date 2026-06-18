import { lazy, Suspense } from "react";

const CollectiveAgreementsWorkspacePage = lazy(() => import("./CollectiveAgreementsWorkspacePage.jsx"));

export default function CollectiveAgreementsPage(props) {
  return (
    <Suspense fallback={<div style={styles.loading}>Cargando módulo Convenios…</div>}>
      <CollectiveAgreementsWorkspacePage {...props} />
    </Suspense>
  );
}

const styles = {
  loading: {
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    color: "#4b5563",
    padding: "16px",
    fontSize: "13px",
    fontWeight: 750,
  },
};
