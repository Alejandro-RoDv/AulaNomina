import { useMemo, useState } from "react";

const EMPTY_FILTERS = { search: "", family: "", status: "", companyId: "", centerId: "", startFrom: "", startTo: "" };

const FAMILIES = [
  { key: "indefinido", label: "Indefinidos 100-299" },
  { key: "fijo_discontinuo", label: "Fijo discontinuo 300-399" },
  { key: "temporal", label: "Temporales 400-599" },
];

const INDEFINITE_CLAUSES = [
  { key: "ordinary", label: "Indefinido ordinario", page: 6, codes: ["100", "200", "300"] },
  { key: "disability", label: "Personas con discapacidad", page: 7, codes: ["130", "230", "330"], terms: ["discapacidad"] },
  { key: "intellectual_limit", label: "Capacidad intelectual límite", page: 8, terms: ["intelectual", "limite"] },
  { key: "cee_disability", label: "Discapacidad en centro especial de empleo", page: 9, codes: ["150", "250", "350"], terms: ["centro especial", "cee"] },
  { key: "conversion", label: "Conversión de temporal a indefinido", page: 18, codes: ["109", "139", "189", "209", "239", "289", "309", "339", "389"], terms: ["conversion"] },
  { key: "other", label: "Otras situaciones", page: 19, codes: ["990", "999"] },
];

const TEMPORARY_CLAUSES = [
  { key: "production", label: "Circunstancias de la producción", page: 5, codes: ["402", "502"] },
  { key: "substitution", label: "Sustitución de persona trabajadora", page: 6, codes: ["410", "510"], terms: ["sustitucion"] },
  { key: "insertion", label: "Empresa de inserción", page: 7, terms: ["empresa de insercion", "exclusion"] },
  { key: "relief", label: "Relevo", page: 9, codes: ["441", "541"], terms: ["relevo"] },
  { key: "eu_funds", label: "Programas financiados con fondos europeos", page: 11, codes: ["406", "506"], terms: ["fondos europeos"] },
  { key: "disability", label: "Temporal para personas con discapacidad", page: 16, codes: ["430", "530"], terms: ["discapacidad"] },
  { key: "research", label: "Personal investigador", page: 18, codes: ["404", "412"], terms: ["investigador"] },
  { key: "other", label: "Otras situaciones", page: 21 },
];

function normalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (!number) return "";
  return number.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function firstValue(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "") || "";
}

function findById(items, id) {
  return items.find((item) => Number(item.id) === Number(id)) || {};
}

function getContractCode(contract) {
  return String(contract?.contract_code || contract?.ss_registration?.red_contract_key || "").trim();
}

function getContractFamily(contract) {
  const code = getContractCode(contract);
  if (/^[12][0-9]{2}$/.test(code)) return "indefinido";
  if (/^3[0-9]{2}$/.test(code)) return "fijo_discontinuo";
  if (/^[45][0-9]{2}$/.test(code)) return "temporal";
  if (contract?.working_day_type === "fixed_discontinuous") return "fijo_discontinuo";
  if (["temporal", "Temporal", "sustitucion", "Sustitución"].includes(contract?.contract_type)) return "temporal";
  return "indefinido";
}

function getContractText(contract) {
  return normalize([
    contract?.contract_type,
    contract?.contract_family,
    contract?.contract_code_description,
    contract?.professional_category,
    contract?.job_position,
    contract?.red_reduction_code,
    contract?.ss_registration?.worker_collective_code,
    contract?.ss_registration?.social_exclusion_or_victim_status,
    contract?.ss_registration?.replacement_cause_code,
  ].join(" "));
}

function getClause(contract) {
  const family = getContractFamily(contract);
  const code = getContractCode(contract);
  const clauses = family === "temporal" ? TEMPORARY_CLAUSES : INDEFINITE_CLAUSES;
  const exact = clauses.find((clause) => clause.codes?.includes(code));
  if (exact) return exact;
  const text = getContractText(contract);
  const semantic = clauses.find((clause) => clause.key !== "production" && clause.terms?.some((term) => text.includes(normalize(term))));
  if (semantic) return semantic;
  return family === "temporal" ? TEMPORARY_CLAUSES.find((clause) => clause.key === "other") : INDEFINITE_CLAUSES[0];
}

function getClauses(family) {
  return family === "temporal" ? TEMPORARY_CLAUSES : INDEFINITE_CLAUSES;
}

function getEmployeeName(contract, employees) {
  const employee = findById(employees, contract.employee_id);
  return contract.employee_name || [employee.first_name, employee.last_name].filter(Boolean).join(" ") || `Trabajador ${contract.employee_id || ""}`.trim();
}

function getCompanyName(contract, companies) {
  const company = findById(companies, contract.company_id);
  return contract.company_name || company.name || company.legal_name || "";
}

function getFamilyLabel(family) {
  return FAMILIES.find((item) => item.key === family)?.label || "Contrato";
}

function sortContracts(a, b) {
  const order = { indefinido: 1, fijo_discontinuo: 2, temporal: 3 };
  const familyDiff = order[getContractFamily(a)] - order[getContractFamily(b)];
  if (familyDiff) return familyDiff;
  return getContractCode(a).localeCompare(getContractCode(b), "es", { numeric: true });
}

function buildPages(contract) {
  const family = getContractFamily(contract);
  const clause = getClause(contract);
  if (family === "temporal") return ["cover", "temporaryClauses", "temporaryLegal", "index", "specific", "signatures"].map((type) => ({ type, clause }));
  if (family === "fijo_discontinuo") return ["cover", "fixedDiscontinuous", "indefiniteClauses", "index", "specific", "signatures"].map((type) => ({ type, clause }));
  return ["cover", "indefiniteWork", "indefiniteClauses", "index", "specific", "signatures"].map((type) => ({ type, clause }));
}

function getModelPageNumber(page, contract) {
  const family = getContractFamily(contract);
  if (page.type === "cover") return 1;
  if (["temporaryClauses", "fixedDiscontinuous", "indefiniteWork"].includes(page.type)) return 2;
  if (["temporaryLegal", "indefiniteClauses"].includes(page.type)) return 3;
  if (page.type === "index") return family === "temporal" ? 4 : 5;
  if (page.type === "specific") return page.clause.page;
  if (page.type === "signatures") return family === "temporal" ? 22 : 20;
  return "";
}

function Field({ label, value, wide = false }) {
  return <div className={wide ? "cp-field cp-wide" : "cp-field"}><span>{label}</span><strong>{value || " "}</strong></div>;
}

function Check({ checked, children }) {
  return <div className="cp-check"><span>{checked ? "X" : ""}</span><p>{children}</p></div>;
}

function CodeBoxes({ code }) {
  return <div className="cp-code-boxes">{String(code || "").padEnd(3, " ").slice(0, 3).split("").map((digit, index) => <span key={index}>{digit}</span>)}</div>;
}

function Section({ title, children }) {
  return <section className="cp-section"><h3>{title}</h3><div className="cp-grid">{children}</div></section>;
}

function ContractSheet({ page, contract, employees, companies, workCenters }) {
  const family = getContractFamily(contract);
  const employee = findById(employees, contract.employee_id);
  const company = findById(companies, contract.company_id);
  const center = findById(workCenters, contract.center_id);
  const code = getContractCode(contract);
  const companyAddress = firstValue(company.registered_address, company.address, company.domicilio_social, contract.company_address);
  const centerAddress = firstValue(center.address, center.full_address, contract.center_address);
  const modelTitle = family === "temporal" ? "CONTRATO DE TRABAJO TEMPORAL" : "CONTRATO DE TRABAJO INDEFINIDO";

  return (
    <article className="contract-print-sheet">
      <header className="cp-header"><div>Financiado por<br />la Unión Europea</div><div>Ministerio de Trabajo<br />y Economía Social</div><strong>SEPE</strong></header>
      <h2 className="cp-title">{modelTitle}</h2>

      {page.type === "cover" && <>
        <Section title="Datos de la empresa">
          <Field label="CIF/NIF/NIE" value={firstValue(company.cif, company.nif, company.tax_id, company.cif_nif)} />
          <Field label="D./Dña." value={firstValue(company.legal_representative_name, company.representative_name)} />
          <Field label="NIF/NIE" value={firstValue(company.legal_representative_nif, company.representative_nif)} />
          <Field label="En concepto" value={firstValue(company.legal_representative_position, company.representative_role, "Representante legal")} />
          <Field label="Nombre o razón social" value={getCompanyName(contract, companies)} wide />
          <Field label="Domicilio social" value={companyAddress} wide />
          <Field label="Municipio" value={firstValue(company.city, company.municipality)} />
          <Field label="Código postal" value={firstValue(company.postal_code, company.zip_code)} />
          <Field label="País" value={firstValue(company.country, "España")} />
        </Section>
        <Section title="Datos de la cuenta de cotización">
          <Field label="Régimen" value={firstValue(company.ccc_regime, company.contribution_account_regime, "0111")} />
          <Field label="Código cuenta cotización" value={firstValue(company.ccc_code, company.contribution_account_code, company.ccc)} wide />
          <Field label="Actividad económica" value={firstValue(company.cnae_code, company.cnae_2009_code, company.activity)} wide />
        </Section>
        <Section title="Datos del centro de trabajo">
          <Field label="Municipio" value={firstValue(center.city, center.municipality)} />
          <Field label="Centro" value={firstValue(center.name, contract.center_name)} />
          <Field label="Dirección" value={centerAddress} wide />
          <Field label="Código postal" value={firstValue(center.postal_code, center.zip_code)} />
          <Field label="País" value={firstValue(center.country, "España")} />
        </Section>
        <Section title="Datos de la persona trabajadora">
          <Field label="D./Dña." value={getEmployeeName(contract, employees)} wide />
          <Field label="NIF/NIE" value={firstValue(employee.dni, employee.nif, employee.identification_number)} />
          <Field label="Fecha nacimiento" value={formatDate(employee.birth_date)} />
          <Field label="Nº Seguridad Social" value={firstValue(employee.social_security_number, employee.naf)} />
          <Field label="Nacionalidad" value={firstValue(employee.nationality, "Española")} />
          <Field label="Nivel formativo" value={employee.education_level} />
          <Field label="Municipio domicilio" value={firstValue(employee.city, employee.municipality)} />
          <Field label="País domicilio" value={firstValue(employee.country, "España")} />
          <Field label="Domicilio" value={firstValue(employee.address, employee.full_address)} wide />
        </Section>
      </>}

      {page.type === "indefiniteWork" && <Section title="Cláusulas"><p className="cp-text">DECLARAN que reúnen los requisitos exigidos y formalizan el contrato con arreglo a las siguientes cláusulas.</p><Field label="Primera · Puesto" value={contract.job_position} wide /><Field label="Grupo profesional" value={contract.professional_category || contract.contribution_group} wide /><Field label="Funciones" value={contract.contract_code_description || "Funciones propias del grupo profesional indicado."} wide /><Field label="Centro de trabajo" value={[centerAddress, center.name].filter(Boolean).join(" · ")} wide /><Check checked={Boolean(contract.remote_work)}>Trabajo a distancia</Check></Section>}
      {page.type === "fixedDiscontinuous" && <Section title="Cláusulas fijo-discontinuo"><p className="cp-text">El contrato se concierta para realizar trabajos fijos-discontinuos conforme al artículo 16 del Estatuto de los Trabajadores.</p><Field label="Puesto" value={contract.job_position} wide /><Field label="Grupo profesional" value={contract.professional_category || contract.contribution_group} wide /><Field label="Actividad cíclica" value={contract.contract_code_description || "Actividad fija-discontinua o de temporada."} wide /><Field label="Duración estimada" value={contract.end_date ? `${formatDate(contract.start_date)} - ${formatDate(contract.end_date)}` : "Según llamamiento"} wide /><Field label="Jornada estimada" value={contract.weekly_hours ? `${contract.weekly_hours} horas semanales` : ""} /><Field label="Distribución horaria" value={contract.work_schedule || "Según convenio colectivo o acuerdo de empresa"} wide /></Section>}
      {page.type === "indefiniteClauses" && <Section title="Jornada, duración y retribución"><Check checked={contract.working_day_type !== "part_time"}>A tiempo completo</Check><Check checked={contract.working_day_type === "part_time"}>A tiempo parcial</Check><Field label="Jornada semanal" value={contract.weekly_hours ? `${contract.weekly_hours} horas` : ""} /><Field label="Coeficiente parcialidad" value={contract.partiality_coefficient ? `${contract.partiality_coefficient}%` : ""} /><Field label="Inicio relación laboral" value={formatDate(contract.start_date)} /><Field label="Periodo de prueba" value={contract.trial_period || "Según convenio"} /><Field label="Retribución total" value={formatMoney(contract.gross_annual_salary || contract.salary_base)} /><Field label="Conceptos salariales" value="Salario base, complementos salariales y pluses aplicables" wide /><Field label="Vacaciones anuales" value={contract.annual_vacation_days ? `${contract.annual_vacation_days} días` : "30 días naturales"} /><Field label="Convenio colectivo" value={contract.collective_agreement_name || contract.collective_agreement_code} wide /></Section>}
      {page.type === "temporaryClauses" && <Section title="Cláusulas generales"><Field label="Primera · Puesto" value={contract.job_position} wide /><Field label="Grupo profesional" value={contract.professional_category || contract.contribution_group} wide /><Field label="Centro de trabajo" value={[centerAddress, center.name].filter(Boolean).join(" · ")} wide /><Check checked={contract.working_day_type !== "part_time"}>A tiempo completo</Check><Check checked={contract.working_day_type === "part_time"}>A tiempo parcial</Check><Field label="Jornada" value={contract.weekly_hours ? `${contract.weekly_hours} horas semanales` : ""} /><Field label="Duración" value={`${formatDate(contract.start_date)} - ${formatDate(contract.end_date)}`} /><Field label="Periodo de prueba" value={contract.trial_period || "Según convenio"} /><Field label="Retribución total" value={formatMoney(contract.gross_annual_salary || contract.salary_base)} /></Section>}
      {page.type === "temporaryLegal" && <Section title="Vacaciones, indemnización y comunicación"><Field label="Vacaciones anuales" value={contract.annual_vacation_days ? `${contract.annual_vacation_days} días` : "30 días naturales"} /><Field label="Indemnización" value="La que corresponda conforme al artículo 49.1 del Estatuto de los Trabajadores o norma específica." wide /><Field label="Convenio colectivo" value={contract.collective_agreement_name || contract.collective_agreement_code} wide /><Field label="Comunicación" value="El contenido del contrato se comunicará al Servicio Público de Empleo en el plazo legal." wide /></Section>}
      {page.type === "index" && <Section title="Índice de cláusulas específicas">{getClauses(family).map((clause) => <div className="cp-index-row" key={clause.key}><span>{clause.key === page.clause.key ? "X" : ""}</span><p>{clause.label}</p><i /><strong>pág. {clause.page}</strong></div>)}<p className="cp-note">Se marca automáticamente la cláusula deducida por código de contrato y datos disponibles.</p></Section>}
      {page.type === "specific" && <Section title={page.clause.label}><div className="cp-code"><strong>CÓDIGO DE CONTRATO</strong><CodeBoxes code={code || (family === "temporal" ? "499" : family === "fijo_discontinuo" ? "300" : "100")} /></div>{page.clause.key === "production" && <><Check checked>Incremento ocasional imprevisible u oscilaciones de la actividad normal.</Check><Field label="Circunstancias concretas" value={contract.contract_code_description || "Necesidad temporal de personal por circunstancias de la producción."} wide /><Field label="Duración prevista" value={`${formatDate(contract.start_date)} - ${formatDate(contract.end_date)}`} wide /></>}{page.clause.key === "substitution" && <><Field label="Persona sustituida" value={contract.replaced_worker_name || contract.ss_registration?.replaced_worker_naf} wide /><Field label="Causa" value={contract.contract_code_description || contract.ss_registration?.replacement_cause_code || "Sustitución con derecho a reserva de puesto."} wide /></>}{!(page.clause.key === "production" || page.clause.key === "substitution") && <><Field label="Cláusula aplicable" value={page.clause.label} wide /><Field label="Detalle didáctico" value="Página específica añadida al modelo reducido de impresión por código o datos contractuales." wide /><Field label="Observaciones" value={contract.contract_code_description || "Cumple los requisitos exigidos en la norma regulatoria aplicable."} wide /></>}</Section>}
      {page.type === "signatures" && <Section title="Cláusulas adicionales"><div className="cp-large-box">{contract.additional_clauses || " "}</div><p className="cp-text">Y para que conste, se extiende este contrato por triplicado ejemplar en el lugar y fecha indicados, firmando las partes interesadas.</p><Field label="Lugar y fecha" value={`${firstValue(company.city, company.municipality)} a ${formatDate(contract.start_date)}`} wide /><div className="cp-signatures"><span>El/la trabajador/a</span><span>El/la representante de la empresa</span><span>El/la representante legal, si procede</span></div><p className="cp-important">IMPORTANTE: todas las páginas cumplimentadas deberán ir firmadas en el margen izquierdo para mayor seguridad jurídica.</p></Section>}
      <footer className="cp-page-number">{getModelPageNumber(page, contract)}</footer>
    </article>
  );
}

function PrintableContracts({ contracts, employees, companies, workCenters }) {
  return <>{contracts.map((contract) => <div className="cp-contract-block" key={contract.id}>{buildPages(contract).map((page, index) => <ContractSheet key={`${contract.id}-${page.type}-${index}`} page={page} contract={contract} employees={employees} companies={companies} workCenters={workCenters} />)}</div>)}</>;
}

export default function ContractPrintPageV5({ loading, contracts, employees, companies, workCenters = [] }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewIds, setPreviewIds] = useState([]);
  const [printIds, setPrintIds] = useState([]);

  const filteredContracts = useMemo(() => {
    const search = normalize(filters.search);
    return contracts.filter((contract) => {
      const family = getContractFamily(contract);
      const searchable = normalize([getContractCode(contract), getEmployeeName(contract, employees), getCompanyName(contract, companies), contract.contract_code_description, contract.contract_type, contract.job_position].join(" "));
      if (search && !searchable.includes(search)) return false;
      if (filters.family && family !== filters.family) return false;
      if (filters.status && contract.status !== filters.status) return false;
      if (filters.companyId && Number(contract.company_id) !== Number(filters.companyId)) return false;
      if (filters.centerId && Number(contract.center_id) !== Number(filters.centerId)) return false;
      if (filters.startFrom && String(contract.start_date || "") < filters.startFrom) return false;
      if (filters.startTo && String(contract.start_date || "") > filters.startTo) return false;
      return true;
    }).sort(sortContracts);
  }, [contracts, employees, companies, filters]);

  const getContractsByIds = (ids) => ids.map((id) => contracts.find((contract) => String(contract.id) === String(id))).filter(Boolean).sort(sortContracts);
  const selectedContracts = getContractsByIds(selectedIds);
  const previewContracts = getContractsByIds(previewIds);
  const printContracts = getContractsByIds(printIds);
  const groupedContracts = FAMILIES.map((family) => ({ ...family, contracts: filteredContracts.filter((contract) => getContractFamily(contract) === family.key) }));

  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const toggleSelected = (contractId) => setSelectedIds((current) => current.includes(contractId) ? current.filter((id) => id !== contractId) : [...current, contractId]);
  const handlePreview = () => setPreviewIds(selectedIds);
  const handlePrint = () => {
    if (!selectedIds.length) {
      window.alert("Selecciona al menos un contrato para imprimir.");
      return;
    }
    setPrintIds(selectedIds);
    window.setTimeout(() => window.print(), 100);
  };

  return (
    <div className="cp-module">
      <style>{screenStyles}</style>
      <section className="cp-screen cp-toolbar">
        <div><p>Split 27 · Impresión contratos</p><h2>Seleccionar contratos para impresión</h2><span>Contratos separados por familia oficial según código: 100-299, 300-399 y 400-599.</span></div>
        <div className="cp-actions"><button type="button" onClick={() => setSelectedIds(filteredContracts.map((contract) => contract.id))}>Seleccionar filtrados</button><button type="button" onClick={() => setSelectedIds([])}>Limpiar</button><button type="button" disabled={!selectedIds.length} onClick={handlePreview}>Visualizar ({selectedIds.length})</button><button type="button" disabled={!selectedIds.length} onClick={handlePrint}>Imprimir</button></div>
      </section>

      <section className="cp-screen cp-filters"><input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Buscar por trabajador, empresa, código o puesto" /><select value={filters.family} onChange={(event) => updateFilter("family", event.target.value)}><option value="">Todos los tipos</option>{FAMILIES.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select><select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">Todos los estados</option><option value="active">Activo</option><option value="ended">Finalizado</option><option value="deleted">Baja administrativa</option></select><select value={filters.companyId} onChange={(event) => updateFilter("companyId", event.target.value)}><option value="">Todas las empresas</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name || company.legal_name}</option>)}</select><select value={filters.centerId} onChange={(event) => updateFilter("centerId", event.target.value)}><option value="">Todos los centros</option>{workCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select><input type="date" value={filters.startFrom} onChange={(event) => updateFilter("startFrom", event.target.value)} /><input type="date" value={filters.startTo} onChange={(event) => updateFilter("startTo", event.target.value)} /></section>

      <section className="cp-screen cp-list"><header><strong>{loading ? "Cargando contratos..." : `${filteredContracts.length} contratos disponibles`}</strong><span>{selectedIds.length} seleccionados</span></header>{groupedContracts.map((group) => <div className="cp-family" key={group.key}><div><strong>{group.label}</strong><span>{group.contracts.length} contrato(s)</span></div><table><thead><tr><th>Sel.</th><th>Código</th><th>Trabajador</th><th>Empresa</th><th>Cláusula</th><th>Inicio</th><th>Estado</th></tr></thead><tbody>{group.contracts.map((contract) => { const clause = getClause(contract); return <tr key={contract.id}><td><input type="checkbox" checked={selectedIds.includes(contract.id)} onChange={() => toggleSelected(contract.id)} /></td><td><strong>{getContractCode(contract) || "-"}</strong></td><td>{getEmployeeName(contract, employees)}</td><td>{getCompanyName(contract, companies) || "-"}</td><td>{clause.label} · pág. {clause.page}</td><td>{formatDate(contract.start_date) || "-"}</td><td>{contract.status || "-"}</td></tr>; })}{!group.contracts.length && <tr><td colSpan="7">Sin contratos en esta familia.</td></tr>}</tbody></table></div>)}</section>

      <section id="contract-print-preview" className="cp-screen cp-preview"><header><div><p>Previsualización HTML</p><h2>Modelo reducido de contrato</h2></div><span>{previewContracts.length ? `${previewContracts.length} contrato(s)` : "Sin previsualización"}</span></header>{!previewContracts.length && <p className="cp-empty">Selecciona contratos y pulsa Visualizar.</p>}<PrintableContracts contracts={previewContracts} employees={employees} companies={companies} workCenters={workCenters} /></section>
      <div id="contract-print-source" className="cp-print-only"><PrintableContracts contracts={printContracts.length ? printContracts : selectedContracts} employees={employees} companies={companies} workCenters={workCenters} /></div>
    </div>
  );
}

const contractCss = `
.contract-print-sheet{position:relative;width:194mm;max-width:194mm;height:260mm;min-height:0;margin:0 auto;padding:7mm 9mm;background:#fff;color:#111827;font-family:Arial,sans-serif;font-size:11px;box-sizing:border-box;break-after:page;page-break-after:always;overflow:hidden}.contract-print-sheet:last-child{break-after:auto;page-break-after:auto}.cp-header{display:flex;justify-content:space-between;align-items:flex-start;height:20mm;margin-bottom:5mm}.cp-header div:first-child{color:#1d4ed8;font-weight:800}.cp-header div:nth-child(2){text-align:center;font-weight:700;color:#374151}.cp-header strong{border:1px solid #111827;padding:6px 12px;font-size:14px}.cp-title{background:#e8edf7;color:#0f3761;font-size:13px;padding:5px 7px;text-transform:uppercase;margin:0 0 5mm}.cp-section{margin-bottom:5mm}.cp-section h3{margin:0 0 2mm;color:#0f3761;text-transform:uppercase;font-size:12px;font-weight:900}.cp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.cp-field{border:1px solid #9ca3af;min-height:9mm;background:#eef2fb;display:flex;flex-direction:column}.cp-field span{font-size:8px;color:#374151;text-transform:uppercase;font-weight:900;padding:1mm 1.5mm 0}.cp-field strong{flex:1;padding:1mm 1.5mm;background:#fff;border-top:1px solid #cbd5e1;font-size:11px;font-weight:500}.cp-wide{grid-column:span 3}.cp-text{grid-column:span 3;margin:2mm 0;font-size:11px;line-height:1.45}.cp-check{grid-column:span 3;display:flex;gap:7px;align-items:flex-start;min-height:7mm}.cp-check span,.cp-index-row>span{display:inline-flex;align-items:center;justify-content:center;width:4mm;height:4mm;border:1px solid #111827;font-size:9px;font-weight:900;flex:0 0 auto}.cp-check p{margin:0}.cp-index-row{grid-column:span 3;display:grid;grid-template-columns:auto auto 1fr auto;gap:7px;align-items:center}.cp-index-row p{margin:0}.cp-index-row i{border-bottom:1px dotted #9ca3af;height:1px}.cp-note{grid-column:span 3;color:#6b7280;margin:2mm 0 0;font-size:10px}.cp-code{grid-column:span 3;justify-self:end;border:1px solid #111827;padding:5px 8px;display:flex;gap:8px;align-items:center;font-weight:800}.cp-code-boxes{display:inline-flex;gap:2px}.cp-code-boxes span{display:inline-flex;align-items:center;justify-content:center;width:5mm;height:5mm;border:1px solid #111827;font-weight:900}.cp-large-box{grid-column:span 3;min-height:52mm;background:#eef2fb;border:1px solid #cbd5e1;padding:4mm;white-space:pre-wrap}.cp-signatures{grid-column:span 3;display:grid;grid-template-columns:repeat(3,1fr);gap:12mm;text-align:center;padding-top:18mm;min-height:34mm}.cp-important{grid-column:span 3;margin-top:8mm;text-align:center;font-size:12px;font-weight:900}.cp-page-number{position:absolute;right:8mm;bottom:6mm;font-size:10px;font-weight:700}`;

const screenStyles = `${contractCss}.cp-print-only{display:none}.cp-module{display:flex;flex-direction:column;gap:18px}.cp-toolbar{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:20px;border:1px solid #d1d5db;background:#fff}.cp-toolbar p,.cp-preview header p{margin:0 0 6px;font-size:11px;font-weight:900;text-transform:uppercase;color:#6b7280;letter-spacing:.08em}.cp-toolbar h2,.cp-preview h2{margin:0;font-size:24px;color:#111827}.cp-toolbar span,.cp-empty{display:block;margin-top:6px;color:#4b5563;font-size:13px}.cp-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.cp-actions button{border:1px solid #111827;background:#fff;color:#111827;padding:10px 14px;font-weight:800;cursor:pointer}.cp-actions button:nth-last-child(2){background:#111827;color:#fff}.cp-actions button:last-child{border-color:#d97706;background:#fef3c7;color:#92400e}.cp-actions button:disabled{opacity:.45;cursor:not-allowed}.cp-filters{display:grid;grid-template-columns:2fr repeat(6,1fr);gap:10px;padding:14px;border:1px solid #d1d5db;background:#f9fafb}.cp-filters input,.cp-filters select{min-width:0;border:1px solid #cbd5e1;padding:9px 10px;font-size:13px;background:#fff}.cp-list{border:1px solid #d1d5db;background:#fff}.cp-list>header,.cp-family>div{display:flex;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#374151}.cp-family{border-top:1px solid #e5e7eb}.cp-family table{width:100%;border-collapse:collapse;font-size:12px}.cp-family th{text-align:left;padding:10px;background:#f3f4f6;border-bottom:1px solid #d1d5db;color:#374151;white-space:nowrap}.cp-family td{padding:10px;border-bottom:1px solid #e5e7eb;color:#374151;vertical-align:top}.cp-preview{border:1px solid #d1d5db;padding:18px;background:#f3f4f6}.cp-preview>header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}.cp-preview .contract-print-sheet{box-shadow:0 10px 24px rgba(15,23,42,.16);margin-bottom:14px}@page{size:A4 portrait;margin:8mm}@media print{html,body,#root{margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}.cp-screen{display:none!important}body *{visibility:hidden!important}.cp-print-only,.cp-print-only *{display:block;visibility:visible!important}.cp-print-only{display:block!important;position:absolute!important;left:0!important;top:0!important;width:100%!important;margin:0!important;padding:0!important;background:#fff!important}.cp-print-only .cp-contract-block{display:block!important;margin:0!important;padding:0!important}.cp-print-only .contract-print-sheet{display:block!important;box-shadow:none!important;margin:0 auto!important;break-after:page!important;page-break-after:always!important}.cp-print-only .contract-print-sheet:last-child{break-after:auto!important;page-break-after:auto!important}}`;
