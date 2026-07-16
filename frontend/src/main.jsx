import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/incidents/incidentTable.css";
import "./payroll-print.css";
import "./contract-print-v5-fixes.js";
import "./convenios-ui-fixes.js";
import "./affiliation-siltra-bridge.js";
import App from "./App.jsx";
import AffiliationSiltraBridge from "./components/siltra/AffiliationSiltraBridge.jsx";
import CraRoute from "./components/cra/CraRoute.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <AffiliationSiltraBridge />
    <CraRoute />
  </StrictMode>
);
