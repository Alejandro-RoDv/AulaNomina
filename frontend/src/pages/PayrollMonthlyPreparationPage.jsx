import MonthlyPayrollPreparation from "../components/payrolls/MonthlyPayrollPreparation";

function openSocialSecuritySettlements() {
  if (window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  window.dispatchEvent(
    new CustomEvent("aulanomina-open-page", {
      detail: { page: "social-security-settlements" },
    })
  );
}

export default function PayrollMonthlyPreparationPage({ companies = [], workCenters = [], onPrepared }) {
  return (
    <div className="payroll-s42 payroll-s42--monthly">
      <section className="payroll-s42__workflow" aria-label="Flujo de preparación mensual">
        <div className="payroll-s42__workflow-step" data-step="1">Selecciona empresa y centro</div>
        <div className="payroll-s42__workflow-step" data-step="2">Indica mes y año</div>
        <div className="payroll-s42__workflow-step" data-step="3">Genera las nóminas activas</div>
      </section>

      <MonthlyPayrollPreparation companies={companies} workCenters={workCenters} onPrepared={onPrepared} />

      <section className="payroll-s42__next-step">
        <div className="payroll-s42__next-copy">
          <strong>Siguiente paso: Seguros Sociales</strong>
          <span>Cuando las nóminas estén preparadas, agrúpalas por CCC y genera la liquidación.</span>
        </div>
        <button type="button" onClick={openSocialSecuritySettlements} className="payroll-s42__primary">
          Abrir liquidaciones
        </button>
      </section>
    </div>
  );
}
