import { useEffect, useState } from "react";
import { fetchContractLifecycle } from "../../services/contractLifecycleApi";
import PageCard from "../layout/PageCard";
import "./contractVariationHistory.css";
const LABELS = {salary_base:"Salario base",gross_annual_salary:"Salario bruto anual",pay_schedule:"Distribución de pagas",working_day_type:"Tipo de jornada",weekly_hours:"Horas semanales",full_time_weekly_hours:"Jornada completa de referencia",monthly_hours:"Horas mensuales",annual_hours:"Horas anuales",partiality_coefficient:"Parcialidad (%)",start_date:"Fecha de inicio",end_date:"Fecha final",status:"Estado",contract_type:"Tipo de contrato",contract_code:"Código de contrato",contract_code_description:"Descripción del contrato",contract_family:"Familia de contrato",company_id:"Empresa",center_id:"Centro",professional_category:"Categoría profesional",job_position:"Puesto",collective_agreement_id:"Convenio",collective_agreement_code:"Código de convenio",professional_category_id:"Categoría",salary_table_row_id:"Fila salarial",contribution_group:"Grupo de cotización",termination_reason:"Motivo de baja",seniority_date:"Antigüedad",bonus_observations:"Observaciones",work_distribution:"Distribución de jornada"};
const VALUES = {active:"Activo",draft:"Borrador",ended:"Finalizado",transformed:"Transformado",full_time:"Completa",part_time:"Parcial",fixed_discontinuous:"Fijo discontinuo",prorated_12:"12 pagas prorrateadas",not_prorated_14:"14 pagas",not_prorated_15:"15 pagas"};
function display(value) { return value == null || value === "" ? "—" : typeof value === "boolean" ? (value ? "Sí" : "No") : VALUES[value] || String(value); }
function changes(event) { return [...new Set([...Object.keys(event.previous_state),...Object.keys(event.new_state)])].filter(key=>JSON.stringify(event.previous_state[key])!==JSON.stringify(event.new_state[key])); }
export default function ContractVariationHistory({contracts, employees}) {
  const [contractId,setContractId]=useState("");
  const [result,setResult]=useState({contractId:"",events:[],error:""});
  const selectedId=contracts.some(item=>String(item.id)===contractId)?contractId:"";
  useEffect(()=>{
    if(!selectedId)return;
    let cancelled=false;
    fetchContractLifecycle(selectedId).then(events=>{if(!cancelled)setResult({contractId:selectedId,events:[...events].reverse(),error:""});}).catch(error=>{if(!cancelled)setResult({contractId:selectedId,events:[],error:error.message});});
    return ()=>{cancelled=true;};
  },[selectedId,contracts]);
  const loaded=result.contractId===selectedId;
  return <PageCard title="Histórico de variaciones" subtitle="Las modificaciones se guardan automáticamente al editar el contrato. Consulta los valores anteriores y sus nuevas condiciones."><div className="contract-variations">
    <label>Contrato<select aria-label="Contrato para histórico de variaciones" value={selectedId} onChange={event=>setContractId(event.target.value)}><option value="">Selecciona un contrato</option>{contracts.map(contract=>{const employee=employees.find(item=>String(item.id)===String(contract.employee_id));return <option key={contract.id} value={contract.id}>{employee?`${employee.first_name} ${employee.last_name}`:`Trabajador ${contract.employee_id}`} · {contract.contract_code||contract.contract_type} · {contract.start_date}</option>;})}</select></label>
    {!selectedId&&<p>Selecciona un contrato para consultar sus versiones anteriores.</p>}
    {selectedId&&!loaded&&<p>Cargando variaciones…</p>}
    {selectedId&&loaded&&result.error&&<p role="alert">{result.error}</p>}
    {selectedId&&loaded&&!result.error&&!result.events.length&&<p>Todavía no hay variaciones guardadas en este contrato.</p>}
    {selectedId&&loaded&&result.events.map(event=><article key={event.id}><div className="contract-variations-heading"><strong>{({contract_edit:"Edición del contrato",workday_change:"Cambio de jornada",extension:"Prórroga"})[event.event_type]||"Variación contractual"}</strong><span>{new Date(event.created_at).toLocaleString("es-ES")}</span></div><p>{event.reason} · {event.event_type==="contract_edit"?"Fecha de registro":"Fecha de efectos"}: {event.effective_date}</p><div className="contract-variations-table"><table><thead><tr><th>Campo modificado</th><th>Antes</th><th>Después</th></tr></thead><tbody>{changes(event).map(key=><tr key={key}><td>{LABELS[key]||key.replaceAll("_"," ")}</td><td>{display(event.previous_state[key])}</td><td>{display(event.new_state[key])}</td></tr>)}</tbody></table></div><details><summary>Consultar versión anterior completa</summary><dl>{Object.entries(event.previous_state).map(([key,value])=><div key={key}><dt>{LABELS[key]||key.replaceAll("_"," ")}</dt><dd>{display(value)}</dd></div>)}</dl></details></article>)}
  </div></PageCard>;
}
