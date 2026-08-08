import FuturePayrollSimulator from "../components/payrolls/FuturePayrollSimulator";

export default function PayrollSimulationPage({ employees = [], contracts = [] }) {
  return (
    <div className="payroll-s42 payroll-s42--simulation">
      <section className="payroll-s42__info-grid">
        <div className="payroll-s42__info-item">
          <strong>Uso recomendado</strong>
          <span>Prueba cambios salariales, variables futuras o escenarios antes de generar nóminas.</span>
        </div>
        <div className="payroll-s42__info-item">
          <strong>No genera histórico</strong>
          <span>Los resultados son previsiones didácticas y no crean nóminas guardadas.</span>
        </div>
      </section>

      <FuturePayrollSimulator employees={employees} contracts={contracts} />
    </div>
  );
}
