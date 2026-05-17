import EmployeeIrpfPanel from "./EmployeeIrpfPanel";

export default function TaxProfileCard({ employee, taxProfile, activeContract, onRefresh }) {
  return (
    <EmployeeIrpfPanel
      employee={employee}
      taxProfile={taxProfile}
      activeContract={activeContract}
      onRefresh={onRefresh}
    />
  );
}
