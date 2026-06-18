import { Field, Modal, styles } from "./ManagementUi";
import { formatDate, MANAGEMENT_TABS } from "./managementConfig";

function StatusBadge({ status }) {
  return <span style={{ ...styles.statusBadge, ...(styles[`${status.tone}Status`] || {}) }}>{status.label}</span>;
}

function RecordItem({ label, value }) {
  return <div style={styles.recordItem}><span>{label}</span><strong>{value}</strong></div>;
}

export function ManagementHeader({
  agreements,
  selectedAgreement,
  selectedAgreementId,
  onSelectedAgreementIdChange,
  status,
  submitting,
  seedDemoLoading,
  onSeedDemo,
  onOpenCreate,
  onDuplicate,
  onActivate,
  onArchive,
}) {
  return (
    <>
      <section style={styles.topBar}>
        <div style={styles.titleBlock}>
          <h2 style={styles.pageTitle}>Convenios colectivos</h2>
          <p style={styles.pageSubtitle}>Categorías, jornada, permisos y tablas salariales para simulación docente.</p>
        </div>
        <div style={styles.toolbar}>
          <select value={selectedAgreementId || ""} onChange={(event) => onSelectedAgreementIdChange?.(event.target.value)} style={styles.selectLarge}>
            {!agreements.length && <option value="">Sin convenios</option>}
            {agreements.map((agreement) => <option key={agreement.id} value={agreement.id}>{agreement.name} · {agreement.agreement_code || "sin código"}</option>)}
          </select>
          <StatusBadge status={status} />
          <button type="button" onClick={onSeedDemo} disabled={submitting} style={styles.secondaryButton}>{seedDemoLoading ? "Preparando demo…" : "Cargar demo"}</button>
          <button type="button" onClick={onOpenCreate} disabled={submitting} style={styles.primaryButton}>Nuevo convenio</button>
        </div>
      </section>

      {selectedAgreement && (
        <section style={styles.recordHeader}>
          <div style={styles.recordMain}><span style={styles.recordEyebrow}>Convenio seleccionado</span><strong style={styles.recordTitle}>{selectedAgreement.name}</strong></div>
          <RecordItem label="Código" value={selectedAgreement.agreement_code || "—"} />
          <RecordItem label="Sector" value={selectedAgreement.sector || "—"} />
          <RecordItem label="Vigencia" value={`${formatDate(selectedAgreement.effective_from)} - ${formatDate(selectedAgreement.effective_to)}`} />
          <div style={styles.recordActions}>
            <button type="button" style={styles.linkButton} onClick={onOpenCreate}>Nuevo</button>
            <button type="button" style={styles.linkButton} onClick={onDuplicate}>Duplicar</button>
            <button type="button" style={styles.linkButton} onClick={onActivate}>Activar</button>
            <button type="button" style={styles.linkButton} onClick={onArchive}>Caducar</button>
          </div>
        </section>
      )}
    </>
  );
}

export function ManagementTabs({ activeTab, onActiveTabChange }) {
  return <nav style={styles.tabs}>{MANAGEMENT_TABS.map((tab) => <button key={tab.id} type="button" onClick={() => onActiveTabChange?.(tab.id)} style={activeTab === tab.id ? styles.tabActive : styles.tab}>{tab.label}</button>)}</nav>;
}

export function CreateAgreementModal({ form, setForm, submitting, onSubmit, onClose }) {
  return (
    <Modal title="Nuevo convenio" onClose={onClose}>
      <form onSubmit={onSubmit} style={styles.modalForm}>
        <div style={styles.modalGroup}>
          <h4>Identificación</h4>
          <div style={styles.formGrid}>
            <Field label="Nombre del convenio"><input style={styles.input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <Field label="Código oficial"><input style={styles.input} value={form.agreement_code} onChange={(event) => setForm({ ...form, agreement_code: event.target.value })} /></Field>
            <Field label="Sector"><input style={styles.input} value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })} /></Field>
            <Field label="Ámbito territorial"><input style={styles.input} value={form.territorial_scope} onChange={(event) => setForm({ ...form, territorial_scope: event.target.value })} /></Field>
          </div>
        </div>
        <div style={styles.modalGroup}>
          <h4>Vigencia y estado</h4>
          <div style={styles.formGridThree}>
            <Field label="Fecha entrada en vigor"><input type="date" style={styles.input} value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} /></Field>
            <Field label="Fecha fin vigencia"><input type="date" style={styles.input} value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} /></Field>
            <Field label="Estado"><select style={styles.input} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Borrador</option><option value="active">Activo</option><option value="archived">Caducado</option></select></Field>
          </div>
        </div>
        <div style={styles.modalGroup}><h4>Notas internas</h4><textarea style={{ ...styles.textarea, minHeight: "110px" }} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
        <div style={styles.modalActions}><button type="button" onClick={onClose} style={styles.secondaryButton}>Cancelar</button><button type="submit" disabled={submitting} style={styles.primaryButton}>Crear convenio</button></div>
      </form>
    </Modal>
  );
}
