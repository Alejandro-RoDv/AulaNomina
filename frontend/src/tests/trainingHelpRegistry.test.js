import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  HELP_LOCATIONS,
  findHelpLocationByLabels,
  helpLocationPath,
  searchHelpLocations,
} from "../components/activities/trainingHelpRegistry.js";


test("locator finds common HR and payroll concepts", () => {
  assert.equal(searchHelpLocations("IT")[0].id, "incidents");
  assert.ok(searchHelpLocations("RNT").some((item) => item.id === "settlements"));
  assert.ok(searchHelpLocations("modelo 111").some((item) => item.id === "model111"));
  assert.ok(searchHelpLocations("alta trabajador").some((item) => item.id === "employee-new"));
});


test("contextual help resolves the active menu label", () => {
  const location = findHelpLocationByLabels(["Nómina", "Histórico de nóminas"]);
  assert.equal(location?.id, "payroll-history");
  assert.equal(helpLocationPath(location), "Nómina · Histórico de nóminas");
  assert.equal(location.actions.length, 3);
});


test("tutorial navigation labels stay aligned with the real sidebar", () => {
  const sidebarSource = readFileSync(
    new URL("../utils/moduleNavigation.js", import.meta.url),
    "utf8"
  );

  for (const location of HELP_LOCATIONS) {
    if (location.id === "mail") continue;
    for (const label of location.navigationLabels || []) {
      assert.ok(
        sidebarSource.includes(label),
        `El localizador usa «${label}», pero esa etiqueta ya no existe en moduleNavigation.js`
      );
    }
  }
});
