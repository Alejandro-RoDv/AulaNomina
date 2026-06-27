import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularEmbargo,
  parseEuropeanAmount,
} from "../utils/embargoCalculator.js";

test("salario inferior al SMI", () => {
  const resultado = calcularEmbargo({ liquido: 1000, smi: 1221 });
  assert.equal(resultado.totalEmbargable, 0);
});

test("salario igual al SMI", () => {
  const resultado = calcularEmbargo({ liquido: 1221, smi: 1221 });
  assert.equal(resultado.totalEmbargable, 0);
});

test("salario entre 1 y 2 SMI", () => {
  const resultado = calcularEmbargo({ liquido: 1500, smi: 1221 });
  assert.equal(resultado.totalEmbargable, 83.7);
  assert.equal(resultado.tramos[1].baseTramo, 279);
});

test("salario superior a 2 SMI", () => {
  const resultado = calcularEmbargo({ liquido: 2400, smi: 1184 });
  assert.equal(resultado.totalEmbargable, 371.2);
});

test("salario superior a 5 SMI", () => {
  const resultado = calcularEmbargo({ liquido: 6000, smi: 1000 });
  assert.equal(resultado.totalEmbargable, 3050);
  assert.equal(resultado.tramos[5].importeEmbargable, 900);
});

test("reducción por cargas familiares", () => {
  const resultado = calcularEmbargo({
    liquido: 2000,
    smi: 1000,
    porcentajeReduccion: 10,
    cargasFamiliares: true,
  });

  assert.equal(resultado.tramos[1].porcentajeAplicado, 27);
  assert.equal(resultado.totalEmbargable, 270);
});

test("la reducción por cargas familiares no altera el exceso al 90%", () => {
  const resultado = calcularEmbargo({
    liquido: 6000,
    smi: 1000,
    porcentajeReduccion: 10,
    cargasFamiliares: true,
  });

  assert.equal(resultado.tramos[5].porcentajeAplicado, 90);
  assert.equal(resultado.totalEmbargable, 2835);
});

test("pagas extras prorrateadas", () => {
  const resultado = calcularEmbargo({
    liquido: 2400,
    smi: 1000,
    pagasExtrasProrrateadas: true,
    smiProrrateado: 1200,
  });

  assert.equal(resultado.totalEmbargable, 360);
  assert.equal(resultado.tramos[0].smiReferencia, 1200);
});

test("inclusión de paga extra completa", () => {
  const resultado = calcularEmbargo({
    liquido: 1000,
    smi: 1000,
    incluyePagaExtraCompleta: true,
    importePagaExtra: 1000,
  });

  assert.equal(resultado.liquidoFinalCalculado, 2000);
  assert.equal(resultado.totalEmbargable, 300);
});

test("valida importes y porcentajes", () => {
  assert.throws(() => calcularEmbargo({ liquido: -1, smi: 1000 }), /no puede ser negativa/);
  assert.throws(() => calcularEmbargo({ liquido: 1000, smi: 0 }), /superior a 0/);
  assert.throws(
    () => calcularEmbargo({ liquido: 1000, smi: 1000, porcentajeReduccion: 101 }),
    /entre 0 y 100/
  );
});

test("interpreta importes con formato europeo", () => {
  assert.equal(parseEuropeanAmount("1.221,50 €"), 1221.5);
});
