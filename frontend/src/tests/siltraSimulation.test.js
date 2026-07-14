import test from "node:test";
import assert from "node:assert/strict";

import {
  SILTRA_UPLOAD_MAX_BYTES,
  buildSiltraNavigationPayload,
  canSendCommunication,
  countAttemptsByFile,
  filePreview,
  formatFileSize,
  getFileExtension,
  groupMessagesBySeverity,
  latestSubmission,
  latestSubmissionByFile,
  sortSubmissionsNewestFirst,
  submissionCounts,
  submissionStatusLabel,
  validateSiltraUpload,
} from "../utils/siltraSimulation.js";

test("etiquetas de estado SILTRA son legibles", () => {
  assert.equal(submissionStatusLabel("ACCEPTED_WITH_WARNINGS"), "Aceptado con advertencias");
  assert.equal(submissionStatusLabel("REJECTED"), "Rechazado");
});

test("solo habilita el envío para ficheros compatibles y con contenido", () => {
  assert.equal(canSendCommunication({ id: 1, status: "GENERATED", content: "{}" }), true);
  assert.equal(canSendCommunication({ id: 1, status: "DRAFT", content: "{}" }), false);
  assert.equal(canSendCommunication({ id: 1, status: "GENERATED", content: "" }), false);
  assert.equal(canSendCommunication({ id: 1, status: "GENERATED", content: "{}" }, 1), false);
});

test("agrupa mensajes y cuenta errores y advertencias", () => {
  const grouped = groupMessagesBySeverity([
    { severity: "WARNING", code: "W9602" },
    { severity: "ERROR", code: "R9501" },
    { severity: "INFO", code: "A0000" },
  ]);
  assert.equal(grouped.errors.length, 1);
  assert.equal(grouped.warnings.length, 1);
  assert.equal(grouped.information.length, 1);
});

test("calcula el último resultado y los intentos por fichero", () => {
  const submissions = [
    { id: 1, communication_file_id: 9, attempt_number: 1, status: "REJECTED" },
    { id: 2, communication_file_id: 9, attempt_number: 2, status: "ACCEPTED" },
  ];
  assert.equal(latestSubmissionByFile(submissions)[9].status, "ACCEPTED");
  assert.equal(countAttemptsByFile(submissions)[9], 2);
});

test("ordena el historial por fecha descendente", () => {
  const ordered = sortSubmissionsNewestFirst([
    { id: 1, created_at: "2026-07-13T10:00:00" },
    { id: 2, created_at: "2026-07-14T10:00:00" },
  ]);
  assert.equal(ordered[0].id, 2);
});

test("resume resultados del dashboard", () => {
  assert.deepEqual(
    submissionCounts([
      { status: "ACCEPTED" },
      { status: "ACCEPTED_WITH_WARNINGS" },
      { status: "REJECTED" },
    ]),
    { total: 3, accepted: 1, warnings: 1, rejected: 1 }
  );
});

test("devuelve el último envío del dashboard", () => {
  const latest = latestSubmission([
    { id: 1, created_at: "2026-07-13T10:00:00" },
    { id: 2, created_at: "2026-07-14T10:00:00" },
  ]);
  assert.equal(latest.id, 2);
});

test("construye la navegación entre fichero, SILTRA y liquidación", () => {
  assert.deepEqual(
    buildSiltraNavigationPayload({ id: 25, company_id: 3, metadata: { settlement_id: 9 } }),
    { communicationFileId: 25, companyId: 3, settlementId: 9 }
  );
});

test("valida extensiones y límite de tamaño", () => {
  assert.equal(getFileExtension("liquidacion.JSON"), "json");
  assert.equal(validateSiltraUpload({ name: "liquidacion.pdf", size: 10 }).valid, false);
  assert.equal(validateSiltraUpload({ name: "liquidacion.json", size: SILTRA_UPLOAD_MAX_BYTES + 1 }).valid, false);
  assert.equal(validateSiltraUpload({ name: "liquidacion.json", size: 1024 }).valid, true);
});

test("avisa de ficheros duplicados y formatos de práctica", () => {
  const duplicate = validateSiltraUpload(
    { name: "liquidacion.json", size: 1024 },
    [{ original_filename: "LIQUIDACION.JSON", metadata: { source_size_bytes: 1024 } }]
  );
  assert.match(duplicate.warning, /mismo nombre/i);

  const xml = validateSiltraUpload({ name: "liquidacion.xml", size: 500 });
  assert.match(xml.warning, /estructura compatible/i);
});

test("formatea tamaño y prepara previsualización", () => {
  assert.equal(formatFileSize(1024), "1.0 KB");
  assert.deepEqual(
    filePreview({ name: "liquidacion.json", size: 2048 }, "Empresa Demo", "14123456789", "2026-06"),
    {
      name: "liquidacion.json",
      type: "JSON",
      size: "2.0 KB",
      company: "Empresa Demo",
      ccc: "14123456789",
      period: "2026-06",
    }
  );
});
