import assert from "node:assert/strict";
import test from "node:test";

import { mapThreadToWorkspaceMessage } from "../services/mailApi.js";


test("mapThreadToWorkspaceMessage adapta un hilo persistente a la bandeja", () => {
  const mapped = mapThreadToWorkspaceMessage({
    id: 14,
    folder: "inbox",
    subject: "Regularización de antigüedad",
    preview: "Revisa la nómina",
    priority: "high",
    category: "payroll",
    case_reference: "NOM-2026-014",
    case_study_id: 5,
    case_assignment_id: 12,
    case_task_id: 41,
    status: "open",
    is_read: false,
    expected_actions: ["Recalcular nómina"],
    context_actions: ["Abrir nómina"],
    updated_at: "2026-08-05T07:30:00Z",
    messages: [
      {
        id: 31,
        sender_name: "Administración",
        sender_address: "administracion@empresa-demo.es",
        recipient_name: "Usuario demo",
        recipient_address: "usuario.demo@aulanomina.local",
        body_text: "Buenos días.\n\nRevisa la nómina de la trabajadora.",
        direction: "incoming",
        message_type: "initial",
        sent_at: "2026-08-05T07:30:00Z",
        attachments: [
          {
            id: 44,
            filename: "solicitud.pdf",
            content_type: "application/pdf",
          },
        ],
      },
    ],
  });

  assert.equal(mapped.id, 14);
  assert.equal(mapped.unread, true);
  assert.equal(mapped.category, "Nómina");
  assert.equal(mapped.categoryCode, "payroll");
  assert.equal(mapped.caseStatus, "pending");
  assert.equal(mapped.backendStatus, "open");
  assert.equal(mapped.caseStudyId, 5);
  assert.equal(mapped.caseAssignmentId, 12);
  assert.equal(mapped.caseTaskId, 41);
  assert.equal(mapped.sender, "Administración");
  assert.equal(mapped.recipientAddress, "usuario.demo@aulanomina.local");
  assert.deepEqual(mapped.body, ["Buenos días.", "Revisa la nómina de la trabajadora."]);
  assert.deepEqual(mapped.attachments, ["solicitud.pdf"]);
  assert.equal(mapped.attachmentRecords[0].id, 44);
  assert.deepEqual(mapped.requirements, ["Recalcular nómina"]);
  assert.deepEqual(mapped.contextActions, ["Abrir nómina"]);
});


test("mapThreadToWorkspaceMessage conserva la conversación y los borradores", () => {
  const mapped = mapThreadToWorkspaceMessage({
    id: 22,
    folder: "drafts",
    subject: "Discrepancia SILTRA",
    preview: "Respuesta pendiente",
    priority: "normal",
    category: "social_security",
    case_reference: "SS-2026-011",
    case_study_id: null,
    case_assignment_id: null,
    case_task_id: null,
    status: "in_progress",
    is_read: true,
    expected_actions: [],
    context_actions: ["Abrir SILTRA"],
    updated_at: "2026-08-05T08:00:00Z",
    messages: [
      {
        id: 51,
        sender_name: "TGSS simulada",
        sender_address: "tgss@aulanomina.local",
        recipient_name: "Usuario demo",
        recipient_address: "usuario.demo@aulanomina.local",
        body_text: "Existe una diferencia.",
        direction: "incoming",
        message_type: "initial",
        sent_at: "2026-08-05T07:00:00Z",
        attachments: [],
      },
      {
        id: 52,
        sender_name: "Usuario demo",
        sender_address: "usuario.demo@aulanomina.local",
        recipient_name: "TGSS simulada",
        recipient_address: "tgss@aulanomina.local",
        body_text: "He revisado las bases...",
        direction: "outgoing",
        message_type: "draft",
        sent_at: "2026-08-05T08:00:00Z",
        attachments: [],
      },
    ],
  });

  assert.equal(mapped.folder, "drafts");
  assert.equal(mapped.unread, false);
  assert.equal(mapped.category, "Seguridad Social");
  assert.equal(mapped.caseStatus, "in_progress");
  assert.equal(mapped.caseAssignmentId, null);
  assert.equal(mapped.messages.length, 2);
  assert.equal(mapped.messages[1].message_type, "draft");
});
