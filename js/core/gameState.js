import { loadProfile, trackSessionTime } from "./profileManager.js";
import { emit } from "./eventBus.js";

/** In-memory session state. Never persisted directly — derived from profileManager. */
const state = {
  activeProfileId: null,
  currentScene: "profileSelect",
  sessionStartedAt: null,
  currentSceneIsLearning: false,
};

export function getActiveProfileId() {
  return state.activeProfileId;
}

export async function getActiveProfile() {
  if (!state.activeProfileId) return null;
  return loadProfile(state.activeProfileId);
}

export async function setActiveProfile(id) {
  state.activeProfileId = id;
  state.sessionStartedAt = Date.now();
  emit("session:started", { profileId: id });
}

export function clearActiveProfile() {
  flushSessionTime();
  state.activeProfileId = null;
  state.currentSceneIsLearning = false;
}

/** Flushes elapsed time under the given (or current) learning flag, then resets the clock. */
export function flushSessionTime(learning = state.currentSceneIsLearning) {
  if (!state.activeProfileId || !state.sessionStartedAt) return;
  const elapsed = Date.now() - state.sessionStartedAt;
  state.sessionStartedAt = Date.now();
  if (elapsed > 500) trackSessionTime(state.activeProfileId, elapsed, { learning });
}

/**
 * Called by sceneManager right before switching screens: flushes the time
 * spent in the scene being left (under ITS learning flag), then arms the
 * clock for the incoming scene.
 */
export function beginSceneSession(isLearning) {
  flushSessionTime(state.currentSceneIsLearning);
  state.currentSceneIsLearning = !!isLearning;
}

// Periodically flush so play time survives a closed tab, always under the current scene's flag.
setInterval(() => flushSessionTime(), 30000);

export const gameState = { getActiveProfileId, getActiveProfile, setActiveProfile, clearActiveProfile, flushSessionTime, beginSceneSession };
export default gameState;
