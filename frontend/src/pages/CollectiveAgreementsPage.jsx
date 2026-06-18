import { lazy, Suspense } from "react";

let workspacePromise;

export function preloadCollectiveAgreementsWorkspace() {
  if (!workspacePromise) {
    workspacePromise = import("./CollectiveAgreementsWorkspacePage.jsx");
  }
  return workspacePromise;
}

const CollectiveAgreementsWorkspacePage = lazy(preloadCollectiveAgreementsWorkspace);

export default function CollectiveAgreementsPage(props) {
  return (
    <Suspense fallback={<CollectiveAgreementsSkeleton />}>
      <CollectiveAgreementsWorkspacePage {...props} />
    </Suspense>
  );
}

function CollectiveAgreementsSkeleton() {
  return (
    <div style={styles.skeleton} aria-label="Preparando módulo Convenios">
      <div style={styles.tabs}>
        <div style={{ ...styles.tab, width: "170px" }} />
        <div style={{ ...styles.tab, width: "150px" }} />
        <div style={{ ...styles.tab, width: "140px" }} />
      </div>

      <section style={styles.headerCard}>
        <div style={styles.headerCopy}>
          <div style={{ ...styles.line, width: "230px", height: "20px" }} />
          <div style={{ ...styles.line, width: "390px" }} />
        </div>
        <div style={{ ...styles.line, width: "320px", height: "34px" }} />
      </section>

      <section style={styles.summaryCard}>
        {["22%", "18%", "20%", "16%"].map((width, index) => (
          <div key={index} style={styles.summaryItem}>
            <div style={{ ...styles.line, width: "68px", height: "9px" }} />
            <div style={{ ...styles.line, width, minWidth: "110px", height: "14px" }} />
          </div>
        ))}
      </section>

      <section style={styles.contentCard}>
        <div style={styles.contentHeader}>
          <div style={{ ...styles.line, width: "190px", height: "16px" }} />
          <div style={{ ...styles.line, width: "120px", height: "32px" }} />
        </div>
        {[1, 2, 3, 4].map((row) => (
          <div key={row} style={styles.tableRow}>
            <div style={{ ...styles.line, width: "28%" }} />
            <div style={{ ...styles.line, width: "18%" }} />
            <div style={{ ...styles.line, width: "22%" }} />
            <div style={{ ...styles.line, width: "14%" }} />
          </div>
        ))}
      </section>

      <span style={styles.srOnly}>Preparando Convenios…</span>
    </div>
  );
}

const styles = {
  skeleton: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minHeight: "430px",
  },
  tabs: {
    display: "flex",
    gap: "8px",
    borderBottom: "1px solid #d1d5db",
    backgroundColor: "#fff",
    padding: "8px 10px 0",
  },
  tab: {
    height: "34px",
    backgroundColor: "#eef0f2",
    borderBottom: "3px solid #d7dbe0",
  },
  headerCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "24px",
    border: "1px solid #e5e7eb",
    backgroundColor: "#fff",
    padding: "16px",
  },
  headerCopy: {
    display: "flex",
    flexDirection: "column",
    gap: "9px",
  },
  summaryCard: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "14px",
    border: "1px solid #e5e7eb",
    borderLeft: "3px solid #facc15",
    backgroundColor: "#fff",
    padding: "13px",
  },
  summaryItem: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  contentCard: {
    border: "1px solid #e5e7eb",
    backgroundColor: "#fff",
  },
  contentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    borderBottom: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    padding: "13px",
  },
  tableRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    borderBottom: "1px solid #f1f3f5",
    padding: "14px",
  },
  line: {
    height: "12px",
    borderRadius: "4px",
    backgroundColor: "#e7eaee",
  },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
};
