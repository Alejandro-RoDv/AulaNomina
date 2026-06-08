import { useMemo, useState } from "react";

const EMPTY_FILTERS = { search: "", family: "", status: "", companyId: "", centerId: "", startFrom: "", startTo: "" };

const FAMILY_OPTIONS = [
  { value: "indefinido", label: "Indefinidos 100-299" },
  { value: "fijo_discontinuo", label: "Fijo discontinuo 300" },
  { value: "temporal", label: "Temporales 400-599" },
];

const INDEFINITE_CLAUSES = [
  { key: "ordinary", label: "Indefinido ordinario", page: 6, codes: ["100", "200", "300"] },
  { key: "disability", label: "Personas con discapacidad", page: 7, codes: ["130", "230", "330"] },
  { key: "intellectual_limit", label: "Capacidad intelectual límite", page: 8, terms: ["intelectual", "limite"] },
  { key: "cee_disability", label: "Discapacidad en centro especial de empleo", page: 9, codes: ["150", "250", "350"], terms: ["centro especial", "cee"] },
  { key: "readmission", label: "Readmisión por incapacidad permanente", page: 10, terms: ["readmit", "incapacidad permanente"] },
  { key: "long_unemployed", label: "Desempleo de larga duración", page: 11, terms: ["larga duracion"] },
  { key: "social_clause", label: "Colectivos con cláusula social", page: 12, terms: ["exclusion", "vulnerabilidad"] },
  { key: "protected_collectives", label: "Otros colectivos protegidos", page: 13, terms: ["colectivo protegido"] },
  { key: "insertion", label: "Empresa de inserción", page: 14, terms: ["empresa de insercion"] },
  { key: "training_practice", label: "Formación práctica en empresas", page: 15, terms: ["formacion practica"] },
  { key: "ett_training", label: "Procedente de contrato formativo de ETT", page: 16, terms: ["ett", "contrato formativo"] },
  { key: "home", label: "Servicio del hogar familiar", page: 17, terms: ["hogar familiar", "empleado hogar"] },
  { key: "conversion", label: "Conversión de temporal a indefinido", page: 18, codes: ["109", "139", "189", "209", "239", "289", "309", "339", "389"], terms: ["conversion"] },
  { key: "other", label: "Otras situaciones", page: 19, codes: ["990", "999"] },
];

const TEMPORARY_CLAUSES = [
  { key: "production", label: "Circunstancias de la producción", page: 5, codes: ["402", "502"] },
  { key: "substitution", label: "Sustitución de persona trabajadora", page: 6, codes: ["410", "510"], terms: ["sustitucion"] },
  { key: "insertion", label: "Empresa de inserción", page: 7, terms: ["empresa de insercion", "exclusion"] },
  { key: "partial_retirement", label: "Jubilación parcial", page: 8, codes: ["540"], terms: ["jubilacion parcial"] },
  { key: "relief", label: "Relevo", page: 9, codes: ["441", "541"], terms: ["relevo"] },
  { key: "active_policies", label: "Programas de políticas activas de empleo", page: 10, codes: ["405", "505"], terms: ["politicas activas", "fomento empleo"] },
  { key: "eu_funds", label: "Programas financiados con fondos europeos", page: 11, codes: ["406", "506"], terms: ["fondos europeos"] },
  { key: "artists", label: "Artistas y personal técnico", page: 12, codes: ["407", "507"], terms: ["artista", "espectaculo"] },
  { key: "sports", label: "Deportistas profesionales", page: 13, codes: ["413", "513"], terms: ["deportista"] },
  { key: "university", label: "Personal docente e investigador de universidades", page: 14, codes: ["409", "509"], terms: ["universidad", "docente investigador"] },
  { key: "home", label: "Servicio del hogar familiar", page: 15, terms: ["hogar familiar", "empleado hogar"] },
  { key: "disability", label: "Temporal para personas con discapacidad", page: 16, codes: ["430", "530"], terms: ["discapacidad"] },
  { key: "cee_disability", label: "Discapacidad en centro especial de empleo", page: 17, terms: ["centro especial", "cee"] },
  { key: "research", label: "Personal investigador", page: 18, codes: ["404", "412"], terms: ["investigador", "predoctoral", "doctor"] },
  { key: "other", label: "Otras situaciones", page: 21, codes: ["990", "999"] },
];

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function contractText(contract) {
  return normalizeText([
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

function matchesTerms(contract, terms = []) {
  const text = contractText(contract);
  return terms.some((term) => text.includes(normalizeText(term)));
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatMoney(value) {
  const number = Number(value || 0);
  if (!number) return "";
  return number.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function getContractCode(contract) {
  return String(contract?.contract_code || contract?.ss_registration?.red_contract_key || "").trim();
}

function getContractFamily(contract) {
  const code = getContractCode(contract);
  if (code.startsWith("3") || contract?.working_day_type === "fixed_discontinuous") return "fijo_discontinuo";
  if (code.startsWith("4") || code.startsWith("5") || ["temporal", "sustitucion", "Temporal", "Sustitución"].includes(contract?.contract_type)) return "temporal";
  return "indefinido";
}

function getClause(contract) {
  const family = getContractFamily(contract);
  const code = getContractCode(contract);
  const clauses = family === "temporal" ? TEMPORARY_CLAUSES : INDEFINITE_CLAUSES;
  return clauses.find((clause) => clause.codes?.includes(code)) || clauses.find((clause) => matchesTerms(contract, clause.terms)) || clauses[0];
}

function buildPages(contract) {
  const family = getContractFamily(contract);
  const clause = getClause(contract);
  if (family === "temporal") {
    return [
      { number: 1, type: "cover", title: "Contrato de trabajo temporal" },
      { number: 2, type: "temporaryClauses", title: "Cláusulas generales" },
      { number: 3, type: "temporaryLegal", title: "Vacaciones, indemnización y comunicación" },
      { number: 4, type: "index", title: "Cláusulas específicas", clause },
      { number: clause.page, type: "specific", title: clause.label, clause },
      { number: 22, type: "signatures", title: "Cláusulas adicionales" },
    ];
  }
  if (family === "fijo_discontinuo") {
    return [
      { number: 1, type: "cover", title: "Contrato de trabajo indefinido" },
      { number: 2, type: "fixedDiscontinuous", title: "Cláusulas fijo-discontinuo" },
      { number: 3, type: "indefiniteClauses", title: "Jornada, duración y retribución" },
      { number: 5, type: "index", title: "Cláusulas específicas", clause },
      { number: clause.page, type: "specific", title: clause.label, clause },
      { number: 20, type: "signatures", title: "Cláusulas adicionales" },
    ];
  }
  return [
    { number: 1, type: "cover", title: "Contrato de trabajo indefinido" },
    { number: 2, type: "indefiniteWork", title: "Prestación de servicios" },
    { number: 3, type: "indefiniteClauses", title: "Jornada, duración y retribución" },
    { number: 5, type: "index", title: "Cláusulas específicas", clause },
    { number: clause.page, type: "specific", title: clause.label, clause },
    { number: 20, type: "signatures", title: "Cláusulas adicionales" },
  ];
}

function getEmployee(contract, employees) {
  return employees.find((employee) => Number(employee.id) === Number(contract.employee_id)) || {};
}

function getCompany(contract, companies) {
  return companies.find((company) => Number(company.id) === Number(contract.company_id)) || {};
}

function getCenter(contract, workCenters) {
  return workCenters.find((center) => Number(center.id) === Number(contract.center_id)) || {};
}

function getEmployeeName(contract, employees) {
  const employee = getEmployee(contract, employees);
  return contract.employee_name || [employee.first_name, employee.last_name].filter(Boolean).join(" ") || `Trabajador ${contract.employee_id || ""}`.trim();
}

function getCompanyName(contract, companies) {
  const company = getCompany(contract, companies);
  return contract.company_name || company.name || company.legal_name || "";
}

function firstValue(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "") || "";
}

function FieldLine({ label, value, wide = false }) {
  return (
    <div style={{ ...styles.field, ...(wide ? styles.fieldWide : {}) }}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={styles.fieldValue}>{value || " "}</span>
    </div>
  );
}

function CheckLine({ checked, children }) {
  return (
    <div style={styles.checkLine}>
      <span style={styles.checkbox}>{checked ? "X" : ""}</span>
      <span>{children}</span>
    </div>
  );
}

function CodeBoxes({ code }) {
  const digits = String(code || "").padEnd(3, " ").slice(0, 3).split("");
  return <span style={styles.codeBoxes}>{digits.map((digit, index) => <span key={`${digit}-${index}`} style={styles.codeBox}>{digit}</span>)}</span>;
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.sectionGrid}>{children}</div>
    </div>
  );
}

function ContractSheet({ page, contract, employees, companies, workCenters }) {
  const employee = getEmployee(contract, employees);
  const company = getCompany(contract, companies);
  const center = getCenter(contract, workCenters);
  const family = getContractFamily(contract);
  const code = getContractCode(contract);
  const employeeName = getEmployeeName(contract, employees);
  const companyName = getCompanyName(contract, companies);
  const modelTitle = family === "temporal" ? "CONTRATO DE TRABAJO TEMPORAL" : "CONTRATO DE TRABAJO INDEFINIDO";
  const centerAddress = firstValue(center.address, center.full_address, contract.center_address);
  const companyAddress = firstValue(company.registered_address, company.address, company.domicilio_social, contract.company_address);

  return (
    <section style={styles.sheet} className="contract-print-sheet">
      <div style={styles.sheetHeader}>
        <div style={styles.euBox}>Financiado por<br />la Unión Europea</div>
        <div style={styles.ministryBox}>Ministerio de Trabajo<br />y Economía Social</div>
        <div style={styles.sepeBox}>SEPE</div>
      </div>
      <h2 style={styles.modelTitle}>{modelTitle}</h2>

      {page.type === "cover" && (
        <>
          <Section title="Datos de la empresa">
            <FieldLine label="CIF/NIF/NIE" value={firstValue(company.cif, company.nif, company.tax_id, company.cif_nif)} />
            <FieldLine label="D./Dña." value={firstValue(company.legal_representative_name, company.representative_name)} />
            <FieldLine label="NIF/NIE" value={firstValue(company.legal_representative_nif, company.representative_nif)} />
            <FieldLine label="En concepto" value={firstValue(company.legal_representative_position, company.representative_role, "Representante legal")} />
            <FieldLine label="Nombre o razón social" value={companyName} wide />
            <FieldLine label="Domicilio social" value={companyAddress} wide />
            <FieldLine label="Municipio" value={firstValue(company.city, company.municipality)} />
            <FieldLine label="Código postal" value={firstValue(company.postal_code, company.zip_code)} />
            <FieldLine label="País" value={firstValue(company.country, "España")} />
          </Section>
          <Section title="Datos de la cuenta de cotización">
            <FieldLine label="Régimen" value={firstValue(company.ccc_regime, company.contribution_account_regime, "0111")} />
            <FieldLine label="Código cuenta cotización" value={firstValue(company.ccc_code, company.contribution_account_code, company.ccc)} wide />
            <FieldLine label="Actividad económica" value={firstValue(company.cnae_code, company.cnae_2009_code, company.activity)} wide />
          </Section>
          <Section title="Datos del centro de trabajo">
            <FieldLine label="Municipio" value={firstValue(center.city, center.municipality)} />
            <FieldLine label="Centro" value={firstValue(center.name, contract.center_name)} />
            <FieldLine label="Dirección" value={centerAddress} wide />
            <FieldLine label="Código postal" value={firstValue(center.postal_code, center.zip_code)} />
            <FieldLine label="País" value={firstValue(center.country, "España")} />
          </Section>
          <Section title="Datos de la persona trabajadora">
            <FieldLine label="D./Dña." value={employeeName} wide />
            <FieldLine label="NIF/NIE" value={firstValue(employee.dni, employee.nif, employee.identification_number)} />
            <FieldLine label="Fecha nacimiento" value={formatDate(employee.birth_date)} />
            <FieldLine label="Nº Seguridad Social" value={firstValue(employee.social_security_number, employee.naf)} />
            <FieldLine label="Nacionalidad" value={firstValue(employee.nationality, "Española")} />
            <FieldLine label="Nivel formativo" value={employee.education_level} />
            <FieldLine label="Municipio domicilio" value={firstValue(employee.city, employee.municipality)} />
            <FieldLine label="País domicilio" value={firstValue(employee.country, "España")} />
            <FieldLine label="Domicilio" value={firstValue(employee.address, employee.full_address)} wide />
          </Section>
        </>
      )}

      {page.type === "indefiniteWork" && (
        <Section title="Cláusulas">
          <p style={styles.declaration}>DECLARAN que reúnen los requisitos exigidos y formalizan el contrato con arreglo a las siguientes cláusulas.</p>
          <FieldLine label="Primera · Puesto" value={contract.job_position} wide />
          <FieldLine label="Grupo profesional" value={contract.professional_category || contract.contribution_group} wide />
          <FieldLine label="Funciones" value={contract.contract_code_description || "Funciones propias del grupo profesional indicado."} wide />
          <FieldLine label="Centro de trabajo" value={[centerAddress, center.name].filter(Boolean).join(" · ")} wide />
          <CheckLine checked={Boolean(contract.remote_work)}>Trabajo a distancia</CheckLine>
        </Section>
      )}

      {page.type === "fixedDiscontinuous" && (
        <Section title="Cláusulas fijo-discontinuo">
          <p style={styles.declaration}>El contrato se concierta para realizar trabajos fijos-discontinuos conforme al artículo 16 del Estatuto de los Trabajadores.</p>
          <FieldLine label="Puesto" value={contract.job_position} wide />
          <FieldLine label="Grupo profesional" value={contract.professional_category || contract.contribution_group} wide />
          <FieldLine label="Actividad cíclica" value={contract.contract_code_description || "Actividad fija-discontinua o de temporada."} wide />
          <FieldLine label="Duración estimada" value={contract.end_date ? `${formatDate(contract.start_date)} - ${formatDate(contract.end_date)}` : "Según llamamiento"} wide />
          <FieldLine label="Jornada estimada" value={contract.weekly_hours ? `${contract.weekly_hours} horas semanales` : ""} />
          <FieldLine label="Distribución horaria" value={contract.work_schedule || "Según convenio colectivo o acuerdo de empresa"} wide />
        </Section>
      )}

      {page.type === "indefiniteClauses" && (
        <Section title="Jornada, duración y retribución">
          <CheckLine checked={contract.working_day_type !== "part_time"}>A tiempo completo</CheckLine>
          <CheckLine checked={contract.working_day_type === "part_time"}>A tiempo parcial</CheckLine>
          <FieldLine label="Jornada semanal" value={contract.weekly_hours ? `${contract.weekly_hours} horas` : ""} />
          <FieldLine label="Coeficiente parcialidad" value={contract.partiality_coefficient ? `${contract.partiality_coefficient}%` : ""} />
          <FieldLine label="Inicio relación laboral" value={formatDate(contract.start_date)} />
          <FieldLine label="Periodo de prueba" value={contract.trial_period || "Según convenio"} />
          <FieldLine label="Retribución total" value={formatMoney(contract.gross_annual_salary || contract.salary_base)} />
          <FieldLine label="Conceptos salariales" value="Salario base, complementos salariales y pluses aplicables" wide />
          <FieldLine label="Vacaciones anuales" value={contract.annual_vacation_days ? `${contract.annual_vacation_days} días` : "30 días naturales"} />
          <FieldLine label="Convenio colectivo" value={contract.collective_agreement_name || contract.collective_agreement_code} wide />
        </Section>
      )}

      {page.type === "temporaryClauses" && (
        <Section title="Cláusulas generales">
          <FieldLine label="Primera · Puesto" value={contract.job_position} wide />
          <FieldLine label="Grupo profesional" value={contract.professional_category || contract.contribution_group} wide />
          <FieldLine label="Centro de trabajo" value={[centerAddress, center.name].filter(Boolean).join(" · ")} wide />
          <CheckLine checked={contract.working_day_type !== "part_time"}>A tiempo completo</CheckLine>
          <CheckLine checked={contract.working_day_type === "part_time"}>A tiempo parcial</CheckLine>
          <FieldLine label="Jornada" value={contract.weekly_hours ? `${contract.weekly_hours} horas semanales` : ""} />
          <FieldLine label="Duración" value={`${formatDate(contract.start_date)} - ${formatDate(contract.end_date)}`} />
          <FieldLine label="Periodo de prueba" value={contract.trial_period || "Según convenio"} />
          <FieldLine label="Retribución total" value={formatMoney(contract.gross_annual_salary || contract.salary_base)} />
        </Section>
      )}

      {page.type === "temporaryLegal" && (
        <Section title="Vacaciones, indemnización y comunicación">
          <FieldLine label="Vacaciones anuales" value={contract.annual_vacation_days ? `${contract.annual_vacation_days} días` : "30 días naturales"} />
          <FieldLine label="Indemnización" value="La que corresponda conforme al artículo 49.1 del Estatuto de los Trabajadores o norma específica." wide />
          <FieldLine label="Convenio colectivo" value={contract.collective_agreement_name || contract.collective_agreement_code} wide />
          <FieldLine label="Comunicación" value="El contenido del contrato se comunicará al Servicio Público de Empleo en el plazo legal." wide />
          <FieldLine label="Protección de datos" value="Datos protegidos conforme al RGPD y Ley Orgánica 3/2018." wide />
        </Section>
      )}

      {page.type === "index" && (
        <Section title="Índice de cláusulas específicas">
          {(family === "temporal" ? TEMPORARY_CLAUSES : INDEFINITE_CLAUSES).map((clause) => (
            <div key={clause.key} style={styles.indexRow}>
              <span style={styles.checkbox}>{clause.key === page.clause.key ? "X" : ""}</span>
              <span>{clause.label}</span>
              <span style={styles.dots} />
              <strong>pág. {clause.page}</strong>
            </div>
          ))}
          <p style={styles.smallNote}>Se marca automáticamente la cláusula deducida por código de contrato, jornada y datos disponibles.</p>
        </Section>
      )}

      {page.type === "specific" && (
        <Section title={page.title}>
          <div style={styles.codePanel}><span>CÓDIGO DE CONTRATO</span><CodeBoxes code={code || (family === "temporal" ? "402" : family === "fijo_discontinuo" ? "300" : "100")} /></div>
          {page.clause.key === "production" && (
            <>
              <CheckLine checked>Incremento ocasional imprevisible u oscilaciones de la actividad normal.</CheckLine>
              <FieldLine label="Circunstancias concretas" value={contract.contract_code_description || "Necesidad temporal de personal por circunstancias de la producción."} wide />
              <FieldLine label="Duración prevista" value={`${formatDate(contract.start_date)} - ${formatDate(contract.end_date)}`} wide />
            </>
          )}
          {page.clause.key === "substitution" && (
            <>
              <FieldLine label="Persona sustituida" value={contract.replaced_worker_name || contract.ss_registration?.replaced_worker_naf} wide />
              <FieldLine label="Causa" value={contract.contract_code_description || contract.ss_registration?.replacement_cause_code || "Sustitución con derecho a reserva de puesto."} wide />
            </>
          )}
          {!(["production", "substitution"].includes(page.clause.key)) && (
            <>
              <FieldLine label="Cláusula aplicable" value={page.clause.label} wide />
              <FieldLine label="Detalle didáctico" value="Página específica añadida al modelo reducido de impresión por código o datos contractuales." wide />
              <FieldLine label="Observaciones" value={contract.contract_code_description || "Cumple los requisitos exigidos en la norma regulatoria aplicable."} wide />
            </>
          )}
        </Section>
      )}

      {page.type === "signatures" && (
        <Section title="Cláusulas adicionales">
          <div style={styles.largeBox}>{contract.additional_clauses || " "}</div>
          <p style={styles.declaration}>Y para que conste, se extiende este contrato por triplicado ejemplar en el lugar y fecha indicados, firmando las partes interesadas.</p>
          <FieldLine label="Lugar y fecha" value={`${firstValue(company.city, company.municipality)} a ${formatDate(contract.start_date)}`} wide />
          <div style={styles.signatureGrid}><div>El/la trabajador/a</div><div>El/la representante de la empresa</div><div>El/la representante legal, si procede</div></div>
          <p style={styles.important}>IMPORTANTE: todas las páginas cumplimentadas deberán ir firmadas en el margen izquierdo para mayor seguridad jurídica.</p>
        </Section>
      )}

      <span style={styles.pageNumber}>{page.number}</span>
    </section>
  );
}

export default function ContractPrintPage({ loading, contracts, employees, companies, workCenters = [] }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [previewIds, setPreviewIds] = useState([]);

  const filteredContracts = useMemo(() => {
    const search = normalizeText(filters.search);
    return contracts.filter((contract) => {
      const family = getContractFamily(contract);
      const searchable = normalizeText([getContractCode(contract), getEmployeeName(contract, employees), getCompanyName(contract, companies), contract.contract_code_description, contract.contract_type, contract.job_position].join(" "));
      if (search && !searchable.includes(search)) return false;
      if (filters.family && family !== filters.family) return false;
      if (filters.status && contract.status !== filters.status) return false;
      if (filters.companyId && Number(contract.company_id) !== Number(filters.companyId)) return false;
      if (filters.centerId && Number(contract.center_id) !== Number(filters.centerId)) return false;
      if (filters.startFrom && String(contract.start_date || "") < filters.startFrom) return false;
      if (filters.startTo && String(contract.start_date || "") > filters.startTo) return false;
      return true;
    });
  }, [contracts, employees, companies, filters]);

  const previewContracts = previewIds.map((id) => contracts.find((contract) => String(contract.id) === String(id))).filter(Boolean);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));
  const toggleSelected = (contractId) => setSelectedIds((current) => current.includes(contractId) ? current.filter((id) => id !== contractId) : [...current, contractId]);
  const selectAllFiltered = () => setSelectedIds(filteredContracts.map((contract) => contract.id));
  const handlePreview = () => {
    setPreviewIds(selectedIds);
    window.setTimeout(() => document.getElementById("contract-print-preview")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <div style={styles.wrapper}>
      <style>{printCss}</style>
      <section style={styles.toolbar}>
        <div>
          <p style={styles.kicker}>Split 27 · Impresión contratos</p>
          <h2 style={styles.title}>Seleccionar contratos para impresión</h2>
          <p style={styles.subtitle}>Vista HTML reducida por tipo: indefinidos 100-299, fijo-discontinuo 300 y temporales 400-599.</p>
        </div>
        <div style={styles.actions}>
          <button type="button" style={styles.secondaryButton} onClick={selectAllFiltered}>Seleccionar filtrados</button>
          <button type="button" style={styles.secondaryButton} onClick={() => setSelectedIds([])}>Limpiar</button>
          <button type="button" style={styles.primaryButton} disabled={!selectedIds.length} onClick={handlePreview}>Imprimir / visualizar ({selectedIds.length})</button>
          <button type="button" style={styles.printButton} disabled={!previewContracts.length} onClick={() => window.print()}>Abrir impresión</button>
        </div>
      </section>

      <section style={styles.filtersPanel}>
        <input style={styles.input} value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Buscar por trabajador, empresa, código o puesto" />
        <select style={styles.input} value={filters.family} onChange={(event) => updateFilter("family", event.target.value)}><option value="">Todos los tipos</option>{FAMILY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <select style={styles.input} value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}><option value="">Todos los estados</option><option value="active">Activo</option><option value="ended">Finalizado</option><option value="deleted">Baja administrativa</option></select>
        <select style={styles.input} value={filters.companyId} onChange={(event) => updateFilter("companyId", event.target.value)}><option value="">Todas las empresas</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name || company.legal_name}</option>)}</select>
        <select style={styles.input} value={filters.centerId} onChange={(event) => updateFilter("centerId", event.target.value)}><option value="">Todos los centros</option>{workCenters.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select>
        <input style={styles.input} type="date" value={filters.startFrom} onChange={(event) => updateFilter("startFrom", event.target.value)} />
        <input style={styles.input} type="date" value={filters.startTo} onChange={(event) => updateFilter("startTo", event.target.value)} />
      </section>

      <section style={styles.tablePanel}>
        <div style={styles.tableHeader}><strong>{loading ? "Cargando contratos..." : `${filteredContracts.length} contratos disponibles`}</strong><span>{selectedIds.length} seleccionados</span></div>
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Sel.</th><th style={styles.th}>Código</th><th style={styles.th}>Trabajador</th><th style={styles.th}>Empresa</th><th style={styles.th}>Tipo impresión</th><th style={styles.th}>Cláusula</th><th style={styles.th}>Inicio</th><th style={styles.th}>Estado</th></tr></thead>
            <tbody>
              {filteredContracts.map((contract) => {
                const clause = getClause(contract);
                const familyLabel = FAMILY_OPTIONS.find((item) => item.value === getContractFamily(contract))?.label || "Contrato";
                return <tr key={contract.id}><td style={styles.td}><input type="checkbox" checked={selectedIds.includes(contract.id)} onChange={() => toggleSelected(contract.id)} /></td><td style={styles.tdStrong}>{getContractCode(contract) || "-"}</td><td style={styles.td}>{getEmployeeName(contract, employees)}</td><td style={styles.td}>{getCompanyName(contract, companies) || "-"}</td><td style={styles.td}>{familyLabel}</td><td style={styles.td}>{clause.label} · pág. {clause.page}</td><td style={styles.td}>{formatDate(contract.start_date) || "-"}</td><td style={styles.td}>{contract.status || "-"}</td></tr>;
              })}
              {!filteredContracts.length && <tr><td style={styles.emptyCell} colSpan="8">No hay contratos que coincidan con los filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section id="contract-print-preview" style={styles.previewPanel}>
        <div style={styles.previewHeader}><div><p style={styles.kicker}>Previsualización HTML</p><h2 style={styles.title}>Modelo reducido de contrato</h2></div><span>{previewContracts.length ? `${previewContracts.length} contrato(s)` : "Sin previsualización"}</span></div>
        {!previewContracts.length && <p style={styles.subtitle}>Selecciona contratos y pulsa “Imprimir / visualizar”.</p>}
        {previewContracts.map((contract) => (
          <div key={contract.id} style={styles.contractPreviewBlock}>
            <div data-contract-print-divider="true" style={styles.contractDivider}>{getEmployeeName(contract, employees)} · código {getContractCode(contract) || "-"}</div>
            {buildPages(contract).map((page, index) => <ContractSheet key={`${contract.id}-${page.number}-${index}`} page={page} contract={contract} employees={employees} companies={companies} workCenters={workCenters} />)}
          </div>
        ))}
      </section>
    </div>
  );
}

const printCss = `@media print { body { background: #ffffff !important; } aside, header, footer { display: none !important; } main { padding: 0 !important; max-width: none !important; } #contract-print-preview { border: 0 !important; padding: 0 !important; } .contract-print-sheet { page-break-after: always; box-shadow: none !important; margin: 0 auto !important; } }`;

const styles = {
  wrapper: { display: "flex", flexDirection: "column", gap: "18px" },
  toolbar: { display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", padding: "20px", border: "1px solid #d1d5db", backgroundColor: "#ffffff" },
  kicker: { margin: "0 0 6px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.08em" },
  title: { margin: 0, fontSize: "24px", color: "#111827" },
  subtitle: { margin: "6px 0 0", color: "#4b5563", fontSize: "13px" },
  actions: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "8px" },
  primaryButton: { border: "1px solid #111827", backgroundColor: "#111827", color: "#ffffff", padding: "10px 14px", fontWeight: 800, cursor: "pointer" },
  secondaryButton: { border: "1px solid #9ca3af", backgroundColor: "#ffffff", color: "#111827", padding: "10px 14px", fontWeight: 800, cursor: "pointer" },
  printButton: { border: "1px solid #d97706", backgroundColor: "#fef3c7", color: "#92400e", padding: "10px 14px", fontWeight: 800, cursor: "pointer" },
  filtersPanel: { display: "grid", gridTemplateColumns: "2fr repeat(6, 1fr)", gap: "10px", padding: "14px", border: "1px solid #d1d5db", backgroundColor: "#f9fafb" },
  input: { minWidth: 0, border: "1px solid #cbd5e1", padding: "9px 10px", fontSize: "13px", backgroundColor: "#ffffff" },
  tablePanel: { border: "1px solid #d1d5db", backgroundColor: "#ffffff" },
  tableHeader: { display: "flex", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #e5e7eb", color: "#374151" },
  tableScroll: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: { textAlign: "left", padding: "10px", backgroundColor: "#f3f4f6", borderBottom: "1px solid #d1d5db", color: "#374151", whiteSpace: "nowrap" },
  td: { padding: "10px", borderBottom: "1px solid #e5e7eb", color: "#374151", verticalAlign: "top" },
  tdStrong: { padding: "10px", borderBottom: "1px solid #e5e7eb", color: "#111827", fontWeight: 900, whiteSpace: "nowrap" },
  emptyCell: { padding: "24px", textAlign: "center", color: "#6b7280" },
  previewPanel: { border: "1px solid #d1d5db", padding: "18px", backgroundColor: "#f3f4f6" },
  previewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  contractPreviewBlock: { display: "flex", flexDirection: "column", gap: "14px", alignItems: "center", marginBottom: "26px" },
  contractDivider: { width: "210mm", boxSizing: "border-box", padding: "9px 12px", backgroundColor: "#111827", color: "#ffffff", fontSize: "12px", fontWeight: 800 },
  sheet: { position: "relative", width: "210mm", minHeight: "297mm", boxSizing: "border-box", padding: "10mm 12mm", backgroundColor: "#ffffff", color: "#111827", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.16)", fontFamily: "Arial, sans-serif", fontSize: "11px" },
  sheetHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", height: "22mm", marginBottom: "4mm" },
  euBox: { color: "#1d4ed8", fontWeight: 800, fontSize: "10px" },
  ministryBox: { textAlign: "center", fontSize: "10px", fontWeight: 700, color: "#374151" },
  sepeBox: { border: "1px solid #111827", padding: "6px 12px", fontWeight: 900, fontSize: "14px" },
  modelTitle: { backgroundColor: "#e8edf7", color: "#0f3761", fontSize: "13px", padding: "5px 7px", textTransform: "uppercase", margin: "0 0 5mm" },
  section: { marginBottom: "5mm" },
  sectionTitle: { margin: "0 0 2mm", color: "#0f3761", textTransform: "uppercase", fontSize: "12px", fontWeight: 900 },
  sectionGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "2mm" },
  field: { border: "1px solid #9ca3af", minHeight: "9mm", backgroundColor: "#eef2fb", display: "flex", flexDirection: "column" },
  fieldWide: { gridColumn: "span 3" },
  fieldLabel: { fontSize: "8px", color: "#374151", textTransform: "uppercase", fontWeight: 900, padding: "1mm 1.5mm 0" },
  fieldValue: { flex: 1, padding: "1mm 1.5mm", backgroundColor: "#ffffff", borderTop: "1px solid #cbd5e1", fontSize: "11px" },
  declaration: { gridColumn: "span 3", margin: "2mm 0", fontSize: "11px", lineHeight: 1.45 },
  checkLine: { gridColumn: "span 3", display: "flex", gap: "7px", alignItems: "flex-start", minHeight: "7mm", fontSize: "11px" },
  checkbox: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "4mm", height: "4mm", border: "1px solid #111827", fontSize: "9px", fontWeight: 900, flex: "0 0 auto" },
  indexRow: { gridColumn: "span 3", display: "grid", gridTemplateColumns: "auto auto 1fr auto", gap: "7px", alignItems: "center", fontSize: "11px" },
  dots: { borderBottom: "1px dotted #9ca3af", height: "1px" },
  codePanel: { gridColumn: "span 3", justifySelf: "end", border: "1px solid #111827", padding: "5px 8px", display: "flex", gap: "8px", alignItems: "center", fontWeight: 800 },
  codeBoxes: { display: "inline-flex", gap: "2px" },
  codeBox: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: "5mm", height: "5mm", border: "1px solid #111827", fontWeight: 900 },
  largeBox: { gridColumn: "span 3", minHeight: "74mm", backgroundColor: "#eef2fb", border: "1px solid #cbd5e1", padding: "4mm", whiteSpace: "pre-wrap" },
  signatureGrid: { gridColumn: "span 3", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12mm", textAlign: "center", paddingTop: "24mm", minHeight: "42mm" },
  important: { gridColumn: "span 3", marginTop: "12mm", textAlign: "center", fontSize: "12px", fontWeight: 900 },
  smallNote: { gridColumn: "span 3", color: "#6b7280", margin: "2mm 0 0", fontSize: "10px" },
  pageNumber: { position: "absolute", right: "8mm", bottom: "6mm", fontSize: "10px", fontWeight: 700 },
};
