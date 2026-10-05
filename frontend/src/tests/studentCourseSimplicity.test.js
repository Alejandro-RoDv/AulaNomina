import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const activitiesSource = readFileSync(
  new URL("../components/activities/ActivitiesCenter.jsx", import.meta.url),
  "utf8"
);
const bridgeSource = readFileSync(
  new URL("../components/activities/ActivitiesLauncherBridge.jsx", import.meta.url),
  "utf8"
);
const onboardingSource = readFileSync(
  new URL("../components/activities/TrainingOnboarding.jsx", import.meta.url),
  "utf8"
);


test("student activity view uses the simple theory-mail-ERP structure", () => {
  assert.match(activitiesSource, /Idea clave/);
  assert.match(activitiesSource, /Información del caso/);
  assert.match(activitiesSource, /Hazlo en AulaNomina/);
  assert.match(activitiesSource, /Abrir correo/);
});


test("student activity view does not render old pedagogical clutter", () => {
  for (const label of [
    "Resultado esperado",
    "Conceptos relacionados",
    "Ayuda progresiva",
    "Historial de intentos",
    "Comprobación bajo demanda",
  ]) {
    assert.equal(
      activitiesSource.includes(label),
      false,
      `La vista del alumno ha vuelto a mostrar «${label}»`
    );
  }
});


test("progressive activity assist is no longer mounted for students", () => {
  assert.equal(bridgeSource.includes("TrainingActivityAssist"), false);
});


test("tutorial explains the same simple course model", () => {
  assert.match(onboardingSource, /Una idea y una gestión en cada actividad/);
  assert.match(onboardingSource, /Parte del trabajo llega por email/);
  assert.match(onboardingSource, /trabajador por cuenta ajena/);
  assert.equal(onboardingSource.includes("ayuda progresiva"), false);
});
