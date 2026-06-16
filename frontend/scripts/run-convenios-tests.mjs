import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: { middlewareMode: true },
});

try {
  const { runConveniosSmokeTests } = await server.ssrLoadModule("/src/tests/convenios-smoke.jsx");
  await runConveniosSmokeTests();
  console.log("Convenios smoke tests: OK");
} catch (error) {
  console.error("Convenios smoke tests: FAILED");
  console.error(error);
  process.exitCode = 1;
} finally {
  await server.close();
}
