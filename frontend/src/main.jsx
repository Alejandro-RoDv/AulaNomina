import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/incidents/incidentTable.css";
import "./payroll-print.css";
import "./contract-print-v5-fixes.js";
import "./convenios-ui-fixes.js";
import "./affiliation-siltra-bridge.js";
import App from "./App.jsx";
import CaseNavigationBridge from "./components/case-studies/CaseNavigationBridge.jsx";
import AffiliationSiltraBridge from "./components/siltra/AffiliationSiltraBridge.jsx";
import FieSiltraBridge from "./components/siltra/FieSiltraBridge.jsx";
import CraRoute from "./components/cra/CraRoute.jsx";
import FieRoute from "./components/fie/FieRoute.jsx";
import MailLauncherBridge from "./components/mail/MailLauncherBridge.jsx";
import MailRoute from "./components/mail/MailRoute.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <CaseNavigationBridge />
    <AffiliationSiltraBridge />
    <FieSiltraBridge />
    <CraRoute />
    <FieRoute />
    <MailLauncherBridge />
    <MailRoute />
  </StrictMode>
);
