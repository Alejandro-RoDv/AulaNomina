import assert from "node:assert/strict";
import test from "node:test";

import {
  model190DocumentAvailability,
  model190DocumentsStatusText,
} from "../utils/model190Documents.js";

test("generated frozen declarations expose annual documents but not certificates", () => {
  const result = model190DocumentAvailability({ status: "generated", locked: true });
  assert.deepEqual(result, {
    annualSummary: true,
    recipientRelation: true,
    certificateDirectory: false,
    certificateArchive: false,
  });
  assert.match(
    model190DocumentsStatusText({ status: "generated", locked: true }),
    /certificados tras presentar/
  );
});

test("presented declarations expose all documents", () => {
  const result = model190DocumentAvailability({ status: "presented", locked: true });
  assert.equal(result.annualSummary, true);
  assert.equal(result.recipientRelation, true);
  assert.equal(result.certificateDirectory, true);
  assert.equal(result.certificateArchive, true);
  assert.equal(
    model190DocumentsStatusText({ status: "presented", locked: true }),
    "Resumen, perceptores y certificados disponibles"
  );
});

test("draft or unlocked declarations do not expose frozen documents", () => {
  assert.equal(
    model190DocumentAvailability({ status: "draft", locked: false }).annualSummary,
    false
  );
  assert.equal(
    model190DocumentAvailability({ status: "generated", locked: false }).recipientRelation,
    false
  );
  assert.equal(
    model190DocumentsStatusText({ status: "draft", locked: false }),
    "Documentos no disponibles"
  );
});
