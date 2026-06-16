import { RowActions, Section, SimpleTable, styles } from "./ManagementUi";
import { getGroupName, money } from "./managementConfig";

export default function AgreementSeniorityHistoryTab({
  salaryRows,
  groups,
  onEditSalaryRow,
  onDeleteSalaryRow,
}) {
  return (
    <Section title="Antigüedad" subtitle="Importes de antigüedad informados en las filas salariales del convenio.">
      <p style={styles.helpText}>Esta vista conserva los importes históricos de cada fila salarial. La configuración de módulos y vencimientos se encuentra en Criterios laborales.</p>
      <SimpleTable
        columns={["Tabla", "Año", "Categoría", "Grupo", "Importe antigüedad", "Acciones"]}
        empty="Sin importes de antigüedad registrados."
        rows={salaryRows.map((row) => [
          row.table_name,
          row.table_year,
          row.category_name || "—",
          row.group_name || getGroupName(groups, row.professional_group_id),
          money(row.seniority_amount),
          <RowActions key={`actions-${row.id}`} onEdit={() => onEditSalaryRow(row)} onDelete={() => onDeleteSalaryRow(row)} />,
        ])}
      />
    </Section>
  );
}
