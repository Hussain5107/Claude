import { emit } from "./eventBus.js";
import { beginSceneSession } from "./gameState.js";

/**
 * Lightweight screen router. Each scene is lazy-loaded (dynamic import) so the
 * initial bundle stays small, and screens follow one contract:
 *   export function render(container, ctx) -> cleanup?()
 */
const registry = {
  profileSelect: () => import("../ui/screenProfileSelect.js"),
  village: () => import("../ui/screenVillage.js"),
  avatarEditor: () => import("../avatar/screenAvatarEditor.js"),
  houseEditor: () => import("../house/houseEditor.js"),
  petHouse: () => import("../pets/screenPetHouse.js"),
  parentDashboard: () => import("../ui/screenParentDashboard.js"),
  mathCastle: () => import("../game/mathCastle.js"),
  wordForest: () => import("../game/wordForest.js"),
  typingCafe: () => import("../game/typingCafe.js"),
  magicLibrary: () => import("../game/magicLibrary.js"),
  treasureCave: () => import("../game/treasureCave.js"),
};

let container = null;
let currentCleanup = null;
let currentScene = null;
const history = [];

export function init(rootEl) {
  container = rootEl;
}

export async function goTo(sceneName, params = {}, { replace = false } = {}) {
  const loader = registry[sceneName];
  if (!loader) {
    console.error(`[sceneManager] unknown scene "${sceneName}"`);
    return;
  }
  emit("scene:leave", { scene: currentScene });
  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch (err) { console.error(err); }
  }
  if (currentScene && !replace) history.push({ scene: currentScene, params: lastParams });

  container.innerHTML = "";
  container.setAttribute("aria-busy", "true");
  const loadingEl = document.createElement("div");
  loadingEl.className = "center";
  loadingEl.style.minHeight = "100dvh";
  loadingEl.innerHTML = `<div class="anim-float" style="font-size:3em">✨</div>`;
  container.appendChild(loadingEl);

  const mod = await loader();
  container.innerHTML = "";
  container.removeAttribute("aria-busy");

  currentScene = sceneName;
  lastParams = params;
  beginSceneSession(!!mod.isLearning);
  currentCleanup = await mod.render(container, { params, goTo, goBack });
  emit("scene:enter", { scene: sceneName, params, learning: !!mod.isLearning });
}

let lastParams = {};

export function goBack(fallback = "village") {
  const prev = history.pop();
  if (prev) goTo(prev.scene, prev.params, { replace: true });
  else goTo(fallback, {}, { replace: true });
}

export function currentSceneName() {
  return currentScene;
}

export const sceneManager = { init, goTo, goBack, currentSceneName };
export default sceneManager;
