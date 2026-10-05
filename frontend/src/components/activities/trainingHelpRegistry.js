export const HELP_LOCATIONS = [
  {
    id: "companies",
    title: "Empresas y centros de trabajo",
    navigationLabels: ["Organización", "Empresas / centros", "Listado empresas"],
    description: "Consulta empresas, CCC y la estructura de centros de trabajo.",
    keywords: "empresa empresas centro centros ccc cif estructura organización",
    page: "companies",
    hash: "#company-list",
    actions: ["Consultar empresas", "Revisar CCC", "Acceder a centros de trabajo"],
  },
  {
    id: "employee-new",
    title: "Alta de trabajador",
    navigationLabels: ["Personas", "Trabajadores", "Nuevo trabajador"],
    description: "Crea un nuevo expediente de persona trabajadora.",
    keywords: "alta crear nuevo trabajador empleado persona expediente",
    page: "employees",
    actions: ["Crear expediente", "Informar datos personales", "Asignar empresa y centro"],
  },
  {
    id: "employee-list",
    title: "Listado de trabajadores",
    navigationLabels: ["Personas", "Trabajadores", "Listado de trabajadores"],
    description: "Busca, abre y revisa expedientes de personas trabajadoras.",
    keywords: "trabajador trabajadores persona empleado expediente buscar dni naf listado",
    page: "employees-list",
    actions: ["Buscar trabajador", "Abrir expediente", "Consultar datos laborales"],
  },
  {
    id: "contracts",
    title: "Contratos",
    navigationLabels: ["Contratación", "Contratos", "Historial contratos"],
    description: "Crea, revisa y modifica relaciones contractuales.",
    keywords: "contrato contratos contratación jornada antigüedad sustitución temporal indefinido historial",
    page: "contracts",
    modeGroup: "contracts",
    modeValue: "history",
    actions: ["Consultar contratos", "Crear contrato", "Revisar jornada y vigencia"],
  },
  {
    id: "agreements",
    title: "Convenios colectivos",
    navigationLabels: ["Organización", "Convenios"],
    description: "Consulta convenios, categorías, tablas salariales y parametrización.",
    keywords: "convenio convenios colectivo categoria categoría tabla salarial salarios",
    page: "collective-agreements",
    actions: ["Consultar convenio", "Revisar categorías", "Consultar tablas salariales"],
  },
  {
    id: "incidents",
    title: "Incidencias laborales",
    navigationLabels: ["Gestión laboral", "Incidencias", "Resumen"],
    description: "Gestiona IT, ausencias, vacaciones, horas extra y otras incidencias.",
    keywords: "incidencia incidencias it incapacidad temporal baja medica médica vacaciones ausencia recaida recaída confirmacion confirmación",
    page: "incidents",
    modeGroup: "incidentCategory",
    modeValue: "all",
    actions: ["Registrar incidencia", "Consultar estado", "Revisar impacto en nómina"],
  },
  {
    id: "garnishments",
    title: "Embargos judiciales",
    navigationLabels: ["Gestión laboral", "Embargos judiciales"],
    description: "Calcula y gestiona retenciones derivadas de embargos salariales.",
    keywords: "embargo embargos judicial retencion retención salario smi",
    page: "incidents",
    modeGroup: "incidents",
    modeValue: "embargo",
    actions: ["Consultar embargo", "Calcular retención", "Revisar movimientos"],
  },
  {
    id: "payroll-preparation",
    title: "Preparación mensual de nómina",
    navigationLabels: ["Nómina", "Preparación mensual"],
    description: "Revisa el mes antes de generar nóminas y detecta incidencias pendientes.",
    keywords: "nomina nómina preparacion preparación mensual incidencias calcular mes",
    page: "payroll-monthly-preparation",
    actions: ["Preparar periodo", "Revisar incidencias", "Comprobar trabajadores"],
  },
  {
    id: "payroll-simulation",
    title: "Generar nóminas",
    navigationLabels: ["Nómina", "Generar nóminas"],
    description: "Calcula y simula nóminas para un periodo.",
    keywords: "nomina nómina nominas nóminas generar calcular simulacion simulación",
    page: "payroll-simulation",
    actions: ["Seleccionar periodo", "Generar nóminas", "Revisar resultados"],
  },
  {
    id: "payroll-history",
    title: "Histórico de nóminas",
    navigationLabels: ["Nómina", "Histórico de nóminas"],
    description: "Consulta recibos, periodos y cálculos realizados.",
    keywords: "nomina nómina nominas nóminas historico histórico recibo salario liquido líquido bruto",
    page: "payroll-history",
    actions: ["Buscar nómina", "Abrir recibo", "Consultar desglose"],
  },
  {
    id: "permanent-concepts",
    title: "Conceptos permanentes",
    navigationLabels: ["Nómina", "Conceptos salariales", "Conceptos permanentes"],
    description: "Gestiona conceptos salariales vinculados al contrato.",
    keywords: "concepto conceptos salarial salariales complemento plus importe permanente",
    page: "permanent-payroll-concepts",
    actions: ["Añadir concepto", "Modificar importe", "Revisar conceptos del contrato"],
  },
  {
    id: "affiliations",
    title: "Altas y bajas de afiliación",
    navigationLabels: ["Seguridad Social", "Afiliación", "Altas y bajas"],
    description: "Gestiona altas, bajas y variaciones de afiliación.",
    keywords: "afiliacion afiliación alta baja variacion variación seguridad social red naf",
    page: "affiliations",
    actions: ["Preparar alta", "Preparar baja", "Revisar situación de afiliación"],
  },
  {
    id: "affiliation-files",
    title: "Ficheros AFI",
    navigationLabels: ["Seguridad Social", "Afiliación", "Ficheros AFI"],
    description: "Prepara y revisa remesas de movimientos de afiliación.",
    keywords: "afi fichero afiliacion afiliación altas bajas masivas remesa",
    page: "affiliation-files",
    actions: ["Crear remesa", "Validar movimientos", "Preparar envío"],
  },
  {
    id: "social-security",
    title: "Seguros sociales",
    navigationLabels: ["Seguridad Social", "Cotización", "Seguros sociales"],
    description: "Consulta bases y cálculos de cotización del periodo.",
    keywords: "seguros sociales cotizacion cotización bases trabajadores seguridad social",
    page: "social-security-dashboard",
    actions: ["Revisar bases", "Consultar trabajadores", "Comprobar cotización"],
  },
  {
    id: "settlements",
    title: "Liquidaciones de Seguridad Social",
    navigationLabels: ["Seguridad Social", "Cotización", "Liquidaciones"],
    description: "Prepara liquidaciones y consulta resultados RLC/RNT.",
    keywords: "liquidacion liquidación liquidaciones rlc rnt seguros sociales cotizacion cotización",
    page: "social-security-settlements",
    actions: ["Preparar liquidación", "Revisar RNT", "Revisar RLC"],
  },
  {
    id: "social-security-files",
    title: "Ficheros de Seguridad Social",
    navigationLabels: ["Seguridad Social", "Cotización", "Ficheros generados"],
    description: "Consulta ficheros generados y su estado de envío simulado.",
    keywords: "fichero ficheros seguridad social siltra envio envío respuesta",
    page: "social-security-files",
    actions: ["Consultar fichero", "Revisar estado", "Abrir respuesta"],
  },
  {
    id: "cra",
    title: "Ficheros CRA",
    navigationLabels: ["Seguridad Social", "Cotización", "Ficheros CRA"],
    description: "Genera y valida conceptos retributivos abonados.",
    keywords: "cra fichero conceptos retributivos abonados seguridad social",
    page: "social-security-dashboard",
    hash: "#cra-files",
    actions: ["Generar CRA", "Validar conceptos", "Revisar incidencias"],
  },
  {
    id: "fie",
    title: "Comunicaciones INSS (FIE)",
    navigationLabels: ["Seguridad Social", "Comunicaciones", "Comunicaciones INSS (FIE)"],
    description: "Revisa y concilia comunicaciones recibidas del INSS.",
    keywords: "fie inss comunicación comunicacion baja médica medica incapacidad temporal",
    page: "fie-inss",
    hash: "#fie-inss",
    actions: ["Abrir comunicación", "Conciliar incidencia", "Revisar impacto en nómina"],
  },
  {
    id: "siltra",
    title: "SILTRA",
    navigationLabels: ["Seguridad Social", "SILTRA"],
    description: "Simula envíos y consulta respuestas de ficheros de Seguridad Social.",
    keywords: "siltra fichero ficheros envio envío respuesta seguridad social",
    launchSelector: ".siltra-global-launcher",
    actions: ["Seleccionar fichero", "Simular envío", "Consultar respuesta"],
  },
  {
    id: "irpf",
    title: "IRPF del trabajador",
    navigationLabels: ["Fiscalidad", "IRPF"],
    description: "Gestiona perfil fiscal, retención y regularización de IRPF.",
    keywords: "irpf retencion retención modelo 145 fiscal fiscalidad regularizacion regularización",
    page: "irpf",
    actions: ["Consultar perfil fiscal", "Calcular retención", "Regularizar IRPF"],
  },
  {
    id: "model111",
    title: "Modelo 111",
    navigationLabels: ["Fiscalidad", "Modelo 111"],
    description: "Prepara y simula la presentación trimestral del Modelo 111.",
    keywords: "modelo 111 aeat retenciones trimestral fiscalidad",
    page: "reports",
    hash: "#model-111",
    actions: ["Preparar declaración", "Revisar perceptores", "Simular presentación"],
  },
  {
    id: "model190",
    title: "Modelo 190",
    navigationLabels: ["Fiscalidad", "Modelo 190"],
    description: "Prepara el resumen anual y simula su presentación.",
    keywords: "modelo 190 aeat retenciones anual fiscalidad",
    page: "reports",
    hash: "#model-190",
    actions: ["Generar declaración", "Revisar perceptores", "Simular presentación"],
  },
  {
    id: "documents",
    title: "Documentos",
    navigationLabels: ["Documentación", "Documentos"],
    description: "Gestiona expediente documental, pendientes y documentación laboral.",
    keywords: "documento documentos documentación expediente adjunto certificado pendiente",
    page: "documents",
    hash: "#documents",
    actions: ["Consultar documentos", "Añadir documento", "Revisar pendientes"],
  },
  {
    id: "mail",
    title: "Correo formativo",
    navigationLabels: ["Correo formativo"],
    description: "Consulta mensajes de los casos prácticos, adjuntos y respuestas.",
    keywords: "correo email mail mensaje bandeja entrada responder adjunto",
    hash: "#mail",
    actions: ["Abrir mensaje", "Consultar adjuntos", "Responder al hilo"],
  },
];

const MODE_STORAGE_KEYS = {
  contracts: "aulanomina:contractsMode",
  companies: "aulanomina:companiesMode",
  incidents: "aulanomina:incidentsMode",
  incidentCategory: "aulanomina:incidentCategory",
};

const MODE_EVENTS = {
  contracts: "aulanomina-contract-mode",
  companies: "aulanomina-route-change",
  incidents: "aulanomina-incidents-mode",
  incidentCategory: "aulanomina-incident-category",
};

export function normalizeHelpText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function helpLocationPath(location) {
  return (location?.navigationLabels || []).join(" · ");
}

export function searchHelpLocations(query, locations = HELP_LOCATIONS) {
  const term = normalizeHelpText(query);
  if (!term) return locations;
  return locations.filter((item) => normalizeHelpText(
    `${item.title} ${helpLocationPath(item)} ${item.description} ${item.keywords}`
  ).includes(term));
}

export function findHelpLocationByLabels(labels, locations = HELP_LOCATIONS) {
  const normalizedLabels = (labels || []).map(normalizeHelpText).filter(Boolean);
  if (!normalizedLabels.length) return null;
  const activeLabel = normalizedLabels[normalizedLabels.length - 1];
  return locations.find((location) => {
    const candidates = [location.title, ...(location.navigationLabels || [])].map(normalizeHelpText);
    return candidates.includes(activeLabel);
  }) || null;
}

export function readCurrentNavigationContext(documentRef = typeof document !== "undefined" ? document : null) {
  if (!documentRef) return { labels: [], path: "", location: null };

  const group = documentRef.querySelector(
    ".an-sidebar__group-toggle.is-active .an-sidebar__group-label > span:last-child"
  )?.textContent?.trim();
  const parent = documentRef.querySelector(
    ".an-sidebar__item-row.has-active-child .an-sidebar__item"
  )?.textContent?.trim();
  const active = documentRef.querySelector(
    ".an-sidebar__subitem.is-active, .an-sidebar__item.is-active, .an-sidebar__panel.is-active"
  )?.textContent?.trim();

  const labels = [group, parent, active].filter((value, index, list) => value && list.indexOf(value) === index);
  return {
    labels,
    path: labels.join(" · "),
    location: findHelpLocationByLabels(labels),
  };
}

export function openHelpLocation(location, windowRef = typeof window !== "undefined" ? window : null) {
  if (!location || !windowRef) return;

  if (location.launchSelector) {
    windowRef.document?.querySelector(location.launchSelector)?.click();
    return;
  }

  if (location.modeGroup && location.modeValue) {
    const storageKey = MODE_STORAGE_KEYS[location.modeGroup];
    if (storageKey) windowRef.sessionStorage?.setItem(storageKey, location.modeValue);
  }

  if (location.hash) {
    if (windowRef.location.hash !== location.hash) windowRef.location.hash = location.hash;
  } else if (windowRef.location.hash) {
    windowRef.history.replaceState(null, "", `${windowRef.location.pathname}${windowRef.location.search}`);
  }

  if (location.page) {
    windowRef.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: location.page } }));
  }

  const modeEvent = location.modeGroup ? MODE_EVENTS[location.modeGroup] : null;
  if (modeEvent) windowRef.dispatchEvent(new Event(modeEvent));
  windowRef.dispatchEvent(new Event("aulanomina-route-change"));
}
