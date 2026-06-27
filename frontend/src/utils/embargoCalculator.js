const TRAMOS_LEGALES = [
  { nombre: "1º tramo", porcentaje: 0, tipo: "protegido" },
  { nombre: "2º tramo", porcentaje: 30, tipo: "smi" },
  { nombre: "3º tramo", porcentaje: 50, tipo: "smi" },
  { nombre: "4º tramo", porcentaje: 60, tipo: "smi" },
  { nombre: "5º tramo", porcentaje: 75, tipo: "smi" },
  { nombre: "Exceso", porcentaje: 90, tipo: "exceso" },
];

function redondear(value, decimales = 2) {
  const factor = 10 ** decimales;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function parseEuropeanAmount(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number(value);

  const cleaned = value.trim().replace(/[\s€]/g, "");
  if (!cleaned) return Number.NaN;

  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;

  return Number(normalized);
}

export function formatEuro(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function normalizarNumero(value, nombreCampo) {
  const numero = parseEuropeanAmount(value);
  if (!Number.isFinite(numero)) throw new TypeError(`${nombreCampo} debe ser un número válido.`);
  return numero;
}

function validarEntrada({
  liquido,
  smiAnual,
  porcentajeReduccion,
  pagasExtrasProrrateadas,
  incluyePagaExtraCompleta,
  importePagaExtra,
}) {
  if (liquido < 0) throw new RangeError("La cantidad líquida no puede ser negativa.");
  if (smiAnual <= 0) throw new RangeError("El SMI anual debe ser superior a 0.");
  if (porcentajeReduccion < 0 || porcentajeReduccion > 100) {
    throw new RangeError("El porcentaje de reducción debe estar entre 0 y 100.");
  }
  if (pagasExtrasProrrateadas && incluyePagaExtraCompleta) {
    throw new RangeError("Las pagas prorrateadas y la paga extra completa no pueden aplicarse a la vez.");
  }
  if (incluyePagaExtraCompleta && importePagaExtra <= 0) {
    throw new RangeError("El importe líquido de la paga extra debe ser superior a 0.");
  }
}

export function obtenerReferenciasSmi({
  smi,
  smiAnual = smi,
  pagasExtrasProrrateadas = false,
  incluyePagaExtraCompleta = false,
}) {
  const smiAnualNormalizado = normalizarNumero(smiAnual, "El SMI anual");
  if (smiAnualNormalizado <= 0) throw new RangeError("El SMI anual debe ser superior a 0.");
  if (pagasExtrasProrrateadas && incluyePagaExtraCompleta) {
    throw new RangeError("Las pagas prorrateadas y la paga extra completa no pueden aplicarse a la vez.");
  }

  const smiMensual = redondear(smiAnualNormalizado / 14);
  let minimoInembargable = smiMensual;

  if (pagasExtrasProrrateadas) minimoInembargable = redondear(smiAnualNormalizado / 12);
  if (incluyePagaExtraCompleta) minimoInembargable = redondear(smiMensual * 2);

  return {
    smiAnual: redondear(smiAnualNormalizado),
    smiMensual,
    minimoInembargable,
  };
}

export function calcularEmbargo({
  liquido,
  smi,
  smiAnual = smi,
  porcentajeReduccion = 0,
  pagasExtrasProrrateadas = false,
  incluyePagaExtraCompleta = false,
  importePagaExtra = 0,
  cargasFamiliares = false,
}) {
  const liquidoNormalizado = normalizarNumero(liquido, "La cantidad líquida");
  const smiAnualNormalizado = normalizarNumero(smiAnual, "El SMI anual");
  const reduccionNormalizada = normalizarNumero(porcentajeReduccion, "El porcentaje de reducción");
  const pagaExtraNormalizada = incluyePagaExtraCompleta
    ? normalizarNumero(importePagaExtra, "El importe líquido de la paga extra")
    : 0;

  validarEntrada({
    liquido: liquidoNormalizado,
    smiAnual: smiAnualNormalizado,
    porcentajeReduccion: reduccionNormalizada,
    pagasExtrasProrrateadas,
    incluyePagaExtraCompleta,
    importePagaExtra: pagaExtraNormalizada,
  });

  const referencias = obtenerReferenciasSmi({
    smiAnual: smiAnualNormalizado,
    pagasExtrasProrrateadas,
    incluyePagaExtraCompleta,
  });
  const liquidoFinalCalculado = redondear(liquidoNormalizado + pagaExtraNormalizada);
  const smiMensualCentimos = Math.round(referencias.smiMensual * 100);
  const minimoInembargableCentimos = Math.round(referencias.minimoInembargable * 100);
  let pendienteCentimos = Math.round(liquidoFinalCalculado * 100);

  const tramos = TRAMOS_LEGALES.map((tramo) => {
    let limiteCentimos;
    let smiReferencia;

    if (tramo.tipo === "protegido") {
      limiteCentimos = minimoInembargableCentimos;
      smiReferencia = referencias.minimoInembargable;
    } else if (tramo.tipo === "smi") {
      limiteCentimos = smiMensualCentimos;
      smiReferencia = referencias.smiMensual;
    } else {
      limiteCentimos = pendienteCentimos;
      smiReferencia = referencias.smiMensual;
    }

    const baseTramoCentimos = Math.max(0, Math.min(pendienteCentimos, limiteCentimos));
    pendienteCentimos -= baseTramoCentimos;

    const admiteReduccion = tramo.porcentaje > 0
      && (!cargasFamiliares || tramo.porcentaje < 90);
    const porcentajeAplicado = admiteReduccion
      ? redondear(tramo.porcentaje * (1 - reduccionNormalizada / 100))
      : tramo.porcentaje;
    const importeEmbargableCentimos = Math.round(baseTramoCentimos * (porcentajeAplicado / 100));

    return {
      nombre: tramo.nombre,
      baseTramo: redondear(baseTramoCentimos / 100),
      smiReferencia: redondear(smiReferencia),
      porcentaje: tramo.porcentaje,
      porcentajeAplicado,
      importeEmbargable: redondear(importeEmbargableCentimos / 100),
    };
  });

  return {
    totalEmbargable: redondear(
      tramos.reduce((total, tramo) => total + tramo.importeEmbargable, 0)
    ),
    liquidoFinalCalculado,
    smiAnual: referencias.smiAnual,
    smiMensual: referencias.smiMensual,
    minimoInembargable: referencias.minimoInembargable,
    tramos,
  };
}
