import { ActionBar, Field, InlineForm, RowActions, Section, SimpleTable, styles } from "./ManagementUi";
import { getGroupName, money } from "./managementConfig";

function SalaryTableForm({ form, setForm, onSubmit, submitting }) {
  return (
    <InlineForm title={form.id ? "Editar tabla salarial" : "Nueva tabla salarial"} onSubmit={onSubmit}>
      <Field label="Nombre de la tabla"><input style={styles.input} value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
      <Field label="Año"><input style={styles.input} value={form.year || ""} onChange={(event) => setForm({ ...form, year: event.target.value })} /></Field>
      <Field label="Nº pagas"><input type="number" style={styles.input} value={form.number_of_payments || ""} onChange={(event) => setForm({ ...form, number_of_payments: Number(event.target.value) })} /></Field>
      <Field label="Tipo importe"><select style={styles.input} value={form.amount_type || "monthly"} onChange={(event) => setForm({ ...form, amount_type: event.target.value })}><option value="monthly">Mensual</option><option value="annual">Anual</option></select></Field>
      <button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button>
    </InlineForm>
  );
}

function SalaryRowForm({ form, setForm, salaryTables, categories, onSubmit, submitting }) {
  return (
    <InlineForm title={form.id ? "Editar fila salarial" : "Nueva fila salarial"} onSubmit={onSubmit}>
      <Field label="Tabla salarial"><select style={styles.input} value={form.salary_table_id || ""} onChange={(event) => setForm({ ...form, salary_table_id: event.target.value })} required><option value="">Selecciona tabla</option>{salaryTables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select></Field>
      <Field label="Categoría"><select style={styles.input} value={form.professional_category_id || ""} onChange={(event) => setForm({ ...form, professional_category_id: event.target.value })}><option value="">Categoría manual</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
      <Field label="Salario base"><input type="number" style={styles.input} value={form.base_salary || ""} onChange={(event) => setForm({ ...form, base_salary: event.target.value })} required /></Field>
      <Field label="Plus convenio"><input type="number" style={styles.input} value={form.agreement_plus || ""} onChange={(event) => setForm({ ...form, agreement_plus: event.target.value })} /></Field>
      <Field label="Total"><input type="number" style={styles.input} value={form.total_amount || ""} onChange={(event) => setForm({ ...form, total_amount: event.target.value })} /></Field>
      <button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button>
    </InlineForm>
  );
}

export default function AgreementSalaryTablesTab({
  salaryTables,
  salaryRows,
  categories,
  groups,
  salaryTableForm,
  setSalaryTableForm,
  salaryRowForm,
  setSalaryRowForm,
  openPanel,
  setOpenPanel,
  submitting,
  onSaveSalaryTable,
  onSaveSalaryRow,
  onDeleteSalaryTable,
  onDeleteSalaryRow,
  initialSalaryTableForm,
  initialSalaryRowForm,
}) {
  function togglePanel(panel) {
    setOpenPanel((current) => current === panel ? "" : panel);
  }

  return (
    <Section title="Tablas salariales" subtitle="Salario base, plus de convenio y total por categoría. La antigüedad se configura exclusivamente en Criterios → Antigüedad.">
      <ActionBar actions={[
        ["+ Crear tabla", () => { setSalaryTableForm(initialSalaryTableForm); togglePanel("salary-table"); }, "primary"],
        ["+ Añadir fila", () => { setSalaryRowForm({ ...initialSalaryRowForm, seniority_amount: null }); togglePanel("salary-row"); }],
      ]} />

      {openPanel === "salary-table" && <SalaryTableForm form={salaryTableForm} setForm={setSalaryTableForm} onSubmit={onSaveSalaryTable} submitting={submitting} />}
      {openPanel === "salary-row" && <SalaryRowForm form={salaryRowForm} setForm={setSalaryRowForm} salaryTables={salaryTables} categories={categories} onSubmit={onSaveSalaryRow} submitting={submitting} />}

      <div style={styles.salaryBlock}>
        <h3 style={styles.subsectionTitle}>Tablas del convenio</h3>
        <SimpleTable
          columns={["Nombre", "Año", "Pagas", "Tipo", "Estado", "Acciones"]}
          empty="Sin tablas salariales registradas."
          rows={salaryTables.map((table) => [
            table.name,
            table.year || "—",
            table.number_of_payments || "—",
            table.amount_type === "annual" ? "Anual" : "Mensual",
            table.status || "—",
            <RowActions key={`actions-${table.id}`} onEdit={() => { setSalaryTableForm({ ...initialSalaryTableForm, ...table }); setOpenPanel("salary-table"); }} onDelete={() => onDeleteSalaryTable(table)} />,
          ])}
        />
      </div>

      <div style={styles.salaryBlock}>
        <h3 style={styles.subsectionTitle}>Filas salariales</h3>
        <SimpleTable
          columns={["Tabla", "Año", "Categoría", "Grupo", "Salario base", "Plus convenio", "Total", "Acciones"]}
          empty="Sin filas salariales."
          rows={salaryRows.map((row) => [
            row.table_name,
            row.table_year,
            row.category_name || "—",
            row.group_name || getGroupName(groups, row.professional_group_id),
            money(row.base_salary),
            money(row.agreement_plus),
            money(row.total_amount),
            <RowActions key={`actions-${row.id}`} onEdit={() => { setSalaryRowForm({ ...initialSalaryRowForm, ...row, salary_table_id: row.table_id, seniority_amount: null }); setOpenPanel("salary-row"); }} onDelete={() => onDeleteSalaryRow(row)} />,
          ])}
        />
      </div>
    </Section>
  );
}
