const TRAMOS_LEGALES = [
  { nombre: "1º tramo", porcentaje: 0, tipo: "protegido" },
  { nombre: "2º tramo", porcentaje: 30, tipo: "smi" },
  { nombre: "3º tramo", porcentaje: 50, tipo: "smi" },
  { nombre: "4º tramo", porcentaje: 60, tipo: "smi" },
  { nombre: "5º tramo", porcentaje: 75, tipo: "smi" },
  { nombre: "Exceso", porcentaje: 90, tipo: "exceso" },
];

const redondear = (value, decimales = 2) => {
  const factor = 10 ** decimales;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function parseEuropeanAmount(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number(value);
  const cleaned = value.trim().replace(/[\s€]/g, "");
  if (!cleaned) return Number.NaN;
  return Number(cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned);
}

export function formatEuro(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function numero(value, nombre) {
  const result = parseEuropeanAmount(value);
  if (!Number.isFinite(result)) throw new TypeError(`${nombre} debe ser un número válido.`);
  return result;
}

function validar(datos) {
  if (datos.liquido < 0) throw new RangeError("La cantidad líquida no puede ser negativa.");
  if (datos.smiAnual <= 0) throw new RangeError("El SMI anual debe ser superior a 0.");
  if (datos.porcentajeReduccion < 0 || datos.porcentajeReduccion > 100) {
    throw new RangeError("El porcentaje de reducción debe estar entre 0 y 100.");
  }
  if (datos.pagasExtrasProrrateadas && datos.incluyePagaExtraCompleta) {
    throw new RangeError("Las pagas prorrateadas y la paga extra completa no pueden aplicarse a la vez.");
  }
  if (datos.incluyePagaExtraCompleta && datos.importePagaExtra <= 0) {
    throw new RangeError("El importe líquido de la paga extra debe ser superior a 0.");
  }
}

export function obtenerReferenciasSmi({
  smi,
  smiAnual = smi,
  pagasExtrasProrrateadas = false,
  incluyePagaExtraCompleta = false,
}) {
  const anual = numero(smiAnual, "El SMI anual");
  if (anual <= 0) throw new RangeError("El SMI anual debe ser superior a 0.");
  if (pagasExtrasProrrateadas && incluyePagaExtraCompleta) {
    throw new RangeError("Las pagas prorrateadas y la paga extra completa no pueden aplicarse a la vez.");
  }

  const smiMensual = redondear(anual / 14);
  const smiProrrateado = redondear(anual / 12);
  const minimoInembargable = incluyePagaExtraCompleta
    ? redondear(smiMensual * 2)
    : pagasExtrasProrrateadas ? smiProrrateado : smiMensual;

  return {
    smiAnual: redondear(anual),
    smiMensual,
    smiProrrateado,
    minimoInembargable,
    unidadTramo: smiMensual,
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
  const datos = {
    liquido: numero(liquido, "La cantidad líquida"),
    smiAnual: numero(smiAnual, "El SMI anual"),
    porcentajeReduccion: numero(porcentajeReduccion, "El porcentaje de reducción"),
    pagasExtrasProrrateadas,
    incluyePagaExtraCompleta,
    importePagaExtra: incluyePagaExtraCompleta ? numero(importePagaExtra, "El importe líquido de la paga extra") : 0,
  };
  validar(datos);

  const referencias = obtenerReferenciasSmi(datos);
  const liquidoFinalCalculado = redondear(datos.liquido + datos.importePagaExtra);
  let pendiente = Math.round(liquidoFinalCalculado * 100);
  const protegido = Math.round(referencias.minimoInembargable * 100);
  const unidad = Math.round(referencias.unidadTramo * 100);

  const tramos = TRAMOS_LEGALES.map((tramo) => {
    const limite = tramo.tipo === "protegido" ? protegido : tramo.tipo === "smi" ? unidad : pendiente;
    const baseCentimos = Math.max(0, Math.min(pendiente, limite));
    pendiente -= baseCentimos;
    const porcentajeAplicado = tramo.porcentaje > 0 && tramo.porcentaje < 90
      ? Math.max(0, redondear(tramo.porcentaje - datos.porcentajeReduccion))
      : tramo.porcentaje;
    return {
      nombre: tramo.nombre,
      baseTramo: redondear(baseCentimos / 100),
      smiReferencia: tramo.tipo === "protegido" ? referencias.minimoInembargable : referencias.unidadTramo,
      porcentaje: tramo.porcentaje,
      porcentajeAplicado,
      importeEmbargable: redondear(Math.round(baseCentimos * porcentajeAplicado / 100) / 100),
    };
  });

  return {
    totalEmbargable: redondear(tramos.reduce((total, tramo) => total + tramo.importeEmbargable, 0)),
    liquidoFinalCalculado,
    ...referencias,
    cargasFamiliares,
    tramos,
  };
}
