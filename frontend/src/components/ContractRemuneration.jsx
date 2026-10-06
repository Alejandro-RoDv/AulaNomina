import { useState } from 'react';
import { isRecurringContractConcept } from '../utils/contractRemuneration';
import './contractRemuneration.css';
const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
export default function ContractRemuneration({ form, extra, collectiveAgreements, categories, salaryRows, agreementDetail, concepts, salaryLines, baseChange, updateExtra, agreementChange, addConceptLine, addManualLine, updateLine, removeLine, totals }) {
  const [query, setQuery] = useState('');
  const [conceptId, setConceptId] = useState('');
  const categoryRows = salaryRows.filter(row => String(row.professional_category_id) === String(extra.professional_category_id) && (!row.table_amount_type || row.table_amount_type === "monthly"));
  const eligible = concepts.filter(concept => isRecurringContractConcept(concept) && !salaryLines.some(line => String(line.concept_id) === String(concept.id)));
  const matches = eligible.filter(concept => concept.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  const chosen = eligible.find(concept => String(concept.id) === conceptId);
  function changeCategory(value) {
    const category = categories.find(item => String(item.id) === value);
    updateExtra({ professional_category_id: value, professional_category: category?.name || '', salary_table_row_id: '' });
  }
  function applyRow(value) {
    const row = categoryRows.find(item => String(item.id) === value);
    updateExtra({ salary_table_row_id: value });
    if (row) baseChange({ target: { name: 'salary_base', value: String(row.base_salary ?? row.monthly_salary ?? '') } });
  }
  return <section className="contract-remuneration" aria-label="Retribución contractual">
    <header><h3>Retribución</h3><p>Configura el salario recurrente del contrato. Los importes se expresan en bruto.</p></header>
    <div className="remuneration-block"><h4>1. Convenio y clasificación</h4><div className="remuneration-grid">
      <label>Convenio<select aria-label="Convenio retributivo" value={extra.collective_agreement_id} onChange={agreementChange}><option value="">Sin convenio seleccionado</option>{collectiveAgreements.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Categoría profesional<select value={extra.professional_category_id} onChange={event => changeCategory(event.target.value)} disabled={!agreementDetail}><option value="">Seleccionar categoría</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {!extra.collective_agreement_id && <label>Categoría manual<input value={extra.professional_category} onChange={event => updateExtra({ professional_category: event.target.value })} placeholder="Ej.: Oficial administrativo" /></label>}
      <label>Puesto de trabajo<input value={extra.job_position} onChange={event => updateExtra({ job_position: event.target.value })} /></label>
    </div><div className="remuneration-grid remuneration-reference"><label>Referencia salarial de la categoría<select value={extra.salary_table_row_id} onChange={event => applyRow(event.target.value)} disabled={!extra.professional_category_id || !categoryRows.length}><option value="">Introducir salario manualmente</option>{categoryRows.map(row => <option key={row.id} value={row.id}>{row.table_name} · Base {money(row.base_salary ?? row.monthly_salary)}</option>)}</select></label><p>Seleccionar una referencia carga su salario base mensual. Puedes revisarlo y modificarlo antes de guardar.</p></div></div>
    <div className="remuneration-block"><h4>2. Salario base y distribución de pagas</h4><div className="remuneration-grid">
      <label>Salario base mensual a jornada completa (€)<input type="number" min="0" step="0.01" name="salary_base" value={form.salary_base} onChange={baseChange} /></label>
      <label>Distribución de pagas<select name="pay_schedule" value={form.pay_schedule || 'not_prorated_14'} onChange={baseChange}><option value="not_prorated_14">12 mensualidades + 2 pagas extra</option><option value="prorated_12">12 mensualidades con extras prorrateadas</option></select></label>
      <div className="remuneration-note"><strong>Jornada del contrato: {extra.partiality_coefficient || 100}%</strong><span>El resumen aplica esta jornada al salario base y a los complementos proporcionales.</span></div>
    </div></div>
    <div className="remuneration-block"><h4>3. Complementos fijos del contrato</h4><p>Añade solo los conceptos recurrentes pactados. Las incidencias, atrasos, horas extra e indemnizaciones se gestionan en sus módulos.</p>
      <div className="remuneration-picker"><label>Buscar complemento<input value={query} onChange={event => { setQuery(event.target.value); setConceptId(''); }} placeholder="Ej.: responsabilidad, transporte…" /></label><label>Complemento disponible<select value={chosen ? conceptId : ''} onChange={event => setConceptId(event.target.value)}><option value="">Seleccionar complemento</option>{matches.map(item => <option key={item.id} value={item.id}>{item.agreement_id ? 'Convenio' : 'General'} · {item.name}</option>)}</select></label><button type="button" disabled={!chosen} onClick={() => { addConceptLine(chosen); setConceptId(''); }}>Añadir complemento</button><button type="button" className="remuneration-secondary" onClick={addManualLine}>Añadir concepto manual</button></div>
      {!salaryLines.length && <div className="remuneration-empty">Sin complementos fijos. La retribución se compone únicamente del salario base.</div>}
      <div className="remuneration-lines">{salaryLines.map(line => <div className="remuneration-line" key={line.id}><label>Concepto<input value={line.name} placeholder="Nombre del complemento" onChange={event => updateLine(line.id, { name: event.target.value })} /></label><label>Importe mensual de referencia (€)<input type="number" min="0" step="0.01" value={line.amount} onChange={event => updateLine(line.id, { amount: event.target.value })} /></label><div className="remuneration-note"><strong>{line.source_type === 'agreement' ? 'Convenio' : line.source_type === 'generic' ? 'Catálogo general' : 'Manual'}</strong><span>{line.applies_workday_percentage === false ? 'Importe fijo sin reducción por jornada' : 'Proporcional a la jornada'}</span></div><button type="button" className="remuneration-secondary" aria-label={`Quitar ${line.name || 'concepto manual'}`} onClick={() => removeLine(line.id)}>Quitar</button></div>)}</div>
    </div>
    <footer className="remuneration-summary"><h4>Resumen bruto estimado</h4><div className="remuneration-metrics"><div><span>Base para esta jornada</span><strong>{money(totals.baseApplied)}</strong></div><div><span>Complementos mensuales</span><strong>{money(totals.supplements)}</strong></div><div><span>Prorrata de extras</span><strong>{money(totals.proration)}</strong></div><div><span>Mensualidad ordinaria</span><strong>{money(totals.monthly)}</strong></div><div><span>Bruto anual estimado</span><strong>{money(totals.annual)}</strong></div></div><p>Estimación de un año completo con dos pagas extra del importe ordinario. El convenio y las reglas de cada paga pueden modificar el cálculo final de nómina.</p></footer>
  </section>;
}
