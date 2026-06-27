import assert from "node:assert/strict";
import test from "node:test";
import { calcularEmbargo, parseEuropeanAmount } from "../utils/embargoCalculator.js";

const calc = (liquido, datos = {}) => calcularEmbargo({ liquido, smiAnual: 17094, ...datos });

test("calculator boundaries", () => {
  assert.equal(calc(1000).totalEmbargable, 0);
  assert.equal(calc(1221).totalEmbargable, 0);
  assert.equal(calc(1500).totalEmbargable, 83.7);
  assert.equal(calcularEmbargo({ liquido: 2400, smiAnual: 16576 }).totalEmbargable, 371.2);
  assert.equal(calcularEmbargo({ liquido: 6000, smiAnual: 14000 }).totalEmbargable, 3050);
});

test("prorated payments", () => {
  const result = calc(4000, { pagasExtrasProrrateadas: true });
  assert.equal(result.minimoInembargable, 1424.5);
  assert.equal(result.unidadTramo, 1221);
  assert.deepEqual(result.tramos.slice(0, 4).map((tramo) => tramo.baseTramo), [1424.5, 1221, 1221, 133.5]);
  assert.equal(result.totalEmbargable, 1056.9);
});

test("full extra payment", () => {
  const result = calc(1800, { incluyePagaExtraCompleta: true, importePagaExtra: 1200 });
  assert.equal(result.liquidoFinalCalculado, 3000);
  assert.equal(result.minimoInembargable, 2442);
  assert.equal(result.unidadTramo, 1221);
  assert.equal(result.totalEmbargable, 167.4);
});

test("court reduction", () => {
  const result = calcularEmbargo({ liquido: 6000, smiAnual: 14000, porcentajeReduccion: 10 });
  assert.deepEqual(result.tramos.map((tramo) => tramo.porcentajeAplicado), [0, 20, 40, 50, 65, 90]);
  assert.equal(result.totalEmbargable, 2650);
});

test("validation and european format", () => {
  assert.equal(parseEuropeanAmount("17.094,00 €"), 17094);
  assert.throws(() => calcularEmbargo({ liquido: -1, smiAnual: 17094 }));
  assert.throws(() => calcularEmbargo({ liquido: 1000, smiAnual: 0 }));
  assert.throws(() => calc(1000, { porcentajeReduccion: 101 }));
  assert.throws(() => calc(2000, { pagasExtrasProrrateadas: true, incluyePagaExtraCompleta: true, importePagaExtra: 1000 }));
});
