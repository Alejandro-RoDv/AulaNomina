import { useEffect, useState } from "react";

import MailWorkspace from "./MailWorkspace";

function isMailRoute() {
  return window.location.hash === "#mail";
}

function leaveMailRoute() {
  window.close();

  window.setTimeout(() => {
    if (window.closed) return;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
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

  return <MailWorkspace onClose={leaveMailRoute} />;
}
