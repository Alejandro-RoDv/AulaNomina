import { useCallback, useEffect, useState } from "react";

import mailLogo from "../../assets/mail-access.svg";
import { fetchDemoMailbox, fetchMailboxThreads } from "../../services/mailApi";
import "./mailLauncher.css";

function buildMailUrl() {
  const url = new URL(window.location.href);
  url.hash = "mail";
  return url.toString();
}

function isProfessionalUnread(thread) {
  if (!thread?.unread) return false;
  const latest = [...(thread.messages || [])].reverse()[0];
  return latest?.sender_address !== "tutor@aulanomina.local" && latest?.message_type !== "automatic";
}

export default function MailGlobalLauncher() {
  const [unread, setUnread] = useState(null);

  const loadUnread = useCallback(async () => {
    try {
      const mailbox = await fetchDemoMailbox();
      const threads = await fetchMailboxThreads(mailbox.id, { folder: "inbox" });
      setUnread((threads || []).filter(isProfessionalUnread).length);
    } catch {
      setUnread(null);
    }
  }, []);

  useEffect(() => {
    loadUnread();
    window.addEventListener("aulanomina-mail-stats-refresh", loadUnread);
    return () => window.removeEventListener("aulanomina-mail-stats-refresh", loadUnread);
  }, [loadUnread]);

  const openMail = () => {
    window.open(buildMailUrl(), "_blank", "noopener,noreferrer");
  };

  const counterLabel = unread === null ? "Sin conexión con el buzón" : `${unread} mensajes sin leer`;

  return (
    <button
      type="button"
      className="mail-global-launcher"
      onClick={openMail}
      title="Abrir correo en una pestaña nueva"
      aria-label="Abrir correo en una pestaña nueva"
    >
      <img src={mailLogo} alt="" className="mail-global-launcher__logo" />
      <span>Correo</span>
      <strong className="mail-global-launcher__counter" aria-label={counterLabel}>{unread === null ? "—" : unread}</strong>
    </button>
  );
}
