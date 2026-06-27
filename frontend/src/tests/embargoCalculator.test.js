import assert from "node:assert/strict";
import test from "node:test";
import { calcularEmbargo } from "../utils/embargoCalculator.js";

const calc = (liquido, datos = {}) => calcularEmbargo({ liquido, smiAnual: 17094, ...datos });

test("calculator boundaries", () => {
  assert.equal(calc(1000).totalEmbargable, 0);
  assert.equal(calc(1221).totalEmbargable, 0);
  assert.equal(calc(1500).totalEmbargable, 83.7);
  assert.equal(calcularEmbargo({ liquido: 2400, smiAnual: 16576 }).totalEmbargable, 371.2);
  assert.equal(calcularEmbargo({ liquido: 6000, smiAnual: 14000 }).totalEmbargable, 3050);
});
