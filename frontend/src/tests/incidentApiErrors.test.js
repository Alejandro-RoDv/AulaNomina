import assert from "node:assert/strict";
import test from "node:test";

import { ApiRequestError, apiRequest } from "../services/httpClient.js";

test("structured payroll conflicts remain available to the incidents UI", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({
      detail: {
        code: "incident_overlap_conflict",
        message: "Existen incidencias incompatibles",
        conflicts: [{
          start_date: "2026-06-05",
          end_date: "2026-06-08",
          incident_ids: [10, 11],
          incident_types: ["AUSENCIA", "VACACIONES"],
        }],
      },
    }),
    {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }
  );

  try {
    await assert.rejects(
      () => apiRequest("/incidents/payrolls/1/preview"),
      (error) => {
        assert.ok(error instanceof ApiRequestError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "incident_overlap_conflict");
        assert.equal(error.detail.conflicts[0].incident_ids[1], 11);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
