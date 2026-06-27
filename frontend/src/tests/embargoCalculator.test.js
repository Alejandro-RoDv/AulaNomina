import assert from "node:assert/strict";
import test from "node:test";
import { calcularEmbargo } from "../utils/embargoCalculator.js";

test("calculator smoke", () => {
  const result = calcularEmbargo({ liquido: 1500, smiAnual: 17094 });
  assert.equal(result.totalEmbargable, 83.7);
});
