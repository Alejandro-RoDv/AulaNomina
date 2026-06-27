import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularEmbargo,
  obtenerReferenciasSmi,
  parseEuropeanAmount,
} from "../utils/embargoCalculator.js";

const SMI_ANUAL_2026 = 17094;

test("salario inferior al SMI mensual", () => {
  const resultado = calcularEmbargo({ liquido: 1000, smiAnual: SMI_ANUAL_2026 });
  assert.equal(resultado.totalEmbargable, 0);
});

test("salario igual al SMI mensual", () => {
  const resultado = calcularEmbargo({ liquido: 1221, smiAnual: SMI_ANUAL_2026 });
  assert.equal(resultado.totalEmbargable, 0);
});

test("salario entre 1 y 2 SMI", () => {
  const resultado = calcularEmbargo({ liquido: 1500, smiAnual: SMI_ANUAL_2026 });
  assert.equal(resultado.totalEmbargable, 83.7);
  assert.equal(resultado.tramos[1].baseTramo, 279);
});

test("salario superior a 2 SMI", () => {
  const resultado = calcularEmbargo({ liquido: 2400, smiAnual: 16576 });
  assert.equal(resultado.smiMensual, 1184);
  assert.equal(resultado.totalEmbargable, 371.2);
});

test("salario superior a 5 SMI", () => {
  const resultado = calcularEmbargo({ liquido: 6000, smiAnual: 14000 });
  assert.equal(resultado.totalEmbargable, 3050);
  assert.equal(resultado.tramos[5].importeEmbargable, 900);
});

test("reducción por cargas familiares", () => {
  const resultado = calcularEmbargo({
    liquido: 2000,
    smiAnual: 14000,
    porcentajeReduccion: 10,
    cargasFamiliares: true,
  });

  assert.equal(resultado.tramos[1].porcentajeAplicado, 27);
  assert.equal(resultado.totalEmbargable, 270);
});

test("la reducción por cargas familiares no altera el exceso al 90%", () => {
  const resultado = calcularEmbargo({
    liquido: 6000,
    smiAnual: 14000,
    porcentajeReduccion: 10,
    cargasFamiliares: true,
  });

  assert.equal(resultado.tramos[5].porcentajeAplicado, 90);
  assert.equal(resultado.totalEmbargable, 2835);
});

test("pagas extras prorrateadas usan el SMI anual dividido entre 12", () => {
  const resultado = calcularEmbargo({
    liquido: 2400,
    smiAnual: SMI_ANUAL_2026,
    pagasExtrasProrrateadas: true,
  });

  assert.equal(resultado.minimoInembargable, 1424.5);
  assert.equal(resultado.tramos[0].baseTramo, 1424.5);
  assert.equal(resultado.tramos[1].baseTramo, 975.5);
  assert.equal(resultado.totalEmbargable, 292.65);
});

test("mes con paga extra completa protege el doble del SMI mensual", () => {
  const resultado = calcularEmbargo({
    liquido: 1800,
    smiAnual: SMI_ANUAL_2026,
    incluyePagaExtraCompleta: true,
    importePagaExtra: 1200,
  });

  assert.equal(resultado.liquidoFinalCalculado, 3000);
  assert.equal(resultado.minimoInembargable, 2442);
  assert.equal(resultado.tramos[0].baseTramo, 2442);
  assert.equal(resultado.tramos[1].baseTramo, 558);
  assert.equal(resultado.totalEmbargable, 167.4);
});

test("calcula las referencias mensuales desde el SMI anual", () => {
  assert.deepEqual(
    obtenerReferenciasSmi({ smiAnual: SMI_ANUAL_2026 }),
    { smiAnual: 17094, smiMensual: 1221, minimoInembargable: 1221 }
  );
});

test("impide combinar pagas prorrateadas y paga extra completa", () => {
  assert.throws(
    () => calcularEmbargo({
      liquido: 2000,
      smiAnual: SMI_ANUAL_2026,
      pagasExtrasProrrateadas: true,
      incluyePagaExtraCompleta: true,
      importePagaExtra: 1000,
    }),
    /no pueden aplicarse a la vez/
  );
});

test("valida importes y porcentajes", () => {
  assert.throws(() => calcularEmbargo({ liquido: -1, smiAnual: SMI_ANUAL_2026 }), /no puede ser negativa/);
  assert.throws(() => calcularEmbargo({ liquido: 1000, smiAnual: 0 }), /superior a 0/);
  assert.throws(
    () => calcularEmbargo({ liquido: 1000, smiAnual: SMI_ANUAL_2026, porcentajeReduccion: 101 }),
    /entre 0 y 100/
  );
  assert.throws(
    () => calcularEmbargo({
      liquido: 1000,
      smiAnual: SMI_ANUAL_2026,
      incluyePagaExtraCompleta: true,
      importePagaExtra: 0,
    }),
    /debe ser superior a 0/
  );
});

test("interpreta importes con formato europeo", () => {
  assert.equal(parseEuropeanAmount("17.094,00 €"), 17094);
});
