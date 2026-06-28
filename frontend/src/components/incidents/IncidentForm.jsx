const INCIDENT_TYPES = [
  { value: "IT", label: "Incapacidad temporal" },
  { value: "RECAIDA", label: "Recaída" },
  { value: "NACIMIENTO_CUIDADO", label: "Nacimiento y cuidado" },
  { value: "RIESGO_EMBARAZO", label: "Riesgo durante el embarazo" },
  { value: "RIESGO_LACTANCIA", label: "Riesgo durante la lactancia" },
  { value: "CUIDADO_MENOR", label: "Cuidado de menor" },
  { value: "VACACIONES", label: "Vacaciones" },
  { value: "AUSENCIA", label: "Ausencia" },
  { value: "PERMISO_RETRIBUIDO", label: "Permiso retribuido" },
  { value: "PERMISO_NO_RETRIBUIDO", label: "Permiso no retribuido" },
  { value: "SUSPENSION", label: "Suspensión" },
  { value: "SANCION", label: "Sanción" },
  { value: "HORAS_EXTRA", label: "Horas extraordinarias" },
  { value: "MOVIMIENTO", label: "Cambio del trabajador" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "open", label: "Abierta" },
  { value: "pending", label: "Pendiente" },
  { value: "validated", label: "Validada" },
  { value: "processed", label: "Procesada" },
  { value: "closed", label: "Cerrada" },
  { value: "regularized", label: "Regularizada" },
];

const MEDICAL_TYPES = new Set(["IT", "RECAIDA", "NACIMIENTO_CUIDADO", "RIESGO_EMBARAZO", "RIESGO_LACTANCIA", "CUIDADO_MENOR"]);
const ABSENCE_TYPES = new Set(["AUSENCIA", "PERMISO_RETRIBUIDO", "PERMISO_NO_RETRIBUIDO", "SUSPENSION", "SANCION"]);

function latestContract(contracts, employeeId) {
  return contracts
    .filter((contract) => String(contract.employee_id) === String(employeeId))
    .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")))[0];
}

function Field({ label, title, children, wide = false }) {
  return (
    <div style={wide ? styles.formGroupWide : styles.formGroup} title={title}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

function Checkbox({ name, checked, onChange, children, title }) {
  return (
    <label style={styles.checkbox} title={title}>
      <input type="checkbox" name={name} checked={Boolean(checked)} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

export default function IncidentForm({
  form,
  employees,
  contracts,
  companies,
  workCenters,
  onChange,
  onSubmit,
  error,
  success,
  submitting,
}) {
  const employeeContracts = contracts.filter((contract) => String(contract.employee_id) === String(form.employee_id));
  const selectedEmployee = employees.find((employee) => String(employee.id) === String(form.employee_id));
  const selectedContract = contracts.find((contract) => String(contract.id) === String(form.contract_id));
  const selectedCompany = companies.find((company) => String(company.id) === String(form.company_id));
  const selectedCenter = workCenters.find((center) => String(center.id) === String(form.center_id));

  const handleEmployeeChange = (event) => {
    const employeeId = event.target.value;
    const contract = latestContract(contracts, employeeId);
    onChange({ target: { name: "employee_id", value: employeeId, type: "select-one" } });
    onChange({ target: { name: "contract_id", value: contract ? String(contract.id) : "", type: "select-one" } });
    onChange({ target: { name: "company_id", value: contract?.company_id ? String(contract.company_id) : "", type: "hidden" } });
    onChange({ target: { name: "center_id", value: contract?.center_id ? String(contract.center_id) : "", type: "hidden" } });
  };

  const isMedical = MEDICAL_TYPES.has(form.incident_type);
  const isAbsence = ABSENCE_TYPES.has(form.incident_type);
  const isVacation = form.incident_type === "VACACIONES";
  const isOvertime = form.incident_type === "HORAS_EXTRA";
  const isMovement = form.incident_type === "MOVIMIENTO";
  const disabled = submitting || !selectedContract;

  return (
    <form onSubmit={onSubmit} style={styles.form}>
      <section style={styles.section}>
        <div style={styles.sectionTitle}>Trabajador y vida laboral</div>
        <div style={styles.grid}>
          <Field label="Trabajador" wide>
            <select name="employee_id" value={form.employee_id} onChange={handleEmployeeChange} required style={styles.input}>
              <option value="">Selecciona trabajador</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_code || employee.id} · {employee.first_name} {employee.last_name} · {employee.dni}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vida laboral / contrato" wide>
            <select name="contract_id" value={form.contract_id} onChange={onChange} required style={styles.input} disabled={!form.employee_id}>
              <option value="">Selecciona vida laboral</option>
              {employeeContracts.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {contract.start_date} — {contract.end_date || "vigente"} · {contract.contract_code || contract.contract_type}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de incidencia">
            <select name="incident_type" value={form.incident_type} onChange={onChange} required style={styles.input}>
              <option value="">Selecciona tipo</option>
              {INCIDENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select name="status" value={form.status} onChange={onChange} style={styles.input}>
              {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </Field>
        </div>

        {selectedContract && (
          <div style={styles.contractSummary}>
            <div><strong>Empresa:</strong> {selectedCompany?.name || "—"}</div>
            <div><strong>Centro:</strong> {selectedCenter?.name || "—"}</div>
            <div><strong>Convenio:</strong> {selectedContract.collective_agreement_name || selectedContract.collective_agreement_code || "—"}</div>
            <div><strong>Categoría:</strong> {selectedContract.professional_category || "—"}</div>
            <div><strong>Grupo cotización:</strong> {selectedContract.contribution_group || "—"}</div>
            <div><strong>Jornada:</strong> {selectedContract.working_day_type || "—"} {selectedContract.partiality_coefficient ? `· ${selectedContract.partiality_coefficient} %` : ""}</div>
          </div>
        )}
        <input type="hidden" name="company_id" value={form.company_id} />
        <input type="hidden" name="center_id" value={form.center_id || ""} />
      </section>

      <section style={styles.section}>
        <div style={styles.sectionTitle}>Periodo y efecto</div>
        <div style={styles.grid}>
          <Field label="Fecha inicial"><input type="date" name="start_date" value={form.start_date} onChange={onChange} required style={styles.input} /></Field>
          <Field label="Fecha final"><input type="date" name="end_date" value={form.end_date} onChange={onChange} style={styles.input} /></Field>
          <Field label="Unidad">
            <select name="unit_type" value={form.unit_type} onChange={onChange} style={styles.input}>
              <option value="days">Días</option><option value="hours">Horas</option><option value="period">Periodo</option><option value="informative">Informativa</option>
            </select>
          </Field>
          <Field label="Efecto en nómina">
            <select name="payroll_effect" value={form.payroll_effect} onChange={onChange} style={styles.input}>
              <option value="pending">Pendiente de determinar</option><option value="deduction">Genera deducción</option><option value="earning">Genera devengo</option><option value="informative">Solo informativa</option><option value="none">Sin efecto económico</option>
            </select>
          </Field>
          {form.unit_type === "hours" || isOvertime ? <Field label="Horas"><input type="number" min="0" max="24" step="0.01" name="hours" value={form.hours} onChange={onChange} style={styles.input} required={isOvertime} /></Field> : null}
          {form.unit_type === "days" ? <Field label="Días"><input type="number" min="0" step="0.01" name="days" value={form.days} onChange={onChange} style={styles.input} /></Field> : null}
          <Field label="Importe generado"><input type="number" min="0" step="0.01" name="generated_amount" value={form.generated_amount} onChange={onChange} style={styles.input} placeholder="Se completa al procesar" /></Field>
        </div>
      </section>

      {isMedical && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Incapacidad y prestaciones</div>
          <div style={styles.grid}>
            <Field label="Tipo de prestación"><select name="benefit_type" value={form.benefit_type} onChange={onChange} style={styles.input}><option value="">Seleccionar</option><option value="temporary_disability">Incapacidad temporal</option><option value="birth_care">Nacimiento y cuidado</option><option value="pregnancy_risk">Riesgo embarazo</option><option value="lactation_risk">Riesgo lactancia</option><option value="child_care">Cuidado de menor</option><option value="other">Otra</option></select></Field>
            <Field label="Tipo de proceso"><select name="process_type" value={form.process_type} onChange={onChange} style={styles.input}><option value="">Seleccionar</option><option value="common_disease">Enfermedad común</option><option value="non_work_accident">Accidente no laboral</option><option value="work_accident">Accidente de trabajo</option><option value="occupational_disease">Enfermedad profesional</option><option value="relapse">Recaída</option><option value="other">Otro</option></select></Field>
            <Field label="Causa / motivo"><input name="cause_code" value={form.cause_code} onChange={onChange} style={styles.input} /></Field>
            <Field label="Fecha de alta"><input type="date" name="discharge_date" value={form.discharge_date} onChange={onChange} style={styles.input} /></Field>
            <Field label="D. Baja" title="TODO funcional: significado exacto pendiente"><input name="d_baja_aux" value={form.d_baja_aux} onChange={onChange} style={styles.input} /></Field>
            <Field label="Fecha de sustitución" title="TODO funcional: regla exacta pendiente"><input type="date" name="replacement_date" value={form.replacement_date} onChange={onChange} style={styles.input} /></Field>
            {form.incident_type === "RECAIDA" && <Field label="Proceso anterior relacionado"><input name="relapse_process_reference" value={form.relapse_process_reference} onChange={onChange} style={styles.input} /></Field>}
          </div>
          <div style={styles.checkRow}>
            <Checkbox name="direct_payment" checked={form.direct_payment} onChange={onChange}>Pago directo</Checkbox>
            <Checkbox name="natural_days" checked={form.natural_days} onChange={onChange}>Pago por día natural</Checkbox>
          </div>
          <div style={styles.sensitiveNotice}>El diagnóstico y demás datos sanitarios no se solicitan en este formulario general. Deben incorporarse únicamente mediante una vista protegida por permisos específicos.</div>
        </section>
      )}

      {isAbsence && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Absentismo</div>
          <div style={styles.grid}>
            <Field label="Causa parametrizable"><input name="cause_code" value={form.cause_code} onChange={onChange} style={styles.input} placeholder="Huelga, ausencia injustificada…" /></Field>
            <Field label="Retribuida"><select name="paid" value={form.paid} onChange={onChange} style={styles.input}><option value="">Según causa</option><option value="true">Sí</option><option value="false">No</option></select></Field>
          </div>
        </section>
      )}

      {isVacation && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Vacaciones</div>
          <div style={styles.grid}>
            <Field label="Tipo de días"><select name="vacation_day_type" value={form.vacation_day_type} onChange={onChange} style={styles.input}><option value="calendar">Naturales</option><option value="working">Laborables</option><option value="work_calendar">Según calendario laboral</option></select></Field>
            <Field label="Rótulo en nómina"><input name="payroll_label" value={form.payroll_label} onChange={onChange} style={styles.input} placeholder="Vacaciones disfrutadas" /></Field>
          </div>
          <Checkbox name="pay_in_payroll" checked={form.pay_in_payroll} onChange={onChange}>Pagar o mostrar separadamente en nómina</Checkbox>
        </section>
      )}

      {isOvertime && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Horas extraordinarias</div>
          <div style={styles.grid}>
            <Field label="Tipo configurable"><input name="overtime_type" value={form.overtime_type} onChange={onChange} style={styles.input} placeholder="Tipo 1, Tipo 2…" /></Field>
            <Field label="Valor hora"><input type="number" min="0" step="0.0001" name="hour_value" value={form.hour_value} onChange={onChange} style={styles.input} /></Field>
            <Field label="Destino"><select name="inclusion_destination" value={form.inclusion_destination} onChange={onChange} style={styles.input}><option value="pending">No incluir todavía</option><option value="payroll">Incluir en nómina</option><option value="receipt">Incluir en recibo</option></select></Field>
            <Field label="Cont." title="TODO funcional: significado exacto pendiente"><input name="cont_aux" value={form.cont_aux} onChange={onChange} style={styles.input} /></Field>
          </div>
        </section>
      )}

      {isMovement && (
        <section style={styles.section}>
          <div style={styles.sectionTitle}>Cambio del trabajador</div>
          <div style={styles.grid}>
            <Field label="Cambio de"><input name="movement_field" value={form.movement_field} onChange={onChange} style={styles.input} placeholder="Categoría, jornada, centro…" /></Field>
            <Field label="Valor anterior"><input name="previous_value" value={form.previous_value} onChange={onChange} style={styles.input} /></Field>
            <Field label="Nuevo valor"><input name="new_value" value={form.new_value} onChange={onChange} style={styles.input} /></Field>
            <Field label="Fecha de efectos"><input type="date" name="effective_date" value={form.effective_date} onChange={onChange} style={styles.input} /></Field>
            <Field label="Inc. Nómina" title="TODO funcional: significado exacto pendiente"><input name="payroll_incidence_aux" value={form.payroll_incidence_aux} onChange={onChange} style={styles.input} /></Field>
          </div>
        </section>
      )}

      <section style={styles.section}>
        <div style={styles.sectionTitle}>Trazabilidad y campos auxiliares</div>
        <div style={styles.grid}>
          <Field label="Origen"><select name="origin" value={form.origin} onChange={onChange} style={styles.input}><option value="manual">Manual</option><option value="case_study">Caso práctico</option><option value="import">Importación simulada</option><option value="payroll">Motor de nómina</option></select></Field>
          <Field label="C" title="TODO funcional: indicador C pendiente"><input name="indicator_c" value={form.indicator_c} onChange={onChange} style={styles.input} /></Field>
          <Field label="H" title="TODO funcional: indicador H pendiente"><input name="indicator_h" value={form.indicator_h} onChange={onChange} style={styles.input} /></Field>
          <Field label="G. P." title="TODO funcional: significado pendiente"><input name="gp_aux" value={form.gp_aux} onChange={onChange} style={styles.input} /></Field>
          <Field label="Cálculo auxiliar" title="TODO funcional: segunda columna Cálculo"><input name="aux_calculation" value={form.aux_calculation} onChange={onChange} style={styles.input} /></Field>
          <Field label="IND" title="TODO funcional: indicador interno configurable"><input name="internal_indicator" value={form.internal_indicator} onChange={onChange} style={styles.input} /></Field>
        </div>
        <Field label="Observaciones" wide><textarea name="description" value={form.description} onChange={onChange} rows="3" style={styles.textarea} /></Field>
        <div style={styles.overrideBox}>
          <Checkbox name="overlap_override" checked={form.overlap_override} onChange={onChange}>Autorizar solapamiento tras revisión</Checkbox>
          {form.overlap_override && <textarea name="overlap_reason" value={form.overlap_reason} onChange={onChange} rows="2" style={styles.textarea} placeholder="Motivo obligatorio y criterio aplicado" required />}
        </div>
      </section>

      {selectedEmployee && !selectedContract && <div style={styles.warning}>El trabajador no tiene una vida laboral seleccionable. No se puede registrar la incidencia.</div>}
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}
      <button type="submit" disabled={disabled} style={{ ...styles.button, opacity: disabled ? 0.65 : 1 }}>{submitting ? "Guardando…" : "Registrar incidencia"}</button>
    </form>
  );
}

export { INCIDENT_TYPES, STATUS_OPTIONS };

const styles = {
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  section: { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", background: "#fff" },
  sectionTitle: { fontSize: "14px", fontWeight: 900, color: "#111827", marginBottom: "12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px" },
  formGroup: { minWidth: 0, display: "flex", flexDirection: "column", gap: "5px" },
  formGroupWide: { minWidth: 0, display: "flex", flexDirection: "column", gap: "5px", gridColumn: "span 2" },
  label: { fontSize: "12px", fontWeight: 800, color: "#374151" },
  input: { width: "100%", boxSizing: "border-box", minHeight: "38px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "7px", fontSize: "13px", background: "#fff" },
  textarea: { width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #d1d5db", borderRadius: "7px", fontSize: "13px", resize: "vertical", fontFamily: "inherit" },
  contractSummary: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px 14px", marginTop: "12px", padding: "10px", background: "#f8fafc", borderRadius: "8px", color: "#374151", fontSize: "12px" },
  checkRow: { display: "flex", gap: "18px", flexWrap: "wrap", marginTop: "12px" },
  checkbox: { display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "13px", fontWeight: 700, color: "#374151", cursor: "pointer" },
  sensitiveNotice: { marginTop: "12px", padding: "9px 10px", borderRadius: "7px", background: "#eff6ff", color: "#1e3a8a", fontSize: "12px", fontWeight: 700 },
  overrideBox: { marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px", padding: "10px", background: "#fffbeb", borderRadius: "8px" },
  button: { backgroundColor: "#111827", color: "white", border: "none", borderRadius: "8px", padding: "11px 18px", fontSize: "14px", cursor: "pointer", width: "fit-content", fontWeight: 900 },
  error: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px" },
  success: { backgroundColor: "#dcfce7", color: "#166534", padding: "10px 12px", borderRadius: "8px" },
  warning: { backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 12px", borderRadius: "8px", fontWeight: 700 },
};
