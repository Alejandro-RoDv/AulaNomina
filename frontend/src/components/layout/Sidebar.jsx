import { useEffect, useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  X,
} from "lucide-react";

import { getStoredAuthUser } from "../../services/authApi";
import logo from "../../assets/aulanomina-logo.svg";
import "./layout.css";
import "./navigation.css";

import { groups, panelItem, getItemKey, getInitialActiveKey, getStoredExpandedParents, storeExpandedParents, getStoredActiveGroup, storeActiveGroup, applyItemNavigation, isActionItem, groupContainsActiveItem, findGroupIdForPage, findParentKeyForPage } from "../../utils/moduleNavigation";

export default function Sidebar({ activePage, setActivePage }) {
  const initialNavKey = getInitialActiveKey(activePage);
  const initialGroupId = findGroupIdForPage(activePage, initialNavKey);
  const initialParentKey = initialGroupId ? findParentKeyForPage(initialGroupId, activePage, initialNavKey) : null;

  const [activeNavKey, setActiveNavKey] = useState(initialNavKey);
  const [expandedGroupId, setExpandedGroupId] = useState(initialGroupId || getStoredActiveGroup);
  const [expandedParents, setExpandedParents] = useState(() => {
    const stored = getStoredExpandedParents();
    if (!initialGroupId || !initialParentKey) return stored;
    return { ...stored, [initialGroupId]: initialParentKey };
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const syncActiveNavigation = () => {
      const nextActiveKey = getInitialActiveKey(activePage);
      const nextGroupId = findGroupIdForPage(activePage, nextActiveKey);
      setActiveNavKey(nextActiveKey);

      if (!nextGroupId) return;
      setExpandedGroupId(nextGroupId);
      storeActiveGroup(nextGroupId);
      const nextParentKey = findParentKeyForPage(nextGroupId, activePage, nextActiveKey);
      if (nextParentKey) {
        setExpandedParents((previous) => {
          const next = { ...previous, [nextGroupId]: nextParentKey };
          storeExpandedParents(next);
          return next;
        });
      }
    };

    syncActiveNavigation();
    window.addEventListener("aulanomina-route-change", syncActiveNavigation);
    window.addEventListener("hashchange", syncActiveNavigation);
    window.addEventListener("aulanomina-contract-mode", syncActiveNavigation);
    window.addEventListener("aulanomina-incidents-mode", syncActiveNavigation);
    window.addEventListener("aulanomina-incident-category", syncActiveNavigation);
    return () => {
      window.removeEventListener("aulanomina-route-change", syncActiveNavigation);
      window.removeEventListener("hashchange", syncActiveNavigation);
      window.removeEventListener("aulanomina-contract-mode", syncActiveNavigation);
      window.removeEventListener("aulanomina-incidents-mode", syncActiveNavigation);
      window.removeEventListener("aulanomina-incident-category", syncActiveNavigation);
    };
  }, [activePage]);

  useEffect(() => {
    const handleToggle = () => setMobileOpen((previous) => !previous);
    const handleClose = () => setMobileOpen(false);
    window.addEventListener("aulanomina-toggle-sidebar", handleToggle);
    window.addEventListener("aulanomina-close-sidebar", handleClose);
    return () => {
      window.removeEventListener("aulanomina-toggle-sidebar", handleToggle);
      window.removeEventListener("aulanomina-close-sidebar", handleClose);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const toggleGroup = (groupId) => {
    const nextGroupId = expandedGroupId === groupId ? null : groupId;
    setExpandedGroupId(nextGroupId);
    storeActiveGroup(nextGroupId);
    const group = groups.find((item) => item.id === groupId);
    if (groupId !== "organization" && group?.dashboard) handleNavClick({ id: group.dashboard, enabled: true }, groupId);
  };

  const toggleParent = (groupId, parentKey) => {
    setExpandedGroupId(groupId);
    storeActiveGroup(groupId);
    setExpandedParents((previous) => {
      const next = { ...previous, [groupId]: previous[groupId] === parentKey ? null : parentKey };
      storeExpandedParents(next);
      return next;
    });
  };

  const handleNavClick = (item, groupId = null, parentKey = null) => {
    if (!item.enabled) return;
    applyItemNavigation(item);

    if (isActionItem(item)) {
      setMobileOpen(false);
      return;
    }

    const itemKey = getItemKey(item);
    setActiveNavKey(itemKey);
    setActivePage(item.id);
    setMobileOpen(false);

    const resolvedGroupId = groupId || findGroupIdForPage(item.id, itemKey);
    if (!resolvedGroupId) return;

    setExpandedGroupId(resolvedGroupId);
    storeActiveGroup(resolvedGroupId);

    if (parentKey) {
      setExpandedParents((previous) => {
        const next = { ...previous, [resolvedGroupId]: parentKey };
        storeExpandedParents(next);
        return next;
      });
    }
  };

  const isItemActive = (item) => {
    if (isActionItem(item)) return false;
    const itemKey = getItemKey(item);
    if (activeNavKey === itemKey) return true;
    if (item.id !== activePage) return false;
    return !item.modeGroup && !item.hash;
  };

  const isParentActive = (item) => item.children?.some((child) => isItemActive(child));

  return (
    <>
      <aside className={`an-sidebar${mobileOpen ? " is-mobile-open" : ""}`} aria-label="Navegación principal">
        <div className="an-sidebar__brand">
          <div className="an-sidebar__brand-copy">
            <img src={logo} alt="AulaNomina" className="an-sidebar__logo" />
          </div>
          <button type="button" className="an-sidebar__close" onClick={() => setMobileOpen(false)} aria-label="Cerrar navegación">
            <X aria-hidden="true" />
          </button>
        </div>

        <nav className="an-sidebar__navigation">
          <button
            type="button"
            className={`an-sidebar__panel${activePage === panelItem.id ? " is-active" : ""}`}
            onClick={() => handleNavClick(panelItem)}
          >
            <LayoutDashboard aria-hidden="true" />
            <span>{panelItem.label}</span>
          </button>

          {groups.map((group) => {
            const GroupIcon = group.icon;
            const isGroupActive = groupContainsActiveItem(group, activePage, activeNavKey);
            const isExpanded = expandedGroupId === group.id;

            return (
              <section key={group.id} className="an-sidebar__group">
                <button
                  type="button"
                  className={`an-sidebar__group-toggle${isGroupActive ? " is-active" : ""}`}
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isExpanded}
                >
                  <span className="an-sidebar__group-label">
                    <GroupIcon aria-hidden="true" />
                    <span>{group.title}</span>
                  </span>
                  <span className={`an-sidebar__chevron${isExpanded ? " is-open" : ""}`}>
                    <ChevronDown size={15} aria-hidden="true" />
                  </span>
                </button>

                {isExpanded && (
                  <div className="an-sidebar__group-items">
                    {group.items.map((item) => {
                      const itemKey = getItemKey(item);
                      const hasChildren = Boolean(item.children?.length);
                      const parentActive = isParentActive(item);
                      const parentExpanded = expandedParents[group.id] === itemKey;

                      return (
                        <div key={`${item.id}-${item.label}`} className="an-sidebar__item-block">
                          {hasChildren ? (
                            <div className={`an-sidebar__item-row${parentActive ? " has-active-child" : ""}`}>
                              <button
                                type="button"
                                disabled={!item.enabled}
                                onClick={() => {
                                  toggleParent(group.id, itemKey);
                                  if (item.dashboard) handleNavClick({ id: item.dashboard, enabled: true }, group.id, itemKey);
                                }}
                                className="an-sidebar__item an-sidebar__item--with-toggle"
                              >
                                {item.label}
                              </button>
                              <button
                                type="button"
                                className={`an-sidebar__item-toggle${parentExpanded ? " is-open" : ""}`}
                                onClick={() => toggleParent(group.id, itemKey)}
                                aria-expanded={parentExpanded}
                                aria-label={`${parentExpanded ? "Contraer" : "Desplegar"} ${item.label}`}
                              >
                                <ChevronDown aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={!item.enabled}
                              onClick={() => handleNavClick(item, group.id)}
                              className={`an-sidebar__item${isItemActive(item) ? " is-active" : ""}`}
                            >
                              {item.label}
                            </button>
                          )}

                          {hasChildren && parentExpanded && (
                            <div className="an-sidebar__subitems">
                              {item.children.map((child) => (
                                <button
                                  key={`${child.id}-${child.label}`}
                                  type="button"
                                  disabled={!child.enabled}
                                  onClick={() => handleNavClick(child, group.id, itemKey)}
                                  className={`an-sidebar__subitem${isItemActive(child) ? " is-active" : ""}`}
                                >
                                  {child.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </nav>

        <div className="an-sidebar__footer">
          <div className="an-session-summary"><span>Sesión activa</span><strong>{({ student: "Alumno", teacher: "Docente", admin: "Administrador" })[getStoredAuthUser()?.role] || "Demo docente"}</strong></div>
          <span>v0.1</span>
        </div>
      </aside>

      {mobileOpen && (
        <button type="button" className="an-sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Cerrar navegación" />
      )}
    </>
  );
}
