import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/incidents/incidentTable.css";
import "./payroll-print.css";
import "./contract-print-v5-fixes.js";
import "./convenios-ui-fixes.js";
import App from "./App.jsx";
import SiltraGlobalLauncher from "./components/siltra/SiltraGlobalLauncher.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <SiltraGlobalLauncher />
  </StrictMode>
);
