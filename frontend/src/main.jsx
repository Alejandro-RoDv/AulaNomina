import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import AppSplit12 from "./AppSplit12.jsx";
import CaseStudiesRoute from "./components/case-studies/CaseStudiesRoute.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AppSplit12 />
    <CaseStudiesRoute />
  </StrictMode>
);
