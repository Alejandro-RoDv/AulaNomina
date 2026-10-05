import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_TUTORIAL_STATE,
  TUTORIAL_STATE_KEY,
  hydrateTutorialState,
  normalizeTutorialState,
  readTutorialState,
  restartTutorial,
  writeTutorialState,
} from "../components/activities/trainingTutorialState.js";
import { AUTH_TOKEN_KEY } from "../services/authStorage.js";


function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}


test("tutorial state preserves the exact resume point", () => {
  const storage = memoryStorage();
  const saved = writeTutorialState({
    phase: "familiarization",
    slideIndex: 3,
    familiarizationIndex: 2,
    completed: false,
    dismissed: true,
  }, storage);

  assert.deepEqual(readTutorialState(storage), saved);
  assert.equal(readTutorialState(storage).familiarizationIndex, 2);
  assert.equal(readTutorialState(storage).dismissed, true);
});


test("restart resets tutorial without depending on course state", () => {
  const storage = memoryStorage({
    [TUTORIAL_STATE_KEY]: JSON.stringify({
      phase: "hidden",
      slideIndex: 3,
      familiarizationIndex: 3,
      completed: true,
      dismissed: false,
    }),
  });

  const restarted = restartTutorial(storage);
  assert.deepEqual(restarted, DEFAULT_TUTORIAL_STATE);
  assert.deepEqual(readTutorialState(storage), DEFAULT_TUTORIAL_STATE);
});


test("legacy familiarization completion is migrated locally", () => {
  const storage = memoryStorage({
    "aulanomina:training-familiarization-v1": "completed",
  });

  const state = readTutorialState(storage);
  assert.equal(state.completed, true);
  assert.equal(state.phase, "hidden");
  assert.equal(state.familiarizationIndex, 3);
});


test("tutorial indexes are normalized to supported steps", () => {
  assert.deepEqual(
    normalizeTutorialState({ phase: "invalid", slideIndex: 99, familiarizationIndex: -4 }),
    { ...DEFAULT_TUTORIAL_STATE, slideIndex: 3 }
  );
});


test("server tutorial state becomes authoritative on another device", async () => {
  const localStorage = memoryStorage({
    [AUTH_TOKEN_KEY]: "token-demo",
    [TUTORIAL_STATE_KEY]: JSON.stringify(DEFAULT_TUTORIAL_STATE),
  });
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  globalThis.window = { localStorage };
  globalThis.fetch = async (url, options = {}) => {
    assert.match(String(url), /\/training-workspace\/tutorial-state$/);
    assert.equal(options.headers.Authorization, "Bearer token-demo");
    return new Response(JSON.stringify({
      workspace_id: 9,
      initialized: true,
      phase: "familiarization",
      slideIndex: 3,
      familiarizationIndex: 1,
      completed: false,
      dismissed: true,
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const hydrated = await hydrateTutorialState();
    assert.equal(hydrated.phase, "familiarization");
    assert.equal(hydrated.familiarizationIndex, 1);
    assert.equal(hydrated.dismissed, true);
    assert.deepEqual(readTutorialState(localStorage), hydrated);
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});


test("an uninitialized workspace imports existing local tutorial progress", async () => {
  const localProgress = {
    phase: "onboarding",
    slideIndex: 2,
    familiarizationIndex: 0,
    completed: false,
    dismissed: true,
  };
  const localStorage = memoryStorage({
    [AUTH_TOKEN_KEY]: "token-demo",
    [TUTORIAL_STATE_KEY]: JSON.stringify(localProgress),
  });
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.window = { localStorage };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if ((options.method || "GET") === "PUT") {
      return new Response(JSON.stringify({ workspace_id: 10, initialized: true, ...JSON.parse(options.body) }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ workspace_id: 10, initialized: false, ...DEFAULT_TUTORIAL_STATE }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const hydrated = await hydrateTutorialState();
    assert.deepEqual(hydrated, localProgress);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].options.method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].options.body), localProgress);
  } finally {
    globalThis.window = previousWindow;
    globalThis.fetch = previousFetch;
  }
});
