import MonthlyPayrollPreparation from "../components/payrolls/MonthlyPayrollPreparation";

export default function PayrollMonthlyPreparationPage({ companies = [], workCenters = [], onPrepared }) {
  return (
    <div className="payroll-s42 payroll-s42--monthly">
      <section className="payroll-s42__workflow" aria-label="Flujo de preparación mensual">
        <div className="payroll-s42__workflow-step" data-step="1">Selecciona empresa y centro</div>
        <div className="payroll-s42__workflow-step" data-step="2">Indica mes y año</div>
        <div className="payroll-s42__workflow-step" data-step="3">Genera y revisa las nóminas</div>
      </section>

      <MonthlyPayrollPreparation companies={companies} workCenters={workCenters} onPrepared={onPrepared} />
    </div>
  );
}
