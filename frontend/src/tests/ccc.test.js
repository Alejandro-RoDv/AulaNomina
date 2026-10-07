import assert from "node:assert/strict";
import test from "node:test";

import { formatCcc, joinCcc, splitCcc } from "../utils/ccc.js";

test("CCC separates legacy, compact and formatted values", () => {
  assert.deepEqual(splitCcc(""), { regime: "0111", code: "" });
  assert.deepEqual(splitCcc("14149990011"), { regime: "0111", code: "14149990011" });
  assert.deepEqual(splitCcc("011114149990011"), { regime: "0111", code: "14149990011" });
  assert.deepEqual(splitCcc("0111 / 14149990011"), { regime: "0111", code: "14149990011" });
});

test("CCC is stored canonically without asking users for separators", () => {
  assert.equal(joinCcc("0111", "14149990011"), "0111/14149990011");
  assert.equal(formatCcc("0111/14149990011"), "0111 / 14149990011");
});
