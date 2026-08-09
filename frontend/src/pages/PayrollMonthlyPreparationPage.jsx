import { useEffect } from "react";

import MonthlyPayrollPreparation from "../components/payrolls/MonthlyPayrollPreparationV2";
import "../components/payrolls/payrollPreparationFlow.css";

export default function PayrollMonthlyPreparationPage({ companies = [], workCenters = [], onPrepared }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("aulanomina-header-context", {
      detail: {
        eyebrow: "NÓMINA",
        title: "Preparación mensual",
        subtitle: "Edición previa de conceptos por trabajador antes de generar la nómina",
      },
    }));
    return () => window.dispatchEvent(new CustomEvent("aulanomina-header-context", { detail: null }));
  }, []);

  return (
    <div className="payroll-s42 payroll-s42--monthly">
      <section className="payroll-s42__workflow" aria-label="Flujo de preparación mensual">
        <div className="payroll-s42__workflow-step" data-step="1">Selecciona empresa, trabajador y periodo</div>
        <div className="payroll-s42__workflow-step" data-step="2">Edita directamente los conceptos de la nómina</div>
        <div className="payroll-s42__workflow-step" data-step="3">Guarda, previsualiza y genera cuando esté lista</div>
      </section>

      <MonthlyPayrollPreparation companies={companies} workCenters={workCenters} onPrepared={onPrepared} />
    </div>
  );
}
