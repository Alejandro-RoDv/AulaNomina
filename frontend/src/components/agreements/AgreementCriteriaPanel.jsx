import { useEffect, useMemo, useState } from "react";

import {
  createAgreementRuleDetail,
  createAgreementRuleHeader,
  deleteAgreementRuleDetail,
  fetchAgreementParameterization,
  seedAgreementParameterization,
  updateAgreementRuleDetail,
  updateAgreementRuleHeader,
} from "../../services/collectiveAgreementApi";

const SECTION_META = [
  { id: "smi", title: "SMI e IPREM", description: "Valores de referencia utilizados por el convenio." },
  { id: "extra-pay", title: "Pagas extraordinarias", description: "Devengo, pago, prorrateo y tratamiento durante IT." },
  { id: "arrears", title: "Atrasos", description: "Criterios para diferencias salariales y retroactividad." },
  { id: "contracting", title: "Contratación", description: "Duraciones máximas, prórrogas y contratos específicos." },
  { id: "probation", title: "Período de prueba", description: "Duración máxima por grupo o categoría profesional." },
  { id: "it", title: "Complementos de IT", description: "Tramos, porcentajes, contingencias y límites." },
];

const EMPTY_SMI = { year: new Date().getFullYear(), smi_diario: "", smi_mensual: "", iprem_diario: "", iprem_mensual: "" };
const EMPTY_EXTRA_PAY = {
  prorrateable: false,
  contributes: true,
  earns_during_it: false,
  cra_code: "0042",
  summer_name: "Paga extraordinaria de verano",
  summer_accrual_from: "01-01",
  summer_accrual_to: "06-30",
  summer_payment_date: "07-15",
  christmas_name: "Paga extraordinaria de Navidad",
  christmas_accrual_from: "07-01",
  christmas_accrual_to: "12-31",
  christmas_payment_date: "12-15",
};
const EMPTY_ARREARS = { enabled: true, prescription_months: "12", calculation_basis: "diferencias_salariales", includes_contributions: true, notes: "" };
const EMPTY_IT_DETAIL = { id: null, from_day: "1", to_day: "15", percentage: "100", contingency: "comun", base_reference: "base_reguladora", limit_percentage: "100", notes: "" };
const EMPTY_CONTRACT_DETAIL = { id: null, contract_type: "", category_id: "", max_duration_months: "", max_extensions: "", notes: "" };
const EMPTY_PROBATION_DETAIL = { id: null, category_id: "", duration: "", unit: "months", notes: "" };

function numberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function findRule(data, code) {
  return (data?.rule_headers || []).find((rule) => rule.code === code) || null;
}

function normalizeExtraPayOptions(options = {}) {
  const legacyPayments = Array.isArray(options.pagas) ? options.pagas : [];
  const structured = legacyPayments.filter((item) => item && typeof item === "object");
  const summer = structured.find((item) => item.key === "summer" || String(item.payment_date || "").startsWith("07"));
  const christmas = structured.find((item) => item.key === "christmas" || String(item.payment_date || "").startsWith("12"));
  return {
    ...EMPTY_EXTRA_PAY,
    prorrateable: Boolean(options.prorrateable ?? options.prorrateo),
    contributes: options.contributes ?? options.cotizacion ?? true,
    earns_during_it: Boolean(options.earns_during_it ?? options.devenga_it),
    cra_code: options.cra_code || options.codigo_cra || "0042",
    summer_name: summer?.name || EMPTY_EXTRA_PAY.summer_name,
    summer_accrual_from: summer?.accrual_from || EMPTY_EXTRA_PAY.summer_accrual_from,
    summer_accrual_to: summer?.accrual_to || EMPTY_EXTRA_PAY.summer_accrual_to,
    summer_payment_date: summer?.payment_date || EMPTY_EXTRA_PAY.summer_payment_date,
    christmas_name: christmas?.name || EMPTY_EXTRA_PAY.christmas_name,
    christmas_accrual_from: christmas?.accrual_from || EMPTY_EXTRA_PAY.christmas_accrual_from,
    christmas_accrual_to: christmas?.accrual_to || EMPTY_EXTRA_PAY.christmas_accrual_to,
    christmas_payment_date: christmas?.payment_date || EMPTY_EXTRA_PAY.christmas_payment_date,
  };
}

function mapItDetail(detail) {
  return {
    id: detail.id,
    from_day: detail.minimum_value ?? "",
    to_day: detail.maximum_value ?? "",
    percentage: detail.percentage ?? "",
    contingency: detail.options?.contingency || "comun",
    base_reference: detail.options?.base_reference || "base_reguladora",
    limit_percentage: detail.options?.limit_percentage ?? "",
    notes: detail.notes || "",
  };
}

function mapContractDetail(detail) {
  return {
    id: detail.id,
    contract_type: detail.name || "",
    category_id: detail.options?.category_id || "",
    max_duration_months: detail.maximum_value ?? "",
    max_extensions: detail.options?.max_extensions ?? "",
    notes: detail.notes || "",
  };
}

function mapProbationDetail(detail) {
  return {
    id: detail.id,
    category_id: detail.options?.category_id || "",
    duration: detail.maximum_value ?? "",
    unit: detail.options?.unit || "months",
    notes: detail.notes || "",
  };
}

export default function AgreementCriteriaPanel({ agreement, categories = [], onOpenTab }) {
  const [data, setData] = useState(null);
  const [activeSection, setActiveSection] = useState("index");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [smiForm, setSmiForm] = useState(EMPTY_SMI);
  const [extraPayForm, setExtraPayForm] = useState(EMPTY_EXTRA_PAY);
  const [arrearsForm, setArrearsForm] = useState(EMPTY_ARREARS);
  const [itForm, setItForm] = useState(EMPTY_IT_DETAIL);
  const [contractForm, setContractForm] = useState(EMPTY_CONTRACT_DETAIL);
  const [probationForm, setProbationForm] = useState(EMPTY_PROBATION_DETAIL);

  const smiRule = useMemo(() => findRule(data, "SMI_IPREM"), [data]);
  const extraPayRule = useMemo(() => findRule(data, "PEXTRA"), [data]);
  const arrearsRule = useMemo(() => findRule(data, "ATRASOS"), [data]);
  const itRule = useMemo(() => findRule(data, "IT"), [data]);
  const contractingRule = useMemo(() => findRule(data, "CONTRATACION"), [data]);
  const probationRule = useMemo(() => findRule(data, "PERIODO_PRUEBA"), [data]);
  const vacationRule = useMemo(() => findRule(data, "VAC_AUTO"), [data]);
  const seniorityRule = useMemo(() => findRule(data, "ANT"), [data]);

  async function load() {
    if (!agreement?.id) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchAgreementParameterization(agreement.id);
      setData(result);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los criterios del convenio.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setActiveSection("index");
    setMessage("");
    setError("");
    load();
  }, [agreement?.id]);

  useEffect(() => {
    setSmiForm({ ...EMPTY_SMI, ...(smiRule?.options || {}) });
  }, [smiRule?.id, data]);

  useEffect(() => {
    setExtraPayForm(normalizeExtraPayOptions(extraPayRule?.options));
  }, [extraPayRule?.id, data]);

  useEffect(() => {
    setArrearsForm({ ...EMPTY_ARREARS, ...(arrearsRule?.options || {}) });
  }, [arrearsRule?.id, data]);

  async function initializeCriteria() {
    setSaving(true);
    setError("");
    try {
      await seedAgreementParameterization(agreement.id);
      setMessage("Criterios básicos preparados para este convenio.");
      await load();
    } catch (err) {
      setError(err.message || "No se pudieron preparar los criterios.");
    } finally {
      setSaving(false);
    }
  }

  async function ensureRule(rule, definition) {
    if (rule) return rule;
    return createAgreementRuleHeader(agreement.id, {
      rule_type: definition.rule_type,
      code: definition.code,
      name: definition.name,
      scope: "global",
      is_active: true,
      is_default: false,
      options: definition.options || {},
      details: [],
    });
  }

  async function saveRuleOptions(rule, definition, options, successMessage) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const target = await ensureRule(rule, definition);
      await updateAgreementRuleHeader(target.id, { options });
      setMessage(successMessage);
      await load();
    } catch (err) {
      setError(err.message || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSmi(event) {
    event.preventDefault();
    await saveRuleOptions(
      smiRule,
      { rule_type: "smi_iprem", code: "SMI_IPREM", name: "SMI e IPREM" },
      {
        year: Number(smiForm.year) || new Date().getFullYear(),
        smi_diario: numberOrNull(smiForm.smi_diario),
        smi_mensual: numberOrNull(smiForm.smi_mensual),
        iprem_diario: numberOrNull(smiForm.iprem_diario),
        iprem_mensual: numberOrNull(smiForm.iprem_mensual),
      },
      "Valores SMI e IPREM guardados."
    );
  }

  async function saveExtraPay(event) {
    event.preventDefault();
    await saveRuleOptions(
      extraPayRule,
      { rule_type: "extra_pay_automation", code: "PEXTRA", name: "Pagas extraordinarias" },
      {
        prorrateable: extraPayForm.prorrateable,
        contributes: extraPayForm.contributes,
        earns_during_it: extraPayForm.earns_during_it,
        cra_code: extraPayForm.cra_code || null,
        pagas: [
          {
            key: "summer",
            name: extraPayForm.summer_name,
            accrual_from: extraPayForm.summer_accrual_from,
            accrual_to: extraPayForm.summer_accrual_to,
            payment_date: extraPayForm.summer_payment_date,
          },
          {
            key: "christmas",
            name: extraPayForm.christmas_name,
            accrual_from: extraPayForm.christmas_accrual_from,
            accrual_to: extraPayForm.christmas_accrual_to,
            payment_date: extraPayForm.christmas_payment_date,
          },
        ],
      },
      "Configuración de pagas extraordinarias guardada."
    );
  }

  async function saveArrears(event) {
    event.preventDefault();
    await saveRuleOptions(
      arrearsRule,
      { rule_type: "arrears", code: "ATRASOS", name: "Atrasos" },
      {
        enabled: arrearsForm.enabled,
        prescription_months: numberOrNull(arrearsForm.prescription_months),
        calculation_basis: arrearsForm.calculation_basis,
        includes_contributions: arrearsForm.includes_contributions,
        notes: arrearsForm.notes || null,
      },
      "Criterios de atrasos guardados."
    );
  }

  async function saveDetail(event, type) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let rule;
      let form;
      let payload;
      let reset;
      let success;

      if (type === "it") {
        rule = await ensureRule(itRule, { rule_type: "it_complement", code: "IT", name: "Complementos IT" });
        form = itForm;
        payload = {
          detail_type: "it_bracket",
          code: `IT_${form.from_day || 0}_${form.to_day || "FIN"}`,
          name: `Del día ${form.from_day || "—"} al ${form.to_day || "final"}`,
          minimum_value: numberOrNull(form.from_day),
          maximum_value: numberOrNull(form.to_day),
          percentage: numberOrNull(form.percentage),
          options: {
            contingency: form.contingency,
            base_reference: form.base_reference,
            limit_percentage: numberOrNull(form.limit_percentage),
          },
          notes: form.notes || null,
          is_active: true,
          display_order: Number(form.from_day) || 0,
        };
        reset = () => setItForm(EMPTY_IT_DETAIL);
        success = "Tramo de complemento IT guardado.";
      } else if (type === "contracting") {
        rule = await ensureRule(contractingRule, { rule_type: "contracting", code: "CONTRATACION", name: "Contratación" });
        form = contractForm;
        payload = {
          detail_type: "contracting_rule",
          code: `CONTR_${Date.now()}`,
          name: form.contract_type,
          maximum_value: numberOrNull(form.max_duration_months),
          options: {
            category_id: form.category_id ? Number(form.category_id) : null,
            max_extensions: numberOrNull(form.max_extensions),
          },
          notes: form.notes || null,
          is_active: true,
          display_order: 0,
        };
        reset = () => setContractForm(EMPTY_CONTRACT_DETAIL);
        success = "Criterio de contratación guardado.";
      } else {
        rule = await ensureRule(probationRule, { rule_type: "probation_period", code: "PERIODO_PRUEBA", name: "Período de prueba" });
        form = probationForm;
        const category = categories.find((item) => String(item.id) === String(form.category_id));
        payload = {
          detail_type: "probation_period",
          code: `PRUEBA_${form.category_id || Date.now()}`,
          name: category?.name || "Regla general",
          maximum_value: numberOrNull(form.duration),
          options: {
            category_id: form.category_id ? Number(form.category_id) : null,
            unit: form.unit,
          },
          notes: form.notes || null,
          is_active: true,
          display_order: 0,
        };
        reset = () => setProbationForm(EMPTY_PROBATION_DETAIL);
        success = "Período de prueba guardado.";
      }

      if (form.id) await updateAgreementRuleDetail(form.id, payload);
      else await createAgreementRuleDetail(rule.id, payload);
      reset();
      setMessage(success);
      await load();
    } catch (err) {
      setError(err.message || "No se pudo guardar el criterio.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDetail(detailId, label) {
    if (!window.confirm(`¿Eliminar ${label}?`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteAgreementRuleDetail(detailId);
      setMessage(`${label} eliminado.`);
      await load();
    } catch (err) {
      setError(err.message || "No se pudo eliminar el criterio.");
    } finally {
      setSaving(false);
    }
  }

  const hasBaseRules = Boolean(data?.rule_headers?.length);

  return (
    <section style={styles.wrapper}>
      <header style={styles.header}>
        <div>
          <h3 style={styles.title}>Criterios del convenio</h3>
          <p style={styles.subtitle}>Configuración laboral utilizada por contratos, incidencias y nóminas simuladas.</p>
        </div>
        {activeSection !== "index" && <button type="button" onClick={() => setActiveSection("index")} style={styles.secondaryButton}>Volver al índice</button>}
      </header>

      {loading && <Feedback tone="neutral">Cargando criterios…</Feedback>}
      {error && <Feedback tone="error">{error}</Feedback>}
      {message && <Feedback tone="success">{message}</Feedback>}

      {!loading && !hasBaseRules && (
        <div style={styles.initializeBox}>
          <div><strong>Este convenio aún no tiene criterios configurados.</strong><span>Prepara la estructura inicial y después completa únicamente los apartados que correspondan.</span></div>
          <button type="button" onClick={initializeCriteria} disabled={saving} style={styles.primaryButton}>{saving ? "Preparando…" : "Preparar criterios"}</button>
        </div>
      )}

      {activeSection === "index" && (
        <div style={styles.indexGrid}>
          <IndexCard title="Antigüedad" description="Importes, vencimientos y criterios por categoría." summary={seniorityRule ? "Criterio general informado" : "Pendiente de configurar"} onClick={() => onOpenTab?.("seniority")} buttonLabel="Abrir antigüedad" />
          <IndexCard title="Vacaciones" description="Días, devengo y reglas asociadas a jornada y permisos." summary={vacationRule ? `${vacationRule.options?.numero_dias || "—"} días ${vacationRule.options?.tipo_dias || ""}` : "Pendiente de configurar"} onClick={() => onOpenTab?.("rules")} buttonLabel="Abrir vacaciones" />
          {SECTION_META.map((section) => {
            const summaries = {
              smi: smiRule ? `Ejercicio ${smiRule.options?.year || "sin indicar"}` : "Pendiente de configurar",
              "extra-pay": extraPayRule ? `${normalizeExtraPayOptions(extraPayRule.options).prorrateable ? "Prorrateables" : "No prorrateables"}` : "Pendiente de configurar",
              arrears: arrearsRule?.options?.enabled === false ? "No aplicable" : arrearsRule ? "Aplicable" : "Pendiente de configurar",
              contracting: `${contractingRule?.details?.length || 0} reglas registradas`,
              probation: `${probationRule?.details?.length || 0} reglas registradas`,
              it: `${itRule?.details?.length || 0} tramos registrados`,
            };
            return <IndexCard key={section.id} {...section} summary={summaries[section.id]} onClick={() => setActiveSection(section.id)} buttonLabel="Configurar" />;
          })}
        </div>
      )}

      {activeSection === "smi" && <SmiForm form={smiForm} setForm={setSmiForm} onSubmit={saveSmi} saving={saving} />}
      {activeSection === "extra-pay" && <ExtraPayForm form={extraPayForm} setForm={setExtraPayForm} onSubmit={saveExtraPay} saving={saving} />}
      {activeSection === "arrears" && <ArrearsForm form={arrearsForm} setForm={setArrearsForm} onSubmit={saveArrears} saving={saving} />}
      {activeSection === "it" && <ItSection rule={itRule} form={itForm} setForm={setItForm} onSubmit={(event) => saveDetail(event, "it")} onDelete={removeDetail} saving={saving} />}
      {activeSection === "contracting" && <ContractingSection rule={contractingRule} form={contractForm} setForm={setContractForm} categories={categories} onSubmit={(event) => saveDetail(event, "contracting")} onDelete={removeDetail} saving={saving} />}
      {activeSection === "probation" && <ProbationSection rule={probationRule} form={probationForm} setForm={setProbationForm} categories={categories} onSubmit={(event) => saveDetail(event, "probation")} onDelete={removeDetail} saving={saving} />}
    </section>
  );
}

function IndexCard({ title, description, summary, onClick, buttonLabel }) {
  return <article style={styles.indexCard}><div><h4 style={styles.cardTitle}>{title}</h4><p style={styles.cardDescription}>{description}</p></div><div style={styles.cardFooter}><span style={styles.cardSummary}>{summary}</span><button type="button" onClick={onClick} style={styles.linkButton}>{buttonLabel}</button></div></article>;
}

function SmiForm({ form, setForm, onSubmit, saving }) {
  return <Panel title="SMI e IPREM" subtitle="Valores de referencia del ejercicio. No se actualizan automáticamente desde fuentes externas."><form onSubmit={onSubmit} style={styles.formGrid}><Field label="Ejercicio"><input type="number" style={styles.input} value={form.year || ""} onChange={(event) => setForm({ ...form, year: event.target.value })} /></Field><Field label="SMI diario"><MoneyInput value={form.smi_diario} onChange={(value) => setForm({ ...form, smi_diario: value })} /></Field><Field label="SMI mensual"><MoneyInput value={form.smi_mensual} onChange={(value) => setForm({ ...form, smi_mensual: value })} /></Field><Field label="IPREM diario"><MoneyInput value={form.iprem_diario} onChange={(value) => setForm({ ...form, iprem_diario: value })} /></Field><Field label="IPREM mensual"><MoneyInput value={form.iprem_mensual} onChange={(value) => setForm({ ...form, iprem_mensual: value })} /></Field><SaveButton saving={saving} /></form></Panel>;
}

function ExtraPayForm({ form, setForm, onSubmit, saving }) {
  return <Panel title="Pagas extraordinarias" subtitle="Configura las pagas previstas en el convenio y sus períodos de devengo."><form onSubmit={onSubmit}><div style={styles.formGrid}><Field label="Código CRA"><input style={styles.input} value={form.cra_code || ""} onChange={(event) => setForm({ ...form, cra_code: event.target.value })} /></Field><Check label="Permite prorrateo" checked={form.prorrateable} onChange={(checked) => setForm({ ...form, prorrateable: checked })} /><Check label="Cotiza" checked={form.contributes} onChange={(checked) => setForm({ ...form, contributes: checked })} /><Check label="Devenga durante IT" checked={form.earns_during_it} onChange={(checked) => setForm({ ...form, earns_during_it: checked })} /></div><h4 style={styles.subheading}>Pagas previstas</h4><div style={styles.payGrid}><PayCard title="Verano" prefix="summer" form={form} setForm={setForm} /><PayCard title="Navidad" prefix="christmas" form={form} setForm={setForm} /></div><div style={styles.actions}><SaveButton saving={saving} /></div></form></Panel>;
}

function PayCard({ title, prefix, form, setForm }) {
  const update = (field, value) => setForm({ ...form, [`${prefix}_${field}`]: value });
  return <div style={styles.subCard}><h5 style={styles.subCardTitle}>{title}</h5><Field label="Denominación"><input style={styles.input} value={form[`${prefix}_name`] || ""} onChange={(event) => update("name", event.target.value)} /></Field><div style={styles.compactGrid}><Field label="Devengo desde"><input style={styles.input} placeholder="MM-DD" value={form[`${prefix}_accrual_from`] || ""} onChange={(event) => update("accrual_from", event.target.value)} /></Field><Field label="Devengo hasta"><input style={styles.input} placeholder="MM-DD" value={form[`${prefix}_accrual_to`] || ""} onChange={(event) => update("accrual_to", event.target.value)} /></Field><Field label="Fecha de pago"><input style={styles.input} placeholder="MM-DD" value={form[`${prefix}_payment_date`] || ""} onChange={(event) => update("payment_date", event.target.value)} /></Field></div></div>;
}

function ArrearsForm({ form, setForm, onSubmit, saving }) {
  return <Panel title="Atrasos" subtitle="Criterios generales para regularizaciones derivadas del convenio."><form onSubmit={onSubmit} style={styles.formGrid}><Check label="Aplicar cálculo de atrasos" checked={form.enabled} onChange={(checked) => setForm({ ...form, enabled: checked })} /><Field label="Período máximo revisable (meses)"><input type="number" style={styles.input} value={form.prescription_months || ""} onChange={(event) => setForm({ ...form, prescription_months: event.target.value })} /></Field><Field label="Base de cálculo"><select style={styles.input} value={form.calculation_basis || "diferencias_salariales"} onChange={(event) => setForm({ ...form, calculation_basis: event.target.value })}><option value="diferencias_salariales">Diferencias salariales</option><option value="tabla_salarial">Nueva tabla salarial</option><option value="porcentaje">Porcentaje de incremento</option><option value="manual">Cálculo manual</option></select></Field><Check label="Regularizar cotización" checked={form.includes_contributions} onChange={(checked) => setForm({ ...form, includes_contributions: checked })} /><Field label="Observaciones"><textarea style={styles.textarea} value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field><SaveButton saving={saving} /></form></Panel>;
}

function ItSection({ rule, form, setForm, onSubmit, onDelete, saving }) {
  const rows = rule?.details || [];
  return <Panel title="Complementos de incapacidad temporal" subtitle="Define el porcentaje complementado por períodos y contingencias."><DetailTable columns={["Desde", "Hasta", "Contingencia", "% complemento", "Base", "Límite", "Acciones"]} rows={rows.map((detail) => [detail.minimum_value ?? "—", detail.maximum_value ?? "Fin", detail.options?.contingency === "profesional" ? "Profesional" : "Común", detail.percentage != null ? `${detail.percentage} %` : "—", formatBase(detail.options?.base_reference), detail.options?.limit_percentage != null ? `${detail.options.limit_percentage} %` : "—", <RowActions key={detail.id} onEdit={() => setForm(mapItDetail(detail))} onDelete={() => onDelete(detail.id, "el tramo de IT")} />])} empty="Sin tramos de IT configurados." /><DetailForm title={form.id ? "Editar tramo" : "Nuevo tramo"} onSubmit={onSubmit}><Field label="Desde el día"><input type="number" style={styles.input} value={form.from_day} onChange={(event) => setForm({ ...form, from_day: event.target.value })} required /></Field><Field label="Hasta el día"><input type="number" style={styles.input} value={form.to_day} onChange={(event) => setForm({ ...form, to_day: event.target.value })} /></Field><Field label="Contingencia"><select style={styles.input} value={form.contingency} onChange={(event) => setForm({ ...form, contingency: event.target.value })}><option value="comun">Contingencia común</option><option value="profesional">Accidente de trabajo / enfermedad profesional</option><option value="ambas">Ambas</option></select></Field><Field label="Porcentaje complementado"><input type="number" step="0.01" style={styles.input} value={form.percentage} onChange={(event) => setForm({ ...form, percentage: event.target.value })} /></Field><Field label="Base de referencia"><select style={styles.input} value={form.base_reference} onChange={(event) => setForm({ ...form, base_reference: event.target.value })}><option value="base_reguladora">Base reguladora</option><option value="salario_convenio">Salario de convenio</option><option value="retribucion_fija">Retribución fija</option></select></Field><Field label="Límite máximo"><input type="number" step="0.01" style={styles.input} value={form.limit_percentage} onChange={(event) => setForm({ ...form, limit_percentage: event.target.value })} /></Field><Field label="Observaciones"><textarea style={styles.textarea} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field><SaveButton saving={saving} label={form.id ? "Actualizar tramo" : "Añadir tramo"} /></DetailForm></Panel>;
}

function ContractingSection({ rule, form, setForm, categories, onSubmit, onDelete, saving }) {
  const rows = rule?.details || [];
  return <Panel title="Contratación" subtitle="Condiciones específicas que el convenio establece para determinadas modalidades contractuales."><DetailTable columns={["Modalidad", "Categoría", "Duración máxima", "Prórrogas", "Observaciones", "Acciones"]} rows={rows.map((detail) => [detail.name, categoryName(categories, detail.options?.category_id), detail.maximum_value != null ? `${detail.maximum_value} meses` : "—", detail.options?.max_extensions ?? "—", detail.notes || "—", <RowActions key={detail.id} onEdit={() => setForm(mapContractDetail(detail))} onDelete={() => onDelete(detail.id, "el criterio de contratación")} />])} empty="Sin criterios específicos de contratación." /><DetailForm title={form.id ? "Editar criterio" : "Nuevo criterio de contratación"} onSubmit={onSubmit}><Field label="Modalidad o supuesto"><input style={styles.input} value={form.contract_type} onChange={(event) => setForm({ ...form, contract_type: event.target.value })} required /></Field><CategoryField categories={categories} value={form.category_id} onChange={(value) => setForm({ ...form, category_id: value })} /><Field label="Duración máxima (meses)"><input type="number" style={styles.input} value={form.max_duration_months} onChange={(event) => setForm({ ...form, max_duration_months: event.target.value })} /></Field><Field label="Número máximo de prórrogas"><input type="number" style={styles.input} value={form.max_extensions} onChange={(event) => setForm({ ...form, max_extensions: event.target.value })} /></Field><Field label="Observaciones"><textarea style={styles.textarea} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field><SaveButton saving={saving} label={form.id ? "Actualizar criterio" : "Añadir criterio"} /></DetailForm></Panel>;
}

function ProbationSection({ rule, form, setForm, categories, onSubmit, onDelete, saving }) {
  const rows = rule?.details || [];
  return <Panel title="Período de prueba" subtitle="Duración máxima aplicable por categoría profesional."><DetailTable columns={["Categoría", "Duración", "Unidad", "Observaciones", "Acciones"]} rows={rows.map((detail) => [categoryName(categories, detail.options?.category_id) || detail.name, detail.maximum_value ?? "—", detail.options?.unit === "days" ? "Días" : "Meses", detail.notes || "—", <RowActions key={detail.id} onEdit={() => setForm(mapProbationDetail(detail))} onDelete={() => onDelete(detail.id, "el período de prueba")} />])} empty="Sin períodos de prueba configurados." /><DetailForm title={form.id ? "Editar período" : "Nuevo período de prueba"} onSubmit={onSubmit}><CategoryField categories={categories} value={form.category_id} onChange={(value) => setForm({ ...form, category_id: value })} /><Field label="Duración máxima"><input type="number" style={styles.input} value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required /></Field><Field label="Unidad"><select style={styles.input} value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option value="days">Días</option><option value="months">Meses</option></select></Field><Field label="Observaciones"><textarea style={styles.textarea} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field><SaveButton saving={saving} label={form.id ? "Actualizar período" : "Añadir período"} /></DetailForm></Panel>;
}

function Panel({ title, subtitle, children }) { return <section style={styles.panel}><header style={styles.panelHeader}><h4 style={styles.panelTitle}>{title}</h4><p style={styles.panelSubtitle}>{subtitle}</p></header><div style={styles.panelBody}>{children}</div></section>; }
function DetailForm({ title, onSubmit, children }) { return <form onSubmit={onSubmit} style={styles.detailForm}><h5 style={styles.detailTitle}>{title}</h5><div style={styles.formGrid}>{children}</div></form>; }
function Field({ label, children }) { return <label style={styles.field}><span>{label}</span>{children}</label>; }
function MoneyInput({ value, onChange }) { return <div style={styles.moneyWrap}><input type="number" step="0.01" style={styles.input} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /><span>€</span></div>; }
function Check({ label, checked, onChange }) { return <label style={styles.check}><input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>; }
function SaveButton({ saving, label = "Guardar" }) { return <button type="submit" disabled={saving} style={styles.primaryButton}>{saving ? "Guardando…" : label}</button>; }
function CategoryField({ categories, value, onChange }) { return <Field label="Categoría profesional"><select style={styles.input} value={value || ""} onChange={(event) => onChange(event.target.value)}><option value="">Aplicación general</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>; }
function Feedback({ tone, children }) { return <div style={{ ...styles.feedback, ...(tone === "error" ? styles.feedbackError : tone === "success" ? styles.feedbackSuccess : {}) }}>{children}</div>; }
function RowActions({ onEdit, onDelete }) { return <div style={styles.rowActions}><button type="button" onClick={onEdit} style={styles.tableLink}>Editar</button><button type="button" onClick={onDelete} style={styles.deleteLink}>Eliminar</button></div>; }
function DetailTable({ columns, rows, empty }) { return <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{columns.map((column) => <th key={column} style={styles.th}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} style={styles.td}>{cell}</td>)}</tr>)}{rows.length === 0 && <tr><td colSpan={columns.length} style={styles.emptyCell}>{empty}</td></tr>}</tbody></table></div>; }
function categoryName(categories, categoryId) { if (!categoryId) return "Aplicación general"; return categories.find((item) => Number(item.id) === Number(categoryId))?.name || "Categoría no disponible"; }
function formatBase(value) { if (value === "salario_convenio") return "Salario convenio"; if (value === "retribucion_fija") return "Retribución fija"; return "Base reguladora"; }

const styles = {
  wrapper: { border: "1px solid #e5e7eb", backgroundColor: "#fff" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "12px 14px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" },
  title: { margin: 0, fontSize: "16px", fontWeight: 850, color: "#111827" },
  subtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "12px", fontWeight: 600 },
  indexGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px", padding: "14px" },
  indexCard: { minHeight: "150px", border: "1px solid #d1d5db", backgroundColor: "#fff", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "16px" },
  cardTitle: { margin: 0, fontSize: "15px", fontWeight: 850, color: "#111827" },
  cardDescription: { margin: "5px 0 0", color: "#4b5563", fontSize: "12px", lineHeight: 1.45 },
  cardFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", borderTop: "1px solid #f3f4f6", paddingTop: "10px" },
  cardSummary: { color: "#6b7280", fontSize: "11px", fontWeight: 750 },
  linkButton: { border: 0, backgroundColor: "transparent", color: "#374151", padding: 0, fontWeight: 800, fontSize: "12px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" },
  panel: { margin: "14px", border: "1px solid #d1d5db", backgroundColor: "#fff" },
  panelHeader: { padding: "12px", borderBottom: "1px solid #e5e7eb", backgroundColor: "#f9fafb" },
  panelTitle: { margin: 0, fontSize: "15px", fontWeight: 850 },
  panelSubtitle: { margin: "3px 0 0", color: "#6b7280", fontSize: "12px" },
  panelBody: { padding: "12px" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", alignItems: "end" },
  compactGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" },
  payGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" },
  subCard: { border: "1px solid #e5e7eb", backgroundColor: "#f9fafb", padding: "12px" },
  subCardTitle: { margin: "0 0 10px", fontSize: "13px", fontWeight: 850 },
  subheading: { margin: "16px 0 8px", fontSize: "13px", fontWeight: 850 },
  field: { display: "flex", flexDirection: "column", gap: "5px", minWidth: 0, color: "#374151", fontSize: "12px", fontWeight: 750 },
  input: { width: "100%", minWidth: 0, boxSizing: "border-box", height: "34px", border: "1px solid #d1d5db", backgroundColor: "#fff", padding: "6px 8px", fontSize: "13px" },
  textarea: { width: "100%", minHeight: "72px", boxSizing: "border-box", border: "1px solid #d1d5db", padding: "7px 8px", fontSize: "13px", resize: "vertical" },
  check: { minHeight: "34px", display: "flex", alignItems: "center", gap: "8px", color: "#374151", fontSize: "12px", fontWeight: 750 },
  moneyWrap: { position: "relative" },
  primaryButton: { height: "34px", border: "1px solid #111827", backgroundColor: "#111827", color: "#fff", padding: "0 14px", fontSize: "12px", fontWeight: 850, cursor: "pointer", justifySelf: "start" },
  secondaryButton: { height: "32px", border: "1px solid #d1d5db", backgroundColor: "#fff", color: "#374151", padding: "0 11px", fontSize: "12px", fontWeight: 800, cursor: "pointer" },
  actions: { marginTop: "12px", display: "flex", justifyContent: "flex-end" },
  detailForm: { marginTop: "14px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" },
  detailTitle: { margin: "0 0 10px", fontSize: "13px", fontWeight: 850 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: "720px" },
  th: { textAlign: "left", padding: "8px", borderBottom: "1px solid #d1d5db", backgroundColor: "#f9fafb", color: "#374151", fontSize: "11px", fontWeight: 850 },
  td: { padding: "8px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontSize: "12px", verticalAlign: "top" },
  emptyCell: { padding: "14px 8px", color: "#6b7280", fontSize: "12px" },
  rowActions: { display: "flex", gap: "8px" },
  tableLink: { border: 0, background: "transparent", color: "#374151", padding: 0, fontSize: "12px", fontWeight: 750, cursor: "pointer", textDecoration: "underline" },
  deleteLink: { border: 0, background: "transparent", color: "#b91c1c", padding: 0, fontSize: "12px", fontWeight: 750, cursor: "pointer", textDecoration: "underline" },
  initializeBox: { margin: "14px", padding: "14px", border: "1px solid #fde68a", backgroundColor: "#fffbeb", display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "center" },
  feedback: { margin: "10px 14px 0", padding: "9px 10px", border: "1px solid #d1d5db", backgroundColor: "#f9fafb", color: "#374151", fontSize: "12px", fontWeight: 750 },
  feedbackError: { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" },
  feedbackSuccess: { borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", color: "#166534" },
};
