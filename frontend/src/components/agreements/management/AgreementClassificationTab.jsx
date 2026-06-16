import { ActionBar, Field, InlineForm, RowActions, Section, SimpleTable, styles } from "./ManagementUi";

export default function AgreementClassificationTab({
  groups,
  selectedGroup,
  selectedGroupId,
  setSelectedGroupId,
  filteredCategories,
  groupForm,
  setGroupForm,
  categoryForm,
  setCategoryForm,
  openPanel,
  setOpenPanel,
  submitting,
  onSaveGroup,
  onSaveCategory,
  onDeleteGroup,
  onDeleteCategory,
  initialGroupForm,
  initialCategoryForm,
}) {
  function togglePanel(panel) {
    setOpenPanel((current) => current === panel ? "" : panel);
  }

  function startCategoryForGroup(group) {
    setSelectedGroupId(String(group.id));
    setCategoryForm({ ...initialCategoryForm, professional_group_id: group.id });
    setOpenPanel("category");
  }

  return (
    <Section title="Clasificación profesional" subtitle="Selecciona un grupo y gestiona sus categorías.">
      <ActionBar actions={[
        ["+ Nuevo grupo", () => { setGroupForm(initialGroupForm); togglePanel("group"); }, "primary"],
        ["+ Nueva categoría", () => { setCategoryForm(selectedGroup ? { ...initialCategoryForm, professional_group_id: selectedGroup.id } : initialCategoryForm); togglePanel("category"); }],
      ]} />

      {openPanel === "group" && (
        <InlineForm title={groupForm.id ? "Editar grupo profesional" : "Nuevo grupo profesional"} onSubmit={onSaveGroup}>
          <Field label="Nombre del grupo"><input style={styles.input} value={groupForm.name || ""} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} required /></Field>
          <Field label="Código"><input style={styles.input} value={groupForm.code || ""} onChange={(event) => setGroupForm({ ...groupForm, code: event.target.value })} /></Field>
          <Field label="Descripción"><textarea style={styles.textarea} value={groupForm.description || ""} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} /></Field>
          <button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button>
        </InlineForm>
      )}

      {openPanel === "category" && (
        <InlineForm title={categoryForm.id ? "Editar categoría profesional" : "Nueva categoría profesional"} onSubmit={onSaveCategory}>
          <Field label="Grupo"><select style={styles.input} value={categoryForm.professional_group_id || ""} onChange={(event) => setCategoryForm({ ...categoryForm, professional_group_id: event.target.value })}><option value="">Sin grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></Field>
          <Field label="Código"><input style={styles.input} value={categoryForm.code || ""} onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value })} /></Field>
          <Field label="Categoría"><input style={styles.input} value={categoryForm.name || ""} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required /></Field>
          <Field label="Nivel"><input style={styles.input} value={categoryForm.level || ""} onChange={(event) => setCategoryForm({ ...categoryForm, level: event.target.value })} /></Field>
          <button type="submit" disabled={submitting} style={styles.primaryButton}>Guardar</button>
        </InlineForm>
      )}

      <div style={styles.classificationLayout}>
        <section style={styles.leftPane}>
          <div style={styles.paneTitle}>Grupos profesionales</div>
          <SimpleTable
            columns={["Grupo", "Código", "Acciones"]}
            empty="Sin grupos registrados."
            rows={groups.map((group) => [
              <button key={group.id} type="button" onClick={() => setSelectedGroupId(String(group.id))} style={String(selectedGroupId || selectedGroup?.id) === String(group.id) ? styles.rowSelectActive : styles.rowSelect}>{group.name}</button>,
              group.code || "—",
              <RowActions key={`actions-${group.id}`} onEdit={() => { setGroupForm({ ...initialGroupForm, ...group }); setOpenPanel("group"); }} onDelete={() => onDeleteGroup(group)} />,
            ])}
          />
        </section>

        <section style={styles.rightPane}>
          <div style={styles.paneHeader}>
            <div>
              <h3 style={styles.paneHeading}>{selectedGroup ? `Categorías de ${selectedGroup.name}` : "Categorías"}</h3>
              <p style={styles.paneSubtitle}>{filteredCategories.length} categorías en el grupo seleccionado</p>
            </div>
            {selectedGroup && <button type="button" onClick={() => startCategoryForGroup(selectedGroup)} style={styles.secondaryButton}>Añadir categoría</button>}
          </div>
          <SimpleTable
            columns={["Código", "Categoría", "Nivel", "Acciones"]}
            empty="Sin categorías para este grupo."
            rows={filteredCategories.map((category) => [
              category.code || "—",
              category.name,
              category.level || "—",
              <RowActions key={`actions-${category.id}`} onEdit={() => { setCategoryForm({ ...initialCategoryForm, ...category }); setOpenPanel("category"); }} onDelete={() => onDeleteCategory(category)} />,
            ])}
          />
        </section>
      </div>
    </Section>
  );
}
