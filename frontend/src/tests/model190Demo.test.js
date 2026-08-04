import test from "node:test";
import assert from "node:assert/strict";

import {
  model190DemoCanCorrect,
  model190DemoCanPrepare,
  model190DemoCompletion,
  model190DemoStageMeta,
} from "../utils/model190Demo.js";


test("unprepared demo can be seeded", () => {
  const status = { prepared: false, stage: "not_prepared", declaration: null };
  assert.equal(model190DemoCanPrepare(status), true);
  assert.equal(model190DemoCanCorrect(status), false);
  assert.equal(model190DemoStageMeta(status).label, "Caso no preparado");
});


test("deliberate errors enable guided correction", () => {
  const status = { prepared: true, stage: "needs_correction" };
  const meta = model190DemoStageMeta(status);
  assert.equal(meta.tone, "warning");
  assert.equal(model190DemoCanPrepare(status), false);
  assert.equal(model190DemoCanCorrect(status), true);
});


test("ready and presented stages are successful", () => {
  assert.equal(model190DemoStageMeta({ stage: "ready_to_generate" }).tone, "success");
  assert.equal(model190DemoStageMeta({ stage: "presented" }).label, "Caso completado");
});


test("completion counts resolved checks", () => {
  assert.deepEqual(
    model190DemoCompletion({ checks: [{ completed: true }, { completed: false }, { completed: true }] }),
    { completed: 2, total: 3 }
  );
  assert.deepEqual(model190DemoCompletion(null), { completed: 0, total: 0 });
});
