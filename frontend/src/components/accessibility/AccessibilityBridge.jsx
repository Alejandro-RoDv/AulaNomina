import { useEffect, useRef, useState } from "react";

import "./accessibility.css";

const PAGE_TITLE_SELECTOR = ".an-header__title, main h1";
const MAIN_CONTENT_ID = "aulanomina-main-content";
const PAGE_TITLE_ID = "aulanomina-page-title";

function isVisible(element) {
  if (!element) return false;
  return element.getClientRects().length > 0;
}

function getCurrentHeading() {
  const headings = [...document.querySelectorAll(PAGE_TITLE_SELECTOR)];
  return headings.find(isVisible) || headings[0] || null;
}

function synchroniseCurrentNavigation() {
  const navigationSelectors = [
    ".an-sidebar__panel",
    ".an-sidebar__item",
    ".an-sidebar__subitem",
    ".an-header__tab",
  ];

  document
    .querySelectorAll(navigationSelectors.map((selector) => `${selector}[aria-current]`).join(","))
    .forEach((element) => element.removeAttribute("aria-current"));

  const sidebarCurrent = document.querySelector(".an-sidebar__subitem.is-active")
    || document.querySelector(".an-sidebar__item.is-active:not(.an-sidebar__item--with-toggle)")
    || document.querySelector(".an-sidebar__item--with-toggle.is-active")
    || document.querySelector(".an-sidebar__panel.is-active");

  sidebarCurrent?.setAttribute("aria-current", "page");

  document
    .querySelectorAll(".an-header__tab.is-active")
    .forEach((element) => element.setAttribute("aria-current", "page"));
}

function synchroniseLandmarks() {
  const main = document.querySelector("#root main");
  const heading = getCurrentHeading();

  if (main) {
    main.id = MAIN_CONTENT_ID;
    main.tabIndex = -1;
    main.classList.add("an-main-content");
  }

  if (heading) {
    heading.id = PAGE_TITLE_ID;
    main?.setAttribute("aria-labelledby", PAGE_TITLE_ID);
  } else {
    main?.removeAttribute("aria-labelledby");
  }

  const primaryNavigation = document.querySelector(".an-sidebar__navigation");
  if (primaryNavigation && !primaryNavigation.getAttribute("aria-label")) {
    primaryNavigation.setAttribute("aria-label", "Módulos de AulaNomina");
  }

  synchroniseCurrentNavigation();

  return {
    main,
    title: heading?.textContent?.trim() || "AulaNomina",
  };
}

export default function AccessibilityBridge() {
  const [announcement, setAnnouncement] = useState("");
  const previousTitleRef = useRef("");
  const initialisedRef = useRef(false);

  useEffect(() => {
    let frameId = 0;

    const sync = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const { main, title } = synchroniseLandmarks();
        document.title = title === "AulaNomina" ? title : `${title} · AulaNomina`;

        if (!initialisedRef.current) {
          previousTitleRef.current = title;
          initialisedRef.current = true;
          return;
        }

        if (title !== previousTitleRef.current) {
          previousTitleRef.current = title;
          setAnnouncement(`Página cargada: ${title}`);
          main?.focus({ preventScroll: true });
        }
      });
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.getElementById("root"), {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    window.addEventListener("hashchange", sync);
    window.addEventListener("aulanomina-route-change", sync);
    window.addEventListener("aulanomina-open-page", sync);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("aulanomina-route-change", sync);
      window.removeEventListener("aulanomina-open-page", sync);
    };
  }, []);

  return (
    <>
      <a className="an-skip-link" href={`#${MAIN_CONTENT_ID}`}>
        Saltar al contenido principal
      </a>
      <p className="an-live-region" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </>
  );
}
