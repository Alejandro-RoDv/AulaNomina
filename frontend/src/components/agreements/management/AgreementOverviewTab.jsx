import { AlertsList, DefinitionTable, Section, StatsGrid, styles } from "./ManagementUi";
import { formatDate } from "./managementConfig";

export default function AgreementOverviewTab({
  agreement,
  status,
  groups,
  categories,
  salaryTables,
  salaryRows,
  workTimeRules,
  vacationRules,
  leaveRules,
  complements,
  alerts,
}) {
  return (
    <div style={styles.overviewLayout}>
      <Section title="Ficha administrativa" subtitle="Resumen del expediente de convenio.">
        <DefinitionTable rows={[
          ["Nombre", agreement.name],
          ["Código oficial", agreement.agreement_code || "—"],
          ["Sector", agreement.sector || "—"],
          ["Ámbito territorial", agreement.territorial_scope || "—"],
          ["Vigente desde", formatDate(agreement.effective_from)],
          ["Vigente hasta", formatDate(agreement.effective_to)],
          ["Estado", status.label],
          ["Notas", agreement.notes || "Sin notas"],
        ]} />
      </Section>

      <Section title="Control del convenio" subtitle="Indicadores y alertas.">
        <StatsGrid items={[
          ["Grupos", groups.length],
          ["Categorías", categories.length],
          ["Tablas", salaryTables.length],
          ["Filas salariales", salaryRows.length],
          ["Jornada", workTimeRules.length],
          ["Vacaciones", vacationRules.length],
          ["Permisos", leaveRules.length],
          ["Complementos", complements.length],
        ]} />
        <div style={styles.alertBlock}>
          <h4 style={styles.alertTitle}>Alertas</h4>
          <AlertsList alerts={alerts} />
        </div>
      </Section>
    </div>
  );
}
