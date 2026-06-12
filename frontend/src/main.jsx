import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./payroll-print.css";
import "./contract-print-v5-fixes.js";
import "./convenios-ui-fixes.js";
import "./agreement-parameterization-widget.js";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);