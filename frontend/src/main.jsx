import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./payroll-print.css";
import "./contract-print.css";
import "./contract-print-clause-fixes.js";
import "./convenios-ui-fixes.js";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
