export const TRAINING_HELP_LOCATIONS = [
  {
    key: "companies",
    title: "Empresas y centros de trabajo",
    path: "Organización · Empresas / centros",
    description: "Consulta empresas, CCC y la estructura de centros de trabajo.",
    keywords: "empresa empresas centro centros ccc cif estructura organización",
    page: "companies",
    hash: "#company-list",
    sidebarLabels: ["Empresas / centros"],
    headerTitles: ["Empresas / Centros"],
    actions: ["Consultar empresas existentes", "Revisar centros y CCC", "Crear o editar datos de empresa"],
  },
  {
    key: "employees-list",
    title: "Listado de trabajadores",
    path: "Personas · Trabajadores · Listado de trabajadores",
    description: "Busca y abre expedientes de personas trabajadoras.",
    keywords: "trabajador trabajadores persona empleado expediente buscar dni naf listado",
    page: "employees-list",
    sidebarLabels: ["Trabajadores", "Listado de trabajadores"],
    headerTitles: ["Listado de trabajadores"],
    actions: ["Buscar un trabajador", "Abrir su expediente", "Comprobar empresa y centro asignados"],
  },
  {
    key: "employee-new",
    title: "Alta de trabajador",
    path: "Personas · Trabajadores · Nuevo trabajador",
    description: "Crea un nuevo expediente laboral.",
    keywords: "alta crear nuevo trabajador empleado persona expediente",
    page: "employees",
    sidebarLabels: ["Nuevo trabajador"],
    headerTitles: ["Nuevo trabajador"],
    actions: ["Crear el expediente", "Asignar empresa y centro", "Completar datos identificativos"],
  },
  {
    key: "employee-record",
    title: "Expediente del trabajador",
    path: "Personas · Trabajadores · Expediente",
    description: "Revisa la información laboral y documental de un trabajador.",
    keywords: "expediente trabajador histórico historial ficha persona",
    page: "employee-record",
    sidebarLabels: ["Expediente"],
    headerTitles: ["Expediente del trabajador"],
    actions: ["Revisar datos personales", "Consultar relación laboral", "Acceder a información vinculada"],
  },
  {
    key: "contracts",
    title: "Contratos",
    path: "Contratación · Contratos",
    description: "Da de alta, revisa y modifica relaciones contractuales.",
    keywords: "contrato contratos contratación jornada antigüedad sustitución temporal indefinido",
    page: "contracts",
    sidebarLabels: ["Contratos", "Historial contratos"],
    headerTitles: ["Contratos", "Nuevo contrato", "Historial de contratos", "Impresión de contratos"],
    actions: ["Crear un contrato", "Consultar el historial contractual", "Revisar jornada, fechas y código de contrato"],
  },
  {
    key: "agreements",
    title: "Convenios colectivos",
    path: "Organización · Convenios",
    description: "Consulta convenios, categorías, tablas salariales y parametrización.",
    keywords: "convenio convenios colectivo categoria categoría tabla salarial salarios",
    page: "collective-agreements",
    sidebarLabels: ["Convenios"],
    headerTitles: ["Convenios colectivos", "Convenios"],
    actions: ["Consultar el convenio", "Revisar categorías", "Comprobar tablas y reglas salariales"],
  },
  {
    key: "incidents",
    title: "Incidencias laborales",
    path: "Gestión laboral · Incidencias",
    description: "Gestiona IT, ausencias, vacaciones y otras incidencias del trabajador.",
    keywords: "incidencia incidencias it incapacidad temporal baja medica médica vacaciones ausencia recaida recaída confirmacion confirmación",
    page: "incidents",
    sidebarLabels: ["Incidencias", "IT y prestaciones", "Vacaciones"],
    headerTitles: ["Incidencias", "Gestión de incidencias"],
    actions: ["Registrar una incidencia", "Consultar IT y prestaciones", "Comprobar su efecto en nómina"],
  },
  {
    key: "garnishments",
    title: "Embargos judiciales",
    path: "Gestión laboral · Embargos judiciales",
    description: "Consulta y gestiona retenciones judiciales aplicables al trabajador.",
    keywords: "embargo embargos judicial retencion retención smi deuda",
    page: "incidents",
    modeGroup: "incidents",
    modeValue: "embargo",
    sidebarLabels: ["Embargos judiciales"],
    headerTitles: ["Embargos judiciales", "Gestión de embargos"],
    actions: ["Abrir el expediente de embargo", "Revisar deuda y prioridad", "Consultar movimientos por nómina"],
  },
  {
    key: "payroll-preparation",
    title: "Preparación mensual de nómina",
    path: "Nómina · Preparación mensual",
    description: "Prepara el periodo y revisa qué trabajadores deben entrar en nómina.",
    keywords: "nomina nómina preparación mensual periodo preparar",
    page: "payroll-monthly-preparation",
    sidebarLabels: ["Preparación mensual"],
    headerTitles: ["Preparación mensual"],
    actions: ["Seleccionar periodo", "Revisar trabajadores incluidos", "Detectar incidencias previas al cálculo"],
  },
  {
    key: "payroll-simulation",
    title: "Generar nóminas",
    path: "Nómina · Generar nóminas",
    description: "Calcula y simula las nóminas del periodo.",
    keywords: "nomina nómina generar calcular simulacion simulación recibo",
    page: "payroll-simulation",
    sidebarLabels: ["Generar nóminas"],
    headerTitles: ["Generar nóminas", "Simulación de nóminas"],
    actions: ["Elegir periodo", "Generar el cálculo", "Revisar importes antes de continuar"],
  },
  {
    key: "payroll-history",
    title: "Histórico de nóminas",
    path: "Nómina · Histórico de nóminas",
    description: "Consulta nóminas calculadas, periodos e importes.",
    keywords: "nomina nómina nominas nóminas historico histórico recibo salario liquido líquido bruto",
    page: "payroll-history",
    sidebarLabels: ["Histórico de nóminas"],
    headerTitles: ["Histórico de nóminas", "Histórico nóminas"],
    actions: ["Buscar una nómina", "Revisar devengos y deducciones", "Consultar el resultado del periodo"],
  },
  {
    key: "payroll-concepts",
    title: "Conceptos salariales",
    path: "Nómina · Conceptos salariales",
    description: "Gestiona conceptos permanentes y consulta su histórico.",
    keywords: "concepto conceptos salarial salariales complemento plus importe permanente",
    page: "permanent-payroll-concepts",
    sidebarLabels: ["Conceptos salariales", "Conceptos permanentes"],
    headerTitles: ["Conceptos permanentes", "Conceptos salariales"],
    actions: ["Añadir un concepto al contrato", "Revisar importe y vigencia", "Consultar conceptos históricos"],
  },
  {
    key: "irpf",
    title: "IRPF del trabajador",
    path: "Fiscalidad · IRPF",
    description: "Consulta el perfil fiscal, la retención y sus regularizaciones.",
    keywords: "irpf retencion retención modelo 145 fiscal fiscalidad regularizacion regularización",
    page: "irpf",
    sidebarLabels: ["IRPF"],
    headerTitles: ["IRPF", "Fiscalidad IRPF"],
    actions: ["Revisar datos fiscales", "Calcular la retención", "Comprobar una regularización"],
  },
  {
    key: "affiliations",
    title: "Afiliación",
    path: "Seguridad Social · Afiliación · Altas y bajas",
    description: "Gestiona altas, bajas y variaciones de afiliación.",
    keywords: "afiliacion afiliación alta baja variacion variación seguridad social red naf",
    page: "affiliations",
    sidebarLabels: ["Afiliación", "Altas y bajas"],
    headerTitles: ["Altas, modificaciones y bajas", "Afiliación"],
    actions: ["Preparar un alta o baja", "Revisar datos RED", "Comprobar la situación del trabajador"],
  },
  {
    key: "affiliation-files",
    title: "Ficheros AFI",
    path: "Seguridad Social · Afiliación · Ficheros AFI",
    description: "Prepara y revisa remesas de movimientos de afiliación.",
    keywords: "afi fichero afiliacion afiliación altas bajas masivas remesa",
    page: "affiliation-files",
    sidebarLabels: ["Ficheros AFI"],
    headerTitles: ["Ficheros AFI", "Ficheros de afiliación"],
    actions: ["Crear una remesa", "Revisar movimientos incluidos", "Simular su envío"],
  },
  {
    key: "fie",
    title: "Comunicaciones INSS (FIE)",
    path: "Seguridad Social · Comunicaciones · Comunicaciones INSS (FIE)",
    description: "Revisa y concilia comunicaciones recibidas del INSS.",
    keywords: "fie inss comunicación comunicacion baja médica medica incapacidad temporal",
    page: "fie-inss",
    hash: "#fie-inss",
    sidebarLabels: ["Comunicaciones", "Comunicaciones INSS (FIE)"],
    headerTitles: ["Comunicaciones INSS (FIE)", "FIE"],
    actions: ["Abrir una comunicación", "Vincularla con trabajador e incidencia", "Revisar discrepancias"],
  },
  {
    key: "social-security",
    title: "Seguros sociales",
    path: "Seguridad Social · Cotización · Seguros sociales",
    description: "Consulta bases, liquidaciones y documentos RLC/RNT.",
    keywords: "seguros sociales cotizacion cotización rlc rnt liquidacion liquidación bases",
    page: "social-security-dashboard",
    sidebarLabels: ["Cotización", "Seguros sociales"],
    headerTitles: ["Seguros sociales", "Seguridad Social"],
    actions: ["Revisar bases de cotización", "Consultar RLC/RNT", "Comprobar diferencias del periodo"],
  },
  {
    key: "social-security-settlements",
    title: "Liquidaciones",
    path: "Seguridad Social · Cotización · Liquidaciones",
    description: "Consulta y prepara liquidaciones de Seguridad Social.",
    keywords: "liquidacion liquidación cotización l00 l03 seguridad social",
    page: "social-security-settlements",
    sidebarLabels: ["Liquidaciones"],
    headerTitles: ["Liquidaciones"],
    actions: ["Abrir una liquidación", "Revisar trabajadores y bases", "Comprobar estado del cálculo"],
  },
  {
    key: "cra",
    title: "Ficheros CRA",
    path: "Seguridad Social · Cotización · Ficheros CRA",
    description: "Genera y valida la comunicación de conceptos retributivos abonados.",
    keywords: "cra conceptos retributivos abonados fichero cotizacion cotización",
    page: "social-security-dashboard",
    hash: "#cra-files",
    sidebarLabels: ["Ficheros CRA"],
    headerTitles: ["Ficheros CRA", "CRA"],
    actions: ["Generar el fichero", "Revisar conceptos incluidos", "Validar incidencias antes del envío"],
  },
  {
    key: "siltra",
    title: "SILTRA",
    path: "Seguridad Social · SILTRA",
    description: "Simula envíos y consulta respuestas de ficheros de Seguridad Social.",
    keywords: "siltra fichero ficheros envio envío respuesta seguridad social",
    launchSelector: ".siltra-global-launcher",
    sidebarLabels: ["SILTRA"],
    headerTitles: ["SILTRA"],
    actions: ["Seleccionar un fichero", "Simular el envío", "Revisar la respuesta recibida"],
  },
  {
    key: "documents",
    title: "Documentos",
    path: "Documentación · Documentos",
    description: "Gestiona expediente documental, pendientes y documentación laboral.",
    keywords: "documento documentos documentación expediente adjunto certificado pendiente",
    page: "documents",
    hash: "#documents",
    sidebarLabels: ["Documentos"],
    headerTitles: ["Documentos", "Documentación"],
    actions: ["Buscar documentación", "Revisar pendientes", "Vincular documentos al expediente"],
  },
  {
    key: "mail",
    title: "Correo formativo",
    path: "Correo formativo",
    description: "Consulta mensajes de casos prácticos, adjuntos y respuestas.",
    keywords: "correo email mail mensaje bandeja entrada responder adjunto",
    hash: "#mail",
    sidebarLabels: [],
    headerTitles: ["Correo", "Correo formativo"],
    actions: ["Abrir el mensaje del caso", "Revisar sus adjuntos", "Responder en el mismo hilo cuando proceda"],
  },
  {
    key: "model111",
    title: "Modelo 111",
    path: "Fiscalidad · Modelo 111",
    description: "Prepara y simula la presentación trimestral del Modelo 111.",
    keywords: "modelo 111 aeat retenciones trimestral fiscalidad",
    page: "reports",
    hash: "#model-111",
    sidebarLabels: ["Modelo 111"],
    headerTitles: ["Modelo 111"],
    actions: ["Seleccionar periodo", "Revisar perceptores e importes", "Simular la presentación"],
  },
  {
    key: "model190",
    title: "Modelo 190",
    path: "Fiscalidad · Modelo 190",
    description: "Prepara el resumen anual y simula la presentación del Modelo 190.",
    keywords: "modelo 190 aeat retenciones anual fiscalidad",
    page: "reports",
    hash: "#model-190",
    sidebarLabels: ["Modelo 190"],
    headerTitles: ["Modelo 190"],
    actions: ["Seleccionar ejercicio", "Reconciliar perceptores", "Simular la presentación anual"],
  },
];

export function normalizeHelpTerm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterHelpLocations(query, locations = TRAINING_HELP_LOCATIONS) {
  const term = normalizeHelpTerm(query);
  if (!term) return locations;
  const tokens = term.split(/\s+/).filter(Boolean);
  return locations.filter((item) => {
    const haystack = normalizeHelpTerm(
      `${item.title} ${item.path} ${item.description} ${item.keywords || ""} ${(item.sidebarLabels || []).join(" ")}`
    );
    return tokens.every((token) => haystack.includes(token));
  });
}

export function resolveHelpContext({ title = "", eyebrow = "", hash = "" } = {}, locations = TRAINING_HELP_LOCATIONS) {
  const normalizedTitle = normalizeHelpTerm(title);
  const normalizedEyebrow = normalizeHelpTerm(eyebrow);

  if (hash) {
    const hashMatch = locations.find((item) => item.hash === hash);
    if (hashMatch) return hashMatch;
  }

  if (normalizedTitle) {
    const titleMatch = locations.find((item) => (item.headerTitles || []).some(
      (candidate) => normalizeHelpTerm(candidate) === normalizedTitle
    ));
    if (titleMatch) return titleMatch;
  }

  if (normalizedEyebrow) {
    const eyebrowMatch = locations.find((item) => normalizeHelpTerm(item.path).startsWith(normalizedEyebrow));
    if (eyebrowMatch) return eyebrowMatch;
  }

  return null;
}

export function sidebarLabelsForHelp(locations = TRAINING_HELP_LOCATIONS) {
  return [...new Set(locations.flatMap((item) => item.sidebarLabels || []).filter(Boolean))];
}
