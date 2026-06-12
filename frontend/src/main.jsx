import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./payroll-print.css";
import "./contract-print-v5-fixes.js";
import "./convenios-ui-fixes.js";
import "./agreement-header-widget.js";
import "./agreement-parameterization-widget.js";
import "./agreement-parameterization-editor.js";
import "./agreement-parameterization-forms.js";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);