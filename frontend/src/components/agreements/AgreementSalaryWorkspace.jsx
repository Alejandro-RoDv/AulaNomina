import { lazy, Suspense, useMemo, useState } from "react";

const AgreementSalaryStructurePanel = lazy(() => import("./AgreementSalaryStructurePanel"));
const SalaryTableRevisionPanel = lazy(() => import("./SalaryTableRevisionPanel"));
const SalaryTableActivationPanel = lazy(() => import("./SalaryTableActivationPanel"));
const SalaryRegularizationPanel = lazy(() => import("./SalaryRegularizationPanel"));
const AgreementExtraPayPanel = lazy(() => import("./AgreementExtraPayPanel"));
const ContractExtraPaySimulationPanel = lazy(() => import("./ContractExtraPaySimulationPanel"));

const SECTIONS = [
  {
    id: "concepts",
    label: "Conceptos",
    title: "Conceptos salariales",
    description: "Configura conceptos salariales, extrasalariales, cotización, IRPF y CRA.",
    minimumTables: 1,
  },
  {
    id: "revision",
    label: "Revisión",
    title: "Revisión de tablas",
    description: "Duplica un ejercicio anterior y aplica incrementos sin perder el histórico.",
    minimumTables: 1,
  },
  {
    id: "activation",
    label: "Activación y contratos",
    title: "Activación y migración",
    description: "Activa una tabla y migra de forma controlada los contratos vinculados.",
    minimumTables: 1,
  },
  {
    id: "regularization",
    label: "Atrasos",
    title: "Regularizaciones retroactivas",
    description: "Compara dos tablas y prepara diferencias salariales de períodos anteriores.",
    minimumTables: 2,
  },
  {
    id: "extra-pays",
    label: "Pagas extra",
    title: "Configuración de pagas extraordinarias",
    description: "Define devengo, conceptos incluidos y reglas de prorrata por tabla salarial.",
    minimumTables: 1,
  },
  {
    id: "extra-pay-simulation",
    label: "Cálculo por contrato",
    title: "Simulación de pagas extraordinarias",
    description: "Calcula y genera una paga especial para un contrato concreto.",
    minimumTables: 1,
  },
];

export default function AgreementSalaryWorkspace({ agreement, onAgreementChanged }) {
  const [activeSection, setActiveSection] = useState("concepts");
  const tables = agreement?.salary_tables || [];
  const section = useMemo(
    () => SECTIONS.find((item) => item.id === activeSection) || SECTIONS[0],
    [activeSection]
  );

  const hasRequiredData = tables.length >= section.minimumTables;

  function refreshAgreement() {
    return onAgreementChanged?.({ agreementId: agreement.id });
  }

  return (
    <section style={styles.wrapper}>
      <nav style={styles.tabs} aria-label="Procesos de estructura salarial">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveSection(item.id)}
            style={activeSection === item.id ? styles.tabActive : styles.tab}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>{section.title}</h3>
          <p style={styles.description}>{section.description}</p>
        </div>
        <div style={styles.metric}>
          <span>Tablas disponibles</span>
          <strong>{tables.length}</strong>
        </div>
      </header>

      {!hasRequiredData && (
        <div style={styles.notice}>
          {section.minimumTables === 2
            ? "Este proceso necesita al menos dos tablas salariales para comparar ejercicios."
            : "Crea primero una tabla salarial desde Gestión del convenio."}
        </div>
      )}

      {hasRequiredData && (
        <Suspense fallback={<div style={styles.loading}>Cargando proceso salarial…</div>}>
          <div key={`${agreement.id}:${activeSection}`} style={styles.content}>
            {activeSection === "concepts" && <AgreementSalaryStructurePanel agreement={agreement} />}
            {activeSection === "revision" && <SalaryTableRevisionPanel agreement={agreement} onCompleted={refreshAgreement} />}
            {activeSection === "activation" && <SalaryTableActivationPanel agreement={agreement} onChanged={refreshAgreement} />}
            {activeSection === "regularization" && <SalaryRegularizationPanel agreement={agreement} onGenerated={refreshAgreement} />}
            {activeSection === "extra-pays" && <AgreementExtraPayPanel agreement={agreement} onChanged={refreshAgreement} />}
            {activeSection === "extra-pay-simulation" && <ContractExtraPaySimulationPanel agreement={agreement} />}
          </div>
        </Suspense>
      )}
    </section>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    padding: "6px",
  },
  tab: {
    minHeight: "34px",
    border: "1px solid transparent",
    backgroundColor: "transparent",
    color: "#4b5563",
    padding: "0 11px",
    fontSize: "12px",
    fontWeight: 750,
    cursor: "pointer",
  },
  tabActive: {
    minHeight: "34px",
    border: "1px solid #d1d5db",
    borderBottomColor: "#eab308",
    backgroundColor: "#fff",
    color: "#111827",
    padding: "0 11px",
    fontSize: "12px",
    fontWeight: 850,
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    border: "1px solid #e5e7eb",
    borderLeft: "3px solid #facc15",
    backgroundColor: "#fff",
    padding: "11px 13px",
  },
  title: {
    margin: 0,
    color: "#111827",
    fontSize: "15px",
    fontWeight: 850,
  },
  description: {
    margin: "3px 0 0",
    color: "#6b7280",
    fontSize: "12px",
  },
  metric: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    color: "#6b7280",
    fontSize: "11px",
  },
  notice: {
    border: "1px solid #fde68a",
    backgroundColor: "#fffbeb",
    color: "#92400e",
    padding: "12px",
    fontSize: "12px",
    fontWeight: 750,
  },
  loading: {
    border: "1px solid #e5e7eb",
    backgroundColor: "#f9fafb",
    color: "#4b5563",
    padding: "12px",
    fontSize: "12px",
    fontWeight: 750,
  },
  content: { display: "flex", flexDirection: "column", gap: "10px" },
};
