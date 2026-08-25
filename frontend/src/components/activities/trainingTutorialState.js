export const TUTORIAL_STATE_KEY = "aulanomina:training-tutorial-state-v2";
const LEGACY_ONBOARDING_KEY = "aulanomina:training-onboarding-v1";
const LEGACY_FAMILIARIZATION_KEY = "aulanomina:training-familiarization-v1";

export const DEFAULT_TUTORIAL_STATE = {
  phase: "onboarding",
  slideIndex: 0,
  familiarizationIndex: 0,
  completed: false,
  dismissed: false,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

export function normalizeTutorialState(value = {}) {
  const phase = ["onboarding", "familiarization", "hidden"].includes(value.phase)
    ? value.phase
    : DEFAULT_TUTORIAL_STATE.phase;
  return {
    phase,
    slideIndex: clamp(value.slideIndex, 0, 3),
    familiarizationIndex: clamp(value.familiarizationIndex, 0, 3),
    completed: Boolean(value.completed),
    dismissed: Boolean(value.dismissed),
  };
}

export function readTutorialState(storage = null) {
  const target = storage || (typeof window !== "undefined" ? window.localStorage : null);
  if (!target) return { ...DEFAULT_TUTORIAL_STATE };

  try {
    const raw = target.getItem(TUTORIAL_STATE_KEY);
    if (raw) return normalizeTutorialState(JSON.parse(raw));

    const onboardingDone = target.getItem(LEGACY_ONBOARDING_KEY) === "completed";
    const familiarizationDone = target.getItem(LEGACY_FAMILIARIZATION_KEY) === "completed";
    if (familiarizationDone) {
      return {
        ...DEFAULT_TUTORIAL_STATE,
        phase: "hidden",
        slideIndex: 3,
        familiarizationIndex: 3,
        completed: true,
      };
    }
    if (onboardingDone) {
      return {
        ...DEFAULT_TUTORIAL_STATE,
        phase: "familiarization",
      };
    }
  } catch {
    return { ...DEFAULT_TUTORIAL_STATE };
  }

  return { ...DEFAULT_TUTORIAL_STATE };
}

export function writeTutorialState(nextState, storage = null) {
  const target = storage || (typeof window !== "undefined" ? window.localStorage : null);
  const normalized = normalizeTutorialState(nextState);
  if (!target) return normalized;
  try {
    target.setItem(TUTORIAL_STATE_KEY, JSON.stringify(normalized));
  } catch {
    // El tutorial sigue siendo utilizable aunque el navegador bloquee localStorage.
  }
  return normalized;
}

export function restartTutorial(storage = null) {
  return writeTutorialState({ ...DEFAULT_TUTORIAL_STATE }, storage);
}

export function tutorialStatusLabel(state) {
  const current = normalizeTutorialState(state);
  if (current.completed) return "Tutorial completado";
  if (current.phase === "familiarization") {
    return `Familiarización · paso ${current.familiarizationIndex + 1} de 4`;
  }
  return `Introducción · paso ${current.slideIndex + 1} de 4`;
}
