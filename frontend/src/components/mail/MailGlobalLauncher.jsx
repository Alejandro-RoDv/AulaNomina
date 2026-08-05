import mailLogo from "../../assets/mail-access.svg";
import "./mailLauncher.css";

function buildMailUrl() {
  const url = new URL(window.location.href);
  url.hash = "mail";
  return url.toString();
}

export default function MailGlobalLauncher() {
  const openMail = () => {
    window.open(buildMailUrl(), "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      className="mail-global-launcher"
      onClick={openMail}
      title="Abrir correo simulado en una pestaña nueva"
      aria-label="Abrir correo simulado en una pestaña nueva"
    >
      <img src={mailLogo} alt="" className="mail-global-launcher__logo" />
      <span>Correo</span>
      <strong className="mail-global-launcher__counter" aria-label="3 mensajes sin leer">3</strong>
    </button>
  );
}
