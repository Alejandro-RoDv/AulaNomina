import { useEffect } from "react";

import "./motion.css";

const NAVIGATION_EVENTS = [
  "aulanomina-open-page",
  "aulanomina-route-change",
  "aulanomina-contract-mode",
  "aulanomina-incidents-mode",
];

const PAGE_ENTER_CLASS = "an-page-is-entering";
const PAGE_ENTER_DURATION = 260;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function getMainContent() {
  return document.querySelector(".an-main-content") || document.querySelector("#root main");
}

export default function MotionBridge() {
  useEffect(() => {
    let frameId = 0;
    let secondFrameId = 0;
    let cleanupTimer = 0;

    const runPageTransition = () => {
      if (prefersReducedMotion()) return;

      const main = getMainContent();
      if (!main) return;

      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(secondFrameId);
      window.clearTimeout(cleanupTimer);

      main.classList.remove(PAGE_ENTER_CLASS);
      frameId = window.requestAnimationFrame(() => {
        secondFrameId = window.requestAnimationFrame(() => {
          main.classList.add(PAGE_ENTER_CLASS);
          cleanupTimer = window.setTimeout(() => {
            main.classList.remove(PAGE_ENTER_CLASS);
          }, PAGE_ENTER_DURATION);
        });
      });
    };

    const initialTimer = window.setTimeout(runPageTransition, 0);

    NAVIGATION_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, runPageTransition);
    });
    window.addEventListener("hashchange", runPageTransition);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(cleanupTimer);
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(secondFrameId);
      NAVIGATION_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, runPageTransition);
      });
      window.removeEventListener("hashchange", runPageTransition);
    };
  }, []);

  return null;
}
