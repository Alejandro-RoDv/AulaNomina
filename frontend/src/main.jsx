import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./design-system/tokens.css";
import "./design-system/foundations.css";
import "./design-system/polish.css";
import "./components/ui/ui.css";
import "./components/incidents/incidentTable.css";
import "./components/employees/employeeSplit42Refinements.css";
import "./components/contracts/contractHistoryTableCompact.css";
import "./components/contracts/contractPrintSplit42.css";
import "./components/wage-garnishments/wageGarnishmentSplit42Polish.css";
import "./components/mail/mailScenarioValidation.css";
import "./pages/DashboardIntro.css";
import "./payroll-print.css";
import "./contract-print-v5-fixes.js";
import "./convenios-ui-fixes.js";
import "./affiliation-siltra-bridge.js";
import "./route-aliases.js";
import "./components/employees/employeeHeaderContextBridge.js";
import "./components/contracts/contractPrintSplit42Bridge.js";
import App from "./App.jsx";
import AccessibilityBridge from "./components/accessibility/AccessibilityBridge.jsx";
import FooterBridge from "./components/layout/FooterBridge.jsx";
import MotionBridge from "./components/motion/MotionBridge.jsx";
import DesignSystemPreview from "./design-system/DesignSystemPreview.jsx";
import CaseNavigationBridge from "./components/case-studies/CaseNavigationBridge.jsx";
import AffiliationSiltraBridge from "./components/siltra/AffiliationSiltraBridge.jsx";
import FieSiltraBridge from "./components/siltra/FieSiltraBridge.jsx";
import CraRoute from "./components/cra/CraRoute.jsx";
import FieRoute from "./components/fie/FieRoute.jsx";
import MailLauncherBridge from "./components/mail/MailLauncherBridge.jsx";
import MailRoute from "./components/mail/MailRoute.jsx";

const showDesignSystem = new URLSearchParams(window.location.search).has("design-system");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {showDesignSystem ? (
      <DesignSystemPreview />
    ) : (
      <>
        <AccessibilityBridge />
        <MotionBridge />
        <App />
        <FooterBridge />
        <CaseNavigationBridge />
        <AffiliationSiltraBridge />
        <FieSiltraBridge />
        <CraRoute />
        <FieRoute />
        <MailLauncherBridge />
        <MailRoute />
      </>
    )}
  </StrictMode>
);