import PayrollConceptBreakdown from "./PayrollConceptBreakdown";
import PayrollIncidentSegmentsPanel from "./PayrollIncidentSegmentsPanel";


export default function PayrollConceptBreakdownWithSegments({ payrollId }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <PayrollConceptBreakdown payrollId={payrollId} />
      <PayrollIncidentSegmentsPanel payrollId={payrollId} />
    </div>
  );
}
