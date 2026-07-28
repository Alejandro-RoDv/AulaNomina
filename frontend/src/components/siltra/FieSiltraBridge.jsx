import { useEffect } from "react";

const ACTION_MARKER = "aulanomina-fie-siltra-action";

function openFieInbox() {
  document.querySelector(".siltra-exit-button")?.click();
  window.location.hash = "#fie-inss";
  window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: "fie-inss" } }));
  window.dispatchEvent(new Event("aulanomina-route-change"));
}

function installFieAction() {
  const title = Array.from(document.querySelectorAll(".siltra-placeholder-workspace strong"))
    .find((element) => element.textContent?.trim() === "Procesar remesas INSS");
  const container = title?.parentElement;
  if (!container || container.querySelector(`.${ACTION_MARKER}`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = `siltra-classic-button siltra-classic-button--primary ${ACTION_MARKER}`;
  button.textContent = "Abrir bandeja FIE / INSS Empresas";
  button.addEventListener("click", openFieInbox);
  container.appendChild(button);
}

export default function FieSiltraBridge() {
  useEffect(() => {
    installFieAction();
    const observer = new MutationObserver(installFieAction);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
