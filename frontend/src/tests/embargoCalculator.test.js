import assert from "node:assert/strict";
import test from "node:test";
import { calcularEmbargo, obtenerReferenciasSmi, parseEuropeanAmount } from "../utils/embargoCalculator.js";

const SMI = 17094;
const calcular = (liquido, opciones = {}) => calcularEmbargo({ liquido, smiAnual: SMI, ...opciones });

test("inferior e igual al SMI", () => {
  assert.equal(calcular(1000).totalEmbargable, 0);
  assert.equal(calcular(1221).totalEmbargable, 0);
});

test("entre uno y dos SMI", () => {
  const resultado = calcular(1500);
  assert.equal(resultado.tramos[1].baseTramo, 279);
  assert.equal(resultado.totalEmbargable, 83.7);
});

test("superior a dos SMI", () => {
  assert.equal(calcularEmbargo({ liquido: 2400, smiAnual: 16576 }).totalEmbargable, 371.2);
});

test("superior a cinco SMI", () => {
  const resultado = calcularEmbargo({ liquido: 6000, smiAnual: 14000 });
  assert.equal(resultado.totalEmbargable, 3050);
  assert.equal(resultado.tramos[5].importeEmbargable, 900);
});

test("reducción por cargas familiares", () => {
  const resultado = calcularEmbargo({ liquido: 6000, smiAnual: 14000, porcentajeReduccion: 10, cargasFamiliares: true });
  assert.deepEqual(resultado.tramos.map((tramo) => tramo.porcentajeAplicado), [0, 20, 40, 50, 65, 90]);
  assert.equal(resultado.totalEmbargable, 2650);
});

test("pagas prorrateadas", () => {
  const resultado = calcular(4000, { pagasExtrasProrrateadas: true });
  assert.equal(resultado.minimoInembargable, 1424.5);
  assert.equal(resultado.unidadTramo, 1424.5);
  assert.deepEqual(resultado.tramos.slice(0, 3).map((tramo) => tramo.baseTramo), [1424.5, 1424.5, 1151]);
  assert.equal(resultado.totalEmbargable, 1002.85);
});

test("paga extra completa", () => {
  const resultado = calcular(1800, { incluyePagaExtraCompleta: true, importePagaExtra: 1200 });
  assert.equal(resultado.liquidoFinalCalculado, 3000);
  assert.equal(resultado.minimoInembargable, 2442);
  assert.equal(resultado.unidadTramo, 1221);
  assert.equal(resultado.totalEmbargable, 167.4);
});

test("referencias SMI anual", () => {
  assert.deepEqual(obtenerReferenciasSmi({ smiAnual: SMI }), {
    smiAnual: 17094,
    smiMensual: 1221,
    smiProrrateado: 1424.5,
    minimoInembargable: 1221,
    unidadTramo: 1221,
  });
});

test("validaciones", () => {
  assert.throws(() => calcularEmbargo({ liquido: -1, smiAnual: SMI }), /negativa/);
  assert.throws(() => calcularEmbargo({ liquido: 1000, smiAnual: 0 }), /superior a 0/);
  assert.throws(() => calcular(1000, { porcentajeReduccion: 101 }), /entre 0 y 100/);
  assert.throws(() => calcular(2000, { pagasExtrasProrrateadas: true, incluyePagaExtraCompleta: true, importePagaExtra: 1000 }), /a la vez/);
});

test("formato europeo", () => {
  assert.equal(parseEuropeanAmount("17.094,00 €"), 17094);
});
