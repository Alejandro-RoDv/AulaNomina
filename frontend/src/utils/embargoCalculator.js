const TRAMOS_LEGALES = [
  { nombre: "1º tramo", porcentaje: 0, unidadesSmi: 1 },
  { nombre: "2º tramo", porcentaje: 30, unidadesSmi: 1 },
  { nombre: "3º tramo", porcentaje: 50, unidadesSmi: 1 },
  { nombre: "4º tramo", porcentaje: 60, unidadesSmi: 1 },
  { nombre: "5º tramo", porcentaje: 75, unidadesSmi: 1 },
  { nombre: "Exceso", porcentaje: 90, unidadesSmi: null },
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
  smi,
  porcentajeReduccion,
  pagasExtrasProrrateadas,
  smiProrrateado,
  incluyePagaExtraCompleta,
  importePagaExtra,
}) {
  if (liquido < 0) throw new RangeError("La cantidad líquida no puede ser negativa.");
  if (smi <= 0) throw new RangeError("El SMI debe ser superior a 0.");
  if (porcentajeReduccion < 0 || porcentajeReduccion > 100) {
    throw new RangeError("El porcentaje de reducción debe estar entre 0 y 100.");
  }
  if (pagasExtrasProrrateadas && smiProrrateado <= 0) {
    throw new RangeError("El SMI prorrateado debe ser superior a 0.");
  }
  if (incluyePagaExtraCompleta && importePagaExtra < 0) {
    throw new RangeError("El importe de la paga extra no puede ser negativo.");
  }
}

export function calcularEmbargo({
  liquido,
  smi,
  porcentajeReduccion = 0,
  pagasExtrasProrrateadas = false,
  smiProrrateado,
  incluyePagaExtraCompleta = false,
  importePagaExtra,
  cargasFamiliares = false,
}) {
  const liquidoNormalizado = normalizarNumero(liquido, "La cantidad líquida");
  const smiNormalizado = normalizarNumero(smi, "El SMI");
  const reduccionNormalizada = normalizarNumero(porcentajeReduccion, "El porcentaje de reducción");
  const smiProrrateadoNormalizado = pagasExtrasProrrateadas
    ? normalizarNumero(smiProrrateado ?? smiNormalizado, "El SMI prorrateado")
    : smiNormalizado;
  const pagaExtraNormalizada = incluyePagaExtraCompleta
    ? normalizarNumero(importePagaExtra ?? smiProrrateadoNormalizado, "El importe de la paga extra")
    : 0;

  validarEntrada({
    liquido: liquidoNormalizado,
    smi: smiNormalizado,
    porcentajeReduccion: reduccionNormalizada,
    pagasExtrasProrrateadas,
    smiProrrateado: smiProrrateadoNormalizado,
    incluyePagaExtraCompleta,
    importePagaExtra: pagaExtraNormalizada,
  });

  const smiReferencia = pagasExtrasProrrateadas ? smiProrrateadoNormalizado : smiNormalizado;
  const liquidoFinalCalculado = redondear(liquidoNormalizado + pagaExtraNormalizada);
  const smiCentimos = Math.round(smiReferencia * 100);
  let pendienteCentimos = Math.round(liquidoFinalCalculado * 100);

  const tramos = TRAMOS_LEGALES.map((tramo) => {
    const limiteCentimos = tramo.unidadesSmi === null ? pendienteCentimos : smiCentimos * tramo.unidadesSmi;
    const baseTramoCentimos = Math.max(0, Math.min(pendienteCentimos, limiteCentimos));
    pendienteCentimos -= baseTramoCentimos;

    const admiteReduccion = tramo.porcentaje > 0 && (!cargasFamiliares || tramo.porcentaje < 90);
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

  const totalEmbargable = redondear(
    tramos.reduce((total, tramo) => total + tramo.importeEmbargable, 0)
  );

  return {
    totalEmbargable,
    liquidoFinalCalculado,
    tramos,
  };
}
