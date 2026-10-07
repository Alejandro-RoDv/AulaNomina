import test from "node:test";
import assert from "node:assert/strict";
import { normalizeExpandedParents, openGroupParents } from "../utils/sidebarExpansion.js";

test("legacy submenu preferences migrate without losing closed groups", () => {
  assert.deepEqual(normalizeExpandedParents({ organization: "companies-menu", social: null, payroll: ["a", "a", 3] }), {
    organization: ["companies-menu"], social: [], payroll: ["a"],
  });
  for (const value of [null, [], "invalid"]) assert.deepEqual(normalizeExpandedParents(value), {});
});

test("first opening expands all sibling submenus", () => {
  assert.deepEqual(openGroupParents({}, "social", ["affiliation", "contribution", "communications"]), {
    social: ["affiliation", "contribution", "communications"],
  });
});

test("reopening keeps independently collapsed submenus closed", () => {
  const previous = { social: ["contribution"], organization: [] };
  assert.deepEqual(openGroupParents(previous, "social", ["affiliation", "contribution"]), previous);
  assert.deepEqual(openGroupParents(previous, "organization", ["companies"]), previous);
});

test("navigation reveals the active submenu without closing its siblings", () => {
  const previous = { social: ["contribution", "communications"] };
  assert.deepEqual(openGroupParents(previous, "social", ["affiliation", "contribution", "communications"], "affiliation"), {
    social: ["contribution", "communications", "affiliation"],
  });
  assert.deepEqual(previous.social, ["contribution", "communications"]);
});
