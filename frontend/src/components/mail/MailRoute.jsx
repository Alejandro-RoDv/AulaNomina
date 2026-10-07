import { useEffect, useState } from "react";

import { fetchMailThread, updateMailThread } from "../../services/mailApi.js";
import SimpleMailWorkspace from "./SimpleMailWorkspace";

function isMailRoute() {
  return window.location.hash === "#mail";
}

function requestedThreadId() {
  const value = new URL(window.location.href).searchParams.get("mailThread");
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function leaveMailRoute() {
  window.close();

  window.setTimeout(() => {
    if (window.closed) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("mailThread");
    url.hash = "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    window.dispatchEvent(new Event("aulanomina-route-change"));
  }, 80);
}

export default function MailRoute() {
  const [route, setRoute] = useState(() => ({ active: isMailRoute(), threadId: requestedThreadId() }));
  const [preparedTarget, setPreparedTarget] = useState(null);
  const { active, threadId } = route;

  useEffect(() => {
    const handleRouteChange = () => setRoute({ active: isMailRoute(), threadId: requestedThreadId() });
    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (!active || !threadId) {
      return undefined;
    }
    let cancelled = false;
    const focusThread = async () => {
      let error = "";
      try {
        await fetchMailThread(threadId);
        await updateMailThread(threadId, { folder: "inbox", is_read: true });
      } catch {
        error = "No se ha podido abrir el correo de esta actividad. Vuelve al curso e inténtalo de nuevo.";
      } finally {
        if (!cancelled) setPreparedTarget({ threadId, error });
      }
    };
    focusThread();
    return () => { cancelled = true; };
  }, [active, threadId]);

  if (!active || (threadId && preparedTarget?.threadId !== threadId)) return null;

  if (preparedTarget?.error && threadId) {
    return <div className="simple-mail simple-mail--loading" role="alert"><p>{preparedTarget.error}</p><button type="button" onClick={leaveMailRoute}>Volver al curso</button></div>;
  }

  return <SimpleMailWorkspace key={threadId || "inbox"} onClose={leaveMailRoute} initialThreadId={threadId} />;
}
