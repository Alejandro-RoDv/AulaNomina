import { useEffect } from "react";

import MonthlyPayrollPreparation from "../components/payrolls/MonthlyPayrollPreparation";
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
        <div className="payroll-s42__workflow-step" data-step="1">Selecciona empresa y trabajador</div>
        <div className="payroll-s42__workflow-step" data-step="2">Edita y guarda los conceptos del mes</div>
        <div className="payroll-s42__workflow-step" data-step="3">Previsualiza antes de generar</div>
      </section>

      <MonthlyPayrollPreparation companies={companies} workCenters={workCenters} onPrepared={onPrepared} />
    </div>
  );
}
