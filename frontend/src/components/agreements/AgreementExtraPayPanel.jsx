import { useEffect, useMemo, useState } from "react";

import {
  createAgreementExtraPay,
  createAgreementExtraPayConcept,
  deleteAgreementExtraPay,
  deleteAgreementExtraPayConcept,
  fetchAgreementExtraPayCandidates,
  fetchAgreementExtraPayPreview,
  fetchAgreementExtraPays,
  updateAgreementExtraPay,
  updateAgreementExtraPayConcept,
} from "../../services/agreementExtraPayApi";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const EMPTY_PAY = { id: null, name: "", code: "", payment_month: "7", accrual_start_month: "1", accrual_end_month: "6", accrual_months: "6", proration_allowed: true, proration_default: false, notes: "" };
const EMPTY_LINE = { id: null, concept_key: "", concept_name: "", scope: "general", calculation_mode: "percentage", percentage: "100", fixed_amount: "", display_order: "10", notes: "" };

const money = (value) => value === null || value === undefined || value === "" ? "—" : `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const month = (value) => MONTHS[Number(value) - 1] || "—";

function payToForm(pay) {
  if (!pay) return { ...EMPTY_PAY };
  return {
    id: pay.id,
    name: pay.name || "",
    code: pay.code || "",
    payment_month: String(pay.payment_month),
    accrual_start_month: String(pay.accrual_start_month),
    accrual_end_month: String(pay.accrual_end_month),
    accrual_months: String(pay.accrual_months),
    proration_allowed: pay.proration_allowed !== false,
    proration_default: Boolean(pay.proration_default),
    notes: pay.notes || "",
  };
}

export default function AgreementExtraPayPanelV2({ agreement, onChanged }) {
  const tables = agreement?.salary_tables || [];
  const categories = agreement?.professional_categories || [];
  const defaultTable = tables.find((item) => item.status === "active") || tables[0] || null;

  const [open, setOpen] = useState(false);
  const [tableId, setTableId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [pays, setPays] = useState([]);
  const [selectedPayId, setSelectedPayId] = useState(null);
  const [payForm, setPayForm] = useState({ ...EMPTY_PAY });
  const [lineForm, setLineForm] = useState({ ...EMPTY_LINE });
  const [candidates, setCandidates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const table = useMemo(() => tables.find((item) => String(item.id) === String(tableId)) || defaultTable, [tables, tableId, defaultTable]);
  const category = useMemo(() => categories.find((item) => String(item.id) === String(categoryId)) || categories[0] || null, [categories, categoryId]);
  const selectedPay = useMemo(() => selectedPayId === null ? null : pays.find((item) => Number(item.id) === Number(selectedPayId)) || null, [pays, selectedPayId]);

  useEffect(() => {
    setTableId(defaultTable?.id ? String(defaultTable.id) : "");
    setCategoryId(categories[0]?.id ? String(categories[0].id) : "");
    setPays([]);
    setSelectedPayId(null);
    setPayForm({ ...EMPTY_PAY });
    setLineForm({ ...EMPTY_LINE });
    setPreview(null);
  }, [agreement?.id]);

  useEffect(() => {
    if (open && agreement?.id && table?.id) loadPays("first");
  }, [open, agreement?.id, table?.id]);

  useEffect(() => {
    if (!open || !agreement?.id || !table?.id || !category?.id) {
      setCandidates([]);
      return;
    }
    fetchAgreementExtraPayCandidates(agreement.id, table.id, category.id)
      .then(setCandidates)
      .catch((err) => setError(err.message || "No se pudieron cargar los conceptos."));
  }, [open, agreement?.id, table?.id, category?.id]);

  useEffect(() => {
    if (selectedPay) setPayForm(payToForm(selectedPay));
    setLineForm({ ...EMPTY_LINE });
    setPreview(null);
  }, [selectedPay?.id]);

  async function loadPays(mode = "keep", preferredId = null) {
    if (!agreement?.id || !table?.id) return;
    setBusy(true);
    setError("");
    try {
      const data = await fetchAgreementExtraPays(agreement.id, table.id);
      setPays(data);
      if (mode === "create") {
        setSelectedPayId(null);
        setPayForm({ ...EMPTY_PAY });
      } else if (preferredId !== null && data.some((item) => Number(item.id) === Number(preferredId))) {
        setSelectedPayId(Number(preferredId));
      } else if (mode === "first" || !data.some((item) => Number(item.id) === Number(selectedPayId))) {
        setSelectedPayId(data[0]?.id ?? null);
        if (!data.length) setPayForm({ ...EMPTY_PAY });
      }
    } catch (err) {
      setError(err.message || "No se pudieron cargar las pagas extraordinarias.");
    } finally {
      setBusy(false);
    }
  }

  function startNewPay() {
    setSelectedPayId(null);
    setPayForm({ ...EMPTY_PAY });
    setLineForm({ ...EMPTY_LINE });
    setPreview(null);
    setMessage("");
  }

  async function savePay(event) {
    event.preventDefault();
    if (!table?.id) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        salary_table_id: Number(table.id),
        code: payForm.code.trim() || null,
        name: payForm.name.trim(),
        payment_month: Number(payForm.payment_month),
        accrual_start_month: Number(payForm.accrual_start_month),
        accrual_end_month: Number(payForm.accrual_end_month),
        accrual_months: Number(payForm.accrual_months),
        proration_allowed: payForm.proration_allowed,
        proration_default: payForm.proration_allowed && payForm.proration_default,
        is_active: true,
        notes: payForm.notes.trim() || null,
      };
      const saved = payForm.id
        ? await updateAgreementExtraPay(payForm.id, payload)
        : await createAgreementExtraPay(agreement.id, { ...payload, concept_lines: [] });
      setMessage(payForm.id ? "Paga extraordinaria actualizada." : "Paga extraordinaria creada.");
      await loadPays("keep", saved.id);
      await onChanged?.();
    } catch (err) {
      setError(err.message || "No se pudo guardar la paga extraordinaria.");
    } finally {
      setBusy(false);
    }
  }

  async function removePay() {
    if (!selectedPay || !window.confirm(`¿Eliminar ${selectedPay.name} y todas sus reglas?`)) return;
    setBusy(true);
    try {
      await deleteAgreementExtraPay(selectedPay.id);
      setMessage("Paga extraordinaria eliminada.");
      await loadPays("first");
    } catch (err) {
      setError(err.message || "No se pudo eliminar la paga extraordinaria.");
    } finally {
      setBusy(false);
    }
  }

  function chooseCandidate(key) {
    const candidate = candidates.find((item) => item.concept_key === key);
    setLineForm((current) => ({ ...current, concept_key: key, concept_name: candidate?.name || "" }));
  }

  function editLine(line) {
    setLineForm({
      id: line.id,
      concept_key: line.concept_key,
      concept_name: line.concept_name,
      scope: line.professional_category_id ? "category" : "general",
      calculation_mode: line.calculation_mode,
      percentage: line.percentage ?? "100",
      fixed_amount: line.fixed_amount ?? "",
      display_order: String(line.display_order || 10),
      notes: line.notes || "",
    });
  }

  async function saveLine(event) {
    event.preventDefault();
    if (!selectedPay || !lineForm.concept_key) return setError("Selecciona un concepto salarial.");
    setBusy(true);
    setError("");
    try {
      const payload = {
        professional_category_id: lineForm.scope === "category" ? Number(category.id) : null,
        concept_key: lineForm.concept_key,
        concept_name: lineForm.concept_name,
        calculation_mode: lineForm.calculation_mode,
        percentage: lineForm.calculation_mode === "percentage" ? Number(lineForm.percentage || 0) : null,
        fixed_amount: lineForm.calculation_mode === "fixed" ? Number(lineForm.fixed_amount || 0) : null,
        is_active: true,
        display_order: Number(lineForm.display_order || 10),
        notes: lineForm.notes.trim() || null,
      };
      if (lineForm.id) await updateAgreementExtraPayConcept(lineForm.id, payload);
      else await createAgreementExtraPayConcept(selectedPay.id, payload);
      setMessage(lineForm.id ? "Participación actualizada." : "Concepto añadido a la paga.");
      setLineForm({ ...EMPTY_LINE });
      setPreview(null);
      await loadPays("keep", selectedPay.id);
    } catch (err) {
      setError(err.message || "No se pudo guardar la participación.");
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(line) {
    if (!window.confirm(`¿Excluir ${line.concept_name} de esta paga?`)) return;
    setBusy(true);
    try {
      await deleteAgreementExtraPayConcept(line.id);
      setMessage("Concepto eliminado de la paga.");
      setPreview(null);
      await loadPays("keep", selectedPay.id);
    } catch (err) {
      setError(err.message || "No se pudo eliminar el concepto.");
    } finally {
      setBusy(false);
    }
  }

  async function calculatePreview() {
    if (!selectedPay || !category || !table) return;
    setBusy(true);
    setError("");
    try {
      setPreview(await fetchAgreementExtraPayPreview(selectedPay.id, category.id, table.id));
    } catch (err) {
      setPreview(null);
      setError(err.message || "No se pudo calcular la vista previa.");
    } finally {
      setBusy(false);
    }
  }

  if (!tables.length) return null;

  return (
    <section style={s.box}>
      <header style={s.head}>
        <div><h3 style={s.title}>Pagas extraordinarias</h3><p style={s.sub}>Devengo, abono, prorrateo y conceptos computables por tabla salarial.</p></div>
        <button type="button" onClick={() => setOpen((value) => !value)} style={s.dark}>{open ? "Cerrar" : "Configurar pagas extra"}</button>
      </header>
      {open && <div style={s.body}>
        <div style={s.filters}>
          <Field label="Tabla salarial"><select value={table?.id || ""} onChange={(e) => { setTableId(e.target.value); setSelectedPayId(null); setPreview(null); }} style={s.input}>{tables.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.year || "sin año"}</option>)}</select></Field>
          <Field label="Categoría para configurar y simular"><select value={category?.id || ""} onChange={(e) => { setCategoryId(e.target.value); setPreview(null); }} style={s.input}>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        </div>
        {error && <div style={s.error}>{error}</div>}
        {message && <div style={s.ok}>{message}</div>}
        {busy && <div style={s.notice}>Procesando…</div>}

        <div style={s.layout}>
          <aside style={s.aside}>
            <div style={s.asideHead}><strong>Pagas configuradas</strong><button type="button" onClick={startNewPay} style={s.link}>Nueva paga</button></div>
            {pays.map((pay) => <button key={pay.id} type="button" onClick={() => setSelectedPayId(pay.id)} style={Number(selectedPayId) === Number(pay.id) ? s.payActive : s.pay}><span><strong>{pay.name}</strong><small>Abono: {month(pay.payment_month)}</small></span><em>{pay.concept_lines?.length || 0}</em></button>)}
            {!pays.length && <span style={s.empty}>No hay pagas configuradas.</span>}
          </aside>

          <main style={s.main}>
            <form onSubmit={savePay} style={s.card}>
              <div style={s.cardHead}><div><h4 style={s.cardTitle}>{payForm.id ? "Datos de la paga" : "Nueva paga extraordinaria"}</h4><p style={s.sub}>Configuración versionada para {table?.name}.</p></div>{payForm.id && <button type="button" onClick={removePay} style={s.danger}>Eliminar paga</button>}</div>
              <div style={s.grid}>
                <Field label="Denominación"><input required value={payForm.name} onChange={(e) => setPayForm({ ...payForm, name: e.target.value })} style={s.input} /></Field>
                <Field label="Código interno"><input value={payForm.code} onChange={(e) => setPayForm({ ...payForm, code: e.target.value })} style={s.input} placeholder="PAGA_VERANO" /></Field>
                <Field label="Mes de abono"><MonthSelect value={payForm.payment_month} onChange={(value) => setPayForm({ ...payForm, payment_month: value })} /></Field>
                <Field label="Inicio de devengo"><MonthSelect value={payForm.accrual_start_month} onChange={(value) => setPayForm({ ...payForm, accrual_start_month: value })} /></Field>
                <Field label="Fin de devengo"><MonthSelect value={payForm.accrual_end_month} onChange={(value) => setPayForm({ ...payForm, accrual_end_month: value })} /></Field>
                <Field label="Meses de devengo"><input type="number" min="1" max="12" value={payForm.accrual_months} onChange={(e) => setPayForm({ ...payForm, accrual_months: e.target.value })} style={s.input} /></Field>
                <label style={s.check}><input type="checkbox" checked={payForm.proration_allowed} onChange={(e) => setPayForm({ ...payForm, proration_allowed: e.target.checked, proration_default: e.target.checked && payForm.proration_default })} />Permite prorrateo</label>
                <label style={s.check}><input type="checkbox" disabled={!payForm.proration_allowed} checked={payForm.proration_default} onChange={(e) => setPayForm({ ...payForm, proration_default: e.target.checked })} />Prorrateada por defecto</label>
                <Field label="Observaciones"><textarea value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} style={s.textarea} /></Field>
                <button disabled={busy} style={s.dark}>{payForm.id ? "Actualizar paga" : "Crear paga"}</button>
              </div>
            </form>

            {selectedPay && <>
              <section style={s.card}>
                <div style={s.cardHead}><div><h4 style={s.cardTitle}>Conceptos incluidos</h4><p style={s.sub}>Las reglas de categoría prevalecen sobre las generales.</p></div></div>
                <div style={s.scroll}><table style={s.table}><thead><tr><th>Concepto</th><th>Ámbito</th><th>Cálculo</th><th>Valor</th><th>Acciones</th></tr></thead><tbody>
                  {(selectedPay.concept_lines || []).map((line) => <tr key={line.id}><td><strong>{line.concept_name}</strong></td><td>{line.professional_category_id ? categories.find((item) => item.id === line.professional_category_id)?.name || "Categoría" : "Todas"}</td><td>{line.calculation_mode === "fixed" ? "Fijo" : "Porcentaje"}</td><td>{line.calculation_mode === "fixed" ? money(line.fixed_amount) : `${Number(line.percentage || 0).toLocaleString("es-ES")} %`}</td><td><button type="button" onClick={() => editLine(line)} style={s.link}>Editar</button> <button type="button" onClick={() => removeLine(line)} style={s.redLink}>Eliminar</button></td></tr>)}
                  {!selectedPay.concept_lines?.length && <tr><td colSpan="5">Sin conceptos incluidos.</td></tr>}
                </tbody></table></div>
                <form onSubmit={saveLine} style={s.grid}>
                  <Field label="Concepto"><select required value={lineForm.concept_key} onChange={(e) => chooseCandidate(e.target.value)} style={s.input}><option value="">Seleccionar</option>{candidates.map((item) => <option key={item.concept_key} value={item.concept_key}>{item.name} · {money(item.amount)}</option>)}</select></Field>
                  <Field label="Ámbito"><select value={lineForm.scope} onChange={(e) => setLineForm({ ...lineForm, scope: e.target.value })} style={s.input}><option value="general">Todas las categorías</option><option value="category">Solo {category?.name}</option></select></Field>
                  <Field label="Cómputo"><select value={lineForm.calculation_mode} onChange={(e) => setLineForm({ ...lineForm, calculation_mode: e.target.value })} style={s.input}><option value="percentage">Porcentaje</option><option value="fixed">Importe fijo</option></select></Field>
                  {lineForm.calculation_mode === "percentage" ? <Field label="Porcentaje"><input type="number" min="0" max="1000" step="0.01" value={lineForm.percentage} onChange={(e) => setLineForm({ ...lineForm, percentage: e.target.value })} style={s.input} /></Field> : <Field label="Importe fijo"><input type="number" min="0" step="0.01" value={lineForm.fixed_amount} onChange={(e) => setLineForm({ ...lineForm, fixed_amount: e.target.value })} style={s.input} /></Field>}
                  <Field label="Orden"><input type="number" min="0" value={lineForm.display_order} onChange={(e) => setLineForm({ ...lineForm, display_order: e.target.value })} style={s.input} /></Field>
                  <button disabled={busy} style={s.light}>{lineForm.id ? "Actualizar" : "Añadir concepto"}</button>
                  {lineForm.id && <button type="button" onClick={() => setLineForm({ ...EMPTY_LINE })} style={s.link}>Cancelar edición</button>}
                </form>
              </section>

              <section style={s.card}>
                <div style={s.cardHead}><div><h4 style={s.cardTitle}>Vista previa: {category?.name}</h4><p style={s.sub}>Cálculo teórico según la tabla seleccionada.</p></div><button type="button" onClick={calculatePreview} style={s.yellow}>Calcular</button></div>
                {preview && <><div style={s.stats}><Stat label="Importe íntegro" value={money(preview.total_amount)} /><Stat label="Prorrata mensual" value={preview.proration_allowed ? money(preview.monthly_proration_amount) : "No permitida"} /><Stat label="Abono" value={month(preview.payment_month)} /><Stat label="Devengo" value={`${month(preview.accrual_start_month)} – ${month(preview.accrual_end_month)}`} /></div>
                  <div style={s.scroll}><table style={s.table}><thead><tr><th>Concepto</th><th>Base</th><th>Regla</th><th>Computa</th></tr></thead><tbody>{preview.lines.map((line) => <tr key={line.concept_line_id}><td><strong>{line.concept_name}</strong>{line.warning && <small style={s.warnText}>{line.warning}</small>}</td><td>{money(line.base_amount)}</td><td>{line.calculation_mode === "fixed" ? money(line.fixed_amount) : `${Number(line.percentage || 0).toLocaleString("es-ES")} %`}</td><td>{money(line.computed_amount)}</td></tr>)}</tbody></table></div>
                  {preview.warnings?.length > 0 && <div style={s.warning}>{preview.warnings.map((item) => <span key={item}>{item}</span>)}</div>}</>}
              </section>
            </>}
          </main>
        </div>
      </div>}
    </section>
  );
}

function Field({ label, children }) { return <label style={s.field}><span>{label}</span>{children}</label>; }
function MonthSelect({ value, onChange }) { return <select value={value} onChange={(e) => onChange(e.target.value)} style={s.input}>{MONTHS.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select>; }
function Stat({ label, value }) { return <div style={s.stat}><span>{label}</span><strong>{value}</strong></div>; }

const cell = { padding: "7px", borderBottom: "1px solid #e5e7eb", textAlign: "left", fontSize: "11px", verticalAlign: "top" };
const s = {
  box: { border: "1px solid #d1d5db", background: "#fff" }, head: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f9fafb" }, title: { margin: 0, fontSize: "15px", fontWeight: 850 }, sub: { margin: "3px 0 0", color: "#6b7280", fontSize: "11px" }, body: { borderTop: "1px solid #e5e7eb", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }, filters: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "10px" }, layout: { display: "grid", gridTemplateColumns: "250px minmax(0, 1fr)", border: "1px solid #e5e7eb" }, aside: { background: "#f9fafb", borderRight: "1px solid #e5e7eb", padding: "10px", display: "flex", flexDirection: "column", gap: "5px" }, asideHead: { display: "flex", justifyContent: "space-between", padding: "4px 2px 8px", fontSize: "12px" }, pay: { border: "1px solid transparent", background: "transparent", padding: "9px", display: "flex", justifyContent: "space-between", textAlign: "left", cursor: "pointer" }, payActive: { border: "1px solid #eab308", borderLeft: "3px solid #eab308", background: "#fffbeb", padding: "9px", display: "flex", justifyContent: "space-between", textAlign: "left", cursor: "pointer" }, main: { padding: "12px", display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }, card: { border: "1px solid #e5e7eb", padding: "12px" }, cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }, cardTitle: { margin: 0, fontSize: "14px", fontWeight: 850 }, grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "9px", alignItems: "end" }, field: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "11px", fontWeight: 800 }, input: { width: "100%", height: "34px", boxSizing: "border-box", border: "1px solid #d1d5db", padding: "6px 8px", background: "#fff" }, textarea: { width: "100%", minHeight: "62px", boxSizing: "border-box", border: "1px solid #d1d5db", padding: "7px" }, check: { display: "flex", alignItems: "center", gap: "7px", minHeight: "34px", fontSize: "11px", fontWeight: 750 }, dark: { height: "34px", border: "1px solid #111827", background: "#111827", color: "#fff", padding: "0 12px", fontSize: "11px", fontWeight: 850, cursor: "pointer" }, light: { height: "34px", border: "1px solid #d1d5db", background: "#fff", padding: "0 11px", fontSize: "11px", fontWeight: 800, cursor: "pointer" }, yellow: { height: "32px", border: "1px solid #eab308", background: "#facc15", padding: "0 11px", fontSize: "11px", fontWeight: 850, cursor: "pointer" }, danger: { border: "1px solid #fecaca", background: "#fff", color: "#b91c1c", height: "30px", padding: "0 9px", fontSize: "11px", fontWeight: 800, cursor: "pointer" }, link: { border: 0, background: "transparent", padding: 0, textDecoration: "underline", fontSize: "11px", cursor: "pointer" }, redLink: { border: 0, background: "transparent", padding: 0, color: "#b91c1c", textDecoration: "underline", fontSize: "11px", cursor: "pointer" }, scroll: { overflowX: "auto" }, table: { width: "100%", minWidth: "660px", borderCollapse: "collapse" }, stats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", marginBottom: "10px" }, stat: { border: "1px solid #e5e7eb", padding: "9px", display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px" }, error: { padding: "9px", border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: "11px" }, ok: { padding: "9px", border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontSize: "11px" }, notice: { padding: "9px", border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: "11px" }, warning: { padding: "9px", border: "1px solid #fde68a", background: "#fffbeb", color: "#78350f", display: "flex", flexDirection: "column", gap: "3px", fontSize: "11px" }, warnText: { display: "block", color: "#b45309", fontSize: "9px" }, empty: { padding: "10px 2px", color: "#6b7280", fontSize: "11px" },
};
Object.assign(s.table, { fontSize: "11px" });
Object.assign(s, { th: cell, td: cell });
