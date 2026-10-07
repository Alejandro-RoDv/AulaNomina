import assert from "node:assert/strict";
import test from "node:test";

import { readableValidationMessage } from "../services/httpClient.js";


test("API validation errors are shown in clear Spanish", () => {
  assert.equal(
    readableValidationMessage("Value error, El código del CCC debe tener exactamente 11 dígitos."),
    "El código del CCC debe tener exactamente 11 dígitos.",
  );
  assert.equal(
    readableValidationMessage("Input should be a valid date or datetime, input is too short"),
    "La fecha no es válida o está incompleta.",
  );
  assert.equal(
    readableValidationMessage("Field required", { loc: ["body", "ccc_code"] }),
    "Falta el campo obligatorio «ccc_code».",
  );
});
