import { ActionBar, Field, InlineForm, RowActions, Section, SimpleTable, styles } from "./ManagementUi";
import { formatLeaveType } from "./managementConfig";

function WorkTimeForm({ form, setForm, onSubmit, submitting }) {
  return <InlineForm title={form.id ? "Editar jornada" : "Nueva jornada"} onSubmit={onSubmit}><Field label="Nombre"><input style={styles.input} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><Field label="Horas anuales"><input type="number" style={styles.input} value={form.annual_hours || ""} onChange={(event) => setForm({ ...form, annual_hours: event.target.value })} /></Field><Field label="Horas semanales"><input type="number" style={styles.input} value={form.weekly_hours || ""} onChange={(event) => setForm({ ...form, weekly_hours: event.target.value })} /></Field><Field label="Distribución"><select style={styles.input} value={form.distribution_type || "regular"} onChange={(event) => setForm({ ...form, distribution_type: event.target.value })}><option value="regular">Regular</option><option value="irregular">Irregular</option></select></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>;
}

function VacationForm({ form, setForm, onSubmit, submitting }) {
  return <InlineForm title={form.id ? "Editar vacaciones" : "Nuevas vacaciones"} onSubmit={onSubmit}><Field label="Nombre"><input style={styles.input} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><Field label="Días naturales"><input type="number" style={styles.input} value={form.natural_days || ""} onChange={(event) => setForm({ ...form, natural_days: event.target.value })} /></Field><Field label="Días laborables"><input type="number" style={styles.input} value={form.working_days || ""} onChange={(event) => setForm({ ...form, working_days: event.target.value })} /></Field><Field label="Devengo"><input style={styles.input} value={form.accrual_period || ""} onChange={(event) => setForm({ ...form, accrual_period: event.target.value })} /></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>;
}

function LeaveForm({ form, setForm, onSubmit, submitting }) {
  return <InlineForm title={form.id ? "Editar permiso" : "Nuevo permiso"} onSubmit={onSubmit}><Field label="Nombre"><input style={styles.input} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field><Field label="Tipo"><select style={styles.input} value={form.leave_type || "paid"} onChange={(event) => setForm({ ...form, leave_type: event.target.value })}><option value="paid">Retribuido</option><option value="unpaid">No retribuido</option></select></Field><Field label="Causa"><input style={styles.input} value={form.cause || ""} onChange={(event) => setForm({ ...form, cause: event.target.value })} /></Field><Field label="Duración"><input style={styles.input} value={form.duration || ""} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></Field><button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button></InlineForm>;
}

function RuleSection({ title, children }) {
  return <section><h3 style={styles.subsectionTitle}>{title}</h3>{children}</section>;
}

export default function AgreementRulesTab({
  workTimeRules,
  vacationRules,
  leaveRules,
  workTimeRuleForm,
  setWorkTimeRuleForm,
  vacationRuleForm,
  setVacationRuleForm,
  leaveRuleForm,
  setLeaveRuleForm,
  openPanel,
  setOpenPanel,
  submitting,
  onSaveWorkTimeRule,
  onSaveVacationRule,
  onSaveLeaveRule,
  onDeleteWorkTimeRule,
  onDeleteVacationRule,
  onDeleteLeaveRule,
  initialWorkTimeRuleForm,
  initialVacationRuleForm,
  initialLeaveRuleForm,
}) {
  function togglePanel(panel) {
    setOpenPanel((current) => current === panel ? "" : panel);
  }

  return (
    <Section title="Jornada, vacaciones y permisos" subtitle="Reglas informativas separadas por bloque administrativo.">
      <ActionBar actions={[
        ["+ Nueva jornada", () => { setWorkTimeRuleForm(initialWorkTimeRuleForm); togglePanel("work-time"); }, "primary"],
        ["+ Vacaciones", () => { setVacationRuleForm(initialVacationRuleForm); togglePanel("vacation"); }],
        ["+ Permiso", () => { setLeaveRuleForm(initialLeaveRuleForm); togglePanel("leave"); }],
      ]} />

      {openPanel === "work-time" && <WorkTimeForm form={workTimeRuleForm} setForm={setWorkTimeRuleForm} onSubmit={onSaveWorkTimeRule} submitting={submitting} />}
      {openPanel === "vacation" && <VacationForm form={vacationRuleForm} setForm={setVacationRuleForm} onSubmit={onSaveVacationRule} submitting={submitting} />}
      {openPanel === "leave" && <LeaveForm form={leaveRuleForm} setForm={setLeaveRuleForm} onSubmit={onSaveLeaveRule} submitting={submitting} />}

      <div style={styles.ruleStack}>
        <RuleSection title="Jornada">
          <SimpleTable columns={["Nombre", "Horas año", "Horas semana", "Distribución", "Acciones"]} empty="Sin reglas de jornada." rows={workTimeRules.map((rule) => [rule.name, rule.annual_hours || "—", rule.weekly_hours || "—", rule.distribution_type === "irregular" ? "Irregular" : "Regular", <RowActions key={`actions-${rule.id}`} onEdit={() => { setWorkTimeRuleForm({ ...initialWorkTimeRuleForm, ...rule }); setOpenPanel("work-time"); }} onDelete={() => onDeleteWorkTimeRule(rule)} />])} />
        </RuleSection>

        <RuleSection title="Vacaciones">
          <SimpleTable columns={["Nombre", "Naturales", "Laborables", "Devengo", "Acciones"]} empty="Sin reglas de vacaciones." rows={vacationRules.map((rule) => [rule.name, rule.natural_days || "—", rule.working_days || "—", rule.accrual_period || "—", <RowActions key={`actions-${rule.id}`} onEdit={() => { setVacationRuleForm({ ...initialVacationRuleForm, ...rule }); setOpenPanel("vacation"); }} onDelete={() => onDeleteVacationRule(rule)} />])} />
        </RuleSection>

        <RuleSection title="Permisos">
          <SimpleTable columns={["Nombre", "Tipo", "Duración", "Causa", "Acciones"]} empty="Sin permisos registrados." rows={leaveRules.map((rule) => [rule.name, formatLeaveType(rule.leave_type), rule.duration ? `${rule.duration} ${rule.duration_unit || ""}` : "—", rule.cause || "—", <RowActions key={`actions-${rule.id}`} onEdit={() => { setLeaveRuleForm({ ...initialLeaveRuleForm, ...rule }); setOpenPanel("leave"); }} onDelete={() => onDeleteLeaveRule(rule)} />])} />
        </RuleSection>
      </div>
    </Section>
  );
}
