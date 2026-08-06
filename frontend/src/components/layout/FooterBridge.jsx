import { useEffect } from "react";

const FOOTER_TEXT = `© ${new Date().getFullYear()} AulaNomina. Todos los derechos reservados.`;

export default function FooterBridge() {
  useEffect(() => {
    const footer = document.querySelector("#root > div > div > footer");
    if (footer) footer.textContent = FOOTER_TEXT;
  }, []);

  return null;
}
