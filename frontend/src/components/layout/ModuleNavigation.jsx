import { useEffect, useReducer } from "react";
import { groups, getItemKey, getInitialActiveKey, findGroupIdForPage, applyItemNavigation } from "../../utils/moduleNavigation";
import "./split45.css";

export default function ModuleNavigation({ activePage, groupId }) {
  const [, refresh] = useReducer((value) => value + 1, 0);
  useEffect(() => {
    const events = ["hashchange", "aulanomina-route-change", "aulanomina-contract-mode", "aulanomina-incidents-mode", "aulanomina-incident-category"];
    events.forEach((event) => window.addEventListener(event, refresh));
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);
  const key = getInitialActiveKey(activePage);
  const group = groups.find((item) => item.id === (groupId || findGroupIdForPage(activePage, key)));
  if (!group) return null;
  const items = [
    { id: group.dashboard, label: "Resumen", enabled: true },
    ...group.items.flatMap((item) => item.children || [item]),
  ].filter((item, index, items) => item.enabled && items.findIndex((candidate) => getItemKey(candidate) === getItemKey(item)) === index);
  return <nav className="an-header__tabs an-module-tabs" aria-label={`Navegación ${group.title}`}>
    {items.map((item) => <button key={getItemKey(item)} type="button"
      className={`an-header__tab${getItemKey(item) === key ? " is-active" : ""}`}
      aria-current={getItemKey(item) === key ? "page" : undefined}
      onClick={() => {
        applyItemNavigation(item);
        if (!item.launchSelector && !item.launchEvent) window.dispatchEvent(new CustomEvent("aulanomina-open-page", { detail: { page: item.id } }));
      }}>{item.label}</button>)}
  </nav>;
}
