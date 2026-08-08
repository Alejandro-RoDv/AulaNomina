import PayrollForm from "../components/payrolls/PayrollForm";

export default function PayrollIndividualPage({
  payrollForm,
  employees = [],
  contracts = [],
  companies = [],
  workCenters = [],
  onPayrollChange,
  onPayrollSubmit,
  payrollError,
  payrollSuccess,
  payrollSubmitting,
}) {
  return (
    <div className="payroll-s42 payroll-s42--individual">
      <div className="payroll-s42__notice">
        Usa esta pantalla para altas o correcciones puntuales. El desglose completo se revisa después desde el histórico de nóminas.
      </div>

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
    </div>
  );
}
