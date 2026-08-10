import IrpfModulePanel from "../components/payrolls/IrpfModulePanel";
import "./irpfPage.css";

export default function IrpfPage({ employees, contracts, companies, workCenters, onRefresh }) {
  return (
    <div className="irpf-page-shell">
      <IrpfModulePanel
        employees={employees}
        contracts={contracts}
        companies={companies}
        workCenters={workCenters}
        onRefresh={onRefresh}
      />
    </div>
  );
}
