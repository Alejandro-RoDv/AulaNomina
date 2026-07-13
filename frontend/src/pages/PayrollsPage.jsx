import { useEffect, useState } from "react";

import PageCard from "../components/layout/PageCard";
import PayrollForm from "../components/payrolls/PayrollForm";
import PayrollTable from "../components/payrolls/PayrollTable";
import MonthlyPayrollPreparation from "../components/payrolls/MonthlyPayrollPreparation";
import FuturePayrollSimulator from "../components/payrolls/FuturePayrollSimulator";
import IrpfModulePanel from "../components/payrolls/IrpfModulePanel";
import SocialSecuritySettlementsPage from "./SocialSecuritySettlementsPage";
import { fetchPayrolls } from "../services/payrollApi";

function getWorkspaceRoute() {
  if (window.location.hash === "#irpf-module") return "irpf";
  if (window.location.hash === "#social-security-files") return "social-security-files";
  if (window.location.hash === "#social-security-settlements") return "social-security-settlements";
  return "payrolls";
}

export default function PayrollsPage({
  loading,
  payrolls,
  employees,
  contracts,
  companies,
  workCenters,
  payrollForm,
  onPayrollChange,
  onPayrollSubmit,
  onUpdatePayroll,
  onDeletePayroll,
  payrollError,
  payrollSuccess,
  payrollSubmitting,
}) {
  const [localPayrolls, setLocalPayrolls] = useState(payrolls);
  const [refreshingPayrolls, setRefreshingPayrolls] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState("");
  const [workspaceRoute, setWorkspaceRoute] = useState(getWorkspaceRoute);

  useEffect(() => {
    setLocalPayrolls(payrolls);
  }, [payrolls]);

  useEffect(() => {
    const syncRoute = () => setWorkspaceRoute(getWorkspaceRoute());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("aulanomina-route-change", syncRoute);
    syncRoute();
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("aulanomina-route-change", syncRoute);
    };
  }, []);

  const refreshPayrollList = async (message = "Listado de nóminas actualizado") => {
    try {
      setRefreshingPayrolls(true);
      const data = await fetchPayrolls();
      setLocalPayrolls(data);
      setRefreshMessage(message);
    } catch {
      setRefreshMessage("No se pudo refrescar el listado automáticamente");
    } finally {
      setRefreshingPayrolls(false);
    }
  };

  if (workspaceRoute === "irpf") {
    return (
      <div style={styles.wrapper}>
        <PageCard
          title="IRPF"
          subtitle="Configuración fiscal, cálculo anual, previsión mensual, IRPF voluntario y variables futuras. Las nóminas reales alimentan esta tabla mensual."
        >
          <IrpfModulePanel
            employees={employees}
            contracts={contracts}
            companies={companies}
            workCenters={workCenters}
            onRefresh={refreshPayrollList}
          />
        </PageCard>
      </div>
    );
  }

  if (workspaceRoute === "social-security-settlements" || workspaceRoute === "social-security-files") {
    return (
      <SocialSecuritySettlementsPage
        companies={companies}
        initialSection={workspaceRoute === "social-security-files" ? "communications" : "settlements"}
      />
    );
  }

  return (
    <div style={styles.wrapper}>
      <PageCard title="Preparar nóminas mensuales" subtitle="Preparación masiva de nóminas por empresa, centro y periodo. El IRPF aplicado se toma de la ficha fiscal del trabajador.">
        <MonthlyPayrollPreparation companies={companies} workCenters={workCenters} onPrepared={refreshPayrollList} />
      </PageCard>

      <PageCard title="Simular próximos meses" subtitle="Proyección de bruto, Seguridad Social, IRPF y neto para escenarios de nómina.">
        <FuturePayrollSimulator employees={employees} contracts={contracts} />
      </PageCard>

      <details style={styles.details}>
        <summary style={styles.summary}>Crear nómina individual manual</summary>
        <PageCard title="Nueva nómina simulada" subtitle="Uso manual para pruebas puntuales fuera del proceso mensual.">
          <PayrollForm
            form={payrollForm}
            employees={employees}
            contracts={contracts}
            companies={companies}
            workCenters={workCenters}
            onChange={onPayrollChange}
            onSubmit={onPayrollSubmit}
            error={payrollError}
            success={payrollSuccess}
            submitting={payrollSubmitting}
          />
        </PageCard>
      </details>

      <PageCard title="Listado de nóminas" subtitle="Nóminas simuladas generadas en el sistema. Estas nóminas alimentan la tabla anual del módulo IRPF.">
        {refreshMessage && <div style={styles.notice}>{refreshMessage}</div>}
        <div style={styles.resultInfo}>
          {refreshingPayrolls ? "Actualizando listado..." : `Mostrando ${localPayrolls.length} nóminas`}
        </div>
        <PayrollTable
          loading={loading || refreshingPayrolls}
          payrolls={localPayrolls}
          contracts={contracts}
          employees={employees}
          onUpdatePayroll={onUpdatePayroll}
          onDeletePayroll={onDeletePayroll}
          onPayrollsChanged={() => refreshPayrollList("Regularización aplicada y listado actualizado")}
          submitting={payrollSubmitting}
        />
      </PageCard>
    </div>
  );
}

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "20px" },
  details: { display: "flex", flexDirection: "column", gap: "12px" },
  summary: { cursor: "pointer", fontWeight: 900, color: "#111827", padding: "10px 0" },
  resultInfo: { marginBottom: "16px", color: "#6b7280", fontSize: "13px", fontWeight: 700 },
  notice: { marginBottom: "12px", backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px", fontWeight: 800 },
};
