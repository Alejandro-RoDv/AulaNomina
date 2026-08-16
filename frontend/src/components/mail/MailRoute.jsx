import { useEffect, useState } from "react";

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
  const [active, setActive] = useState(isMailRoute());

  useEffect(() => {
    const handleRouteChange = () => setActive(isMailRoute());
    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("aulanomina-route-change", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("aulanomina-route-change", handleRouteChange);
    };
  }, []);

  if (!active) return null;

  return <SimpleMailWorkspace onClose={leaveMailRoute} initialThreadId={requestedThreadId()} />;
}