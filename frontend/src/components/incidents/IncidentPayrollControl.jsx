import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Play, RefreshCw } from "lucide-react";

import {
  fetchPayrollIncidentPreview,
  processPayrollIncidents,
  updatePayrollContributionBaseOverrides,
} from "../../services/incidentApi";
import { fetchPayrolls } from "../../services/payrollApi";
import { IncidentComponentAdjustments, IncidentSegmentTable } from "./IncidentCalculationDetails";
import IncidentContributionControl from "./IncidentContributionControl";
import {
  IncidentOverlapConflicts,
  IncidentPayrollError,
  IncidentPayrollMetrics,
} from "./IncidentPayrollFeedback";
import {
  EMPTY_OVERRIDES,
  payrollEmployee,
  payrollPeriod,
} from "./incidentPayrollUi";
import "./incidentPayrollControl.css";

function overridesFromPreview(data) {
  const values = data?.contribution_base_resolution?.overrides || {};
  return {
    common: values.common_contingencies_base ?? "",
    professional: values.professional_contingencies_base ?? "",
    unemployment: values.unemployment_training_fogasa_base ?? "",
  };
}

export default function IncidentPayrollControl({
  payrolls = [],
  employees = [],
  contracts = [],
  onDataChanged,
}) {
  const [payrollRows, setPayrollRows] = useState(payrolls);
  const [payrollId, setPayrollId] = useState("");
  const [preview, setPreview] = useState(null);
  const [lastFingerprint, setLastFingerprint] = useState("");
  const [overrides, setOverrides] = useState(EMPTY_OVERRIDES);
  const [loading, setLoading] = useState(Boolean(payrolls.length));
  const [processing, setProcessing] = useState(false);
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [error, setError] = useState(null);

  const employeeMap = useMemo(
    () => new Map(employees.map((item) => [String(item.id), item])),
    [employees]
  );
  const contractMap = useMemo(
    () => new Map(contracts.map((item) => [String(item.id), item])),
    [contracts]
  );
  const options = useMemo(
    () => payrollRows
      .filter((item) => Number(item.period_month) >= 1 && Number(item.period_month) <= 12)
      .sort((left, right) => (
        Number(right.period_year) - Number(left.period_year)
        || Number(right.period_month) - Number(left.period_month)
        || Number(right.id) - Number(left.id)
      )),
    [payrollRows]
  );
  const preferredPayroll = options.find((item) => Number(item.incident_days || 0) > 0) || options[0];
  const effectivePayrollId = payrollId || (preferredPayroll ? String(preferredPayroll.id) : "");
  const selectedPayroll = options.find((item) => String(item.id) === effectivePayrollId) || null;
  const selectedContract = selectedPayroll
    ? contractMap.get(String(selectedPayroll.contract_id))
    : null;
  const version = Number(
    preview?.calculation_version
    ?? selectedPayroll?.calculation_version
    ?? 0
  );
  const resolution = preview?.contribution_base_resolution || {};

  const refreshPayrollRows = useCallback(async () => {
    const rows = await fetchPayrolls();
    setPayrollRows(rows);
    return rows;
  }, []);

  const loadPreview = useCallback(async () => {
    if (!effectivePayrollId) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPayrollIncidentPreview(effectivePayrollId);
      setPreview(data);
      setOverrides(overridesFromPreview(data));
      return data;
    } catch (requestError) {
      setPreview(null);
      setError(requestError);
      return null;
    } finally {
      setLoading(false);
    }
  }, [effectivePayrollId]);

  useEffect(() => {
    let active = true;
    fetchPayrolls()
      .then((rows) => {
        if (!active) return;
        setPayrollRows(rows);
        if (rows.length) setLoading(true);
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!effectivePayrollId) return undefined;
    let active = true;
    fetchPayrollIncidentPreview(effectivePayrollId)
      .then((data) => {
        if (!active) return;
        setPreview(data);
        setOverrides(overridesFromPreview(data));
        setError(null);
      })
      .catch((requestError) => {
        if (!active) return;
        setPreview(null);
        setError(requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [effectivePayrollId]);

  const refreshAfterMutation = async () => {
    await onDataChanged?.();
    await refreshPayrollRows();
    await loadPreview();
  };

  const selectPayroll = (event) => {
    setPayrollId(event.target.value);
    setPreview(null);
    setLastFingerprint("");
    setError(null);
    setLoading(true);
  };

  const processPayroll = async () => {
    if (!effectivePayrollId) return;
    setProcessing(true);
    setError(null);
    try {
      const result = await processPayrollIncidents(effectivePayrollId, {
        actor: "frontend",
        expected_version: version,
      });
      setLastFingerprint(result.calculation_fingerprint || "");
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setProcessing(false);
    }
  };

  const saveOverrides = async (event) => {
    event.preventDefault();
    if (!effectivePayrollId) return;
    setSavingOverrides(true);
    setError(null);
    try {
      const result = await updatePayrollContributionBaseOverrides(effectivePayrollId, {
        common_contingencies_base_override: overrides.common === "" ? null : Number(overrides.common),
        professional_contingencies_base_override: overrides.professional === "" ? null : Number(overrides.professional),
        unemployment_training_fogasa_base_override: overrides.unemployment === "" ? null : Number(overrides.unemployment),
        actor: "frontend",
        expected_version: version,
      });
      setLastFingerprint(result.calculation_fingerprint || "");
      await refreshAfterMutation();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSavingOverrides(false);
    }
  };

  return <div className="incident-engine-workspace">
    <section className="incident-engine-toolbar">
      <div className="incident-engine-heading">
        <span><Calculator size={18} /> Motor de incidencias</span>
        <h2>Control del impacto en nómina</h2>
        <p>Previsualiza segmentos, bases y ajustes antes de confirmar el cálculo mensual.</p>
      </div>
      <div className="incident-engine-actions">
        <label>Nómina mensual<select value={effectivePayrollId} onChange={selectPayroll}>
          {!options.length && <option value="">No hay nóminas mensuales</option>}
          {options.map((payroll) => <option key={payroll.id} value={payroll.id}>{payrollPeriod(payroll)} · {payrollEmployee(payroll, employeeMap)}</option>)}
        </select></label>
        <button type="button" className="incident-button-secondary" onClick={loadPreview} disabled={!effectivePayrollId || loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} /> Actualizar vista previa
        </button>
        <button type="button" className="incident-button-primary" onClick={processPayroll} disabled={!effectivePayrollId || loading || processing || selectedPayroll?.status === "closed"}>
          <Play size={16} /> {processing ? "Procesando…" : "Procesar nómina"}
        </button>
      </div>
    </section>

    {selectedPayroll && <section className="incident-payroll-identity">
      <div><small>Trabajador</small><strong>{payrollEmployee(selectedPayroll, employeeMap)}</strong><span>Contrato {selectedContract?.contract_code || selectedPayroll.contract_id}</span></div>
      <div><small>Periodo</small><strong>{payrollPeriod(selectedPayroll)}</strong><span>{selectedPayroll.status || "draft"}</span></div>
      <div><small>Versión del cálculo</small><strong>v{version}</strong><span>{lastFingerprint ? lastFingerprint.slice(0, 12) : "Sin huella confirmada"}</span></div>
      <div><small>Situación</small><strong>{selectedPayroll.status === "closed" ? "Cerrada" : "Editable"}</strong><span>{selectedPayroll.status === "closed" ? "Requiere regularización" : "Puede recalcularse"}</span></div>
    </section>}

    <IncidentPayrollError error={error} />
    <IncidentOverlapConflicts error={error} />
    <IncidentPayrollMetrics preview={preview} />

    {preview && <>
      <IncidentContributionControl
        resolution={resolution}
        overrides={overrides}
        setOverrides={setOverrides}
        onSubmit={saveOverrides}
        onClear={() => setOverrides(EMPTY_OVERRIDES)}
        saving={savingOverrides}
        version={preview.calculation_version}
      />
      <IncidentSegmentTable segments={preview.segments || []} />
      <IncidentComponentAdjustments adjustments={preview.component_adjustments || []} />
    </>}

    {!preview && !loading && !error && <div className="incident-engine-empty"><Calculator size={28} /><strong>Selecciona una nómina mensual</strong><span>La vista previa no persiste segmentos ni importes.</span></div>}
  </div>;
}
