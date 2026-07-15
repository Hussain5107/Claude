import { init as initScenes, goTo } from "./sceneManager.js";
import { on } from "./eventBus.js";
import { setMuted } from "./audioManager.js";
import { installRewardListener } from "../ui/rewardListener.js";

function applyAccessibility(profile) {
  const root = document.documentElement;
  if (!profile) {
    root.removeAttribute("data-contrast");
    root.removeAttribute("data-text-size");
    root.removeAttribute("data-motion");
    return;
  }
  const { settings } = profile;
  root.setAttribute("data-contrast", settings.highContrast ? "high" : "normal");
  root.setAttribute("data-text-size", settings.largeText ? "large" : "normal");
  root.setAttribute("data-motion", settings.reducedMotion ? "reduced" : "normal");
  setMuted(!settings.sound);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((err) => {
      console.warn("[app] service worker registration failed", err);
    });
  });
}

function watchInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window.__dreamtownInstallPrompt = e;
  });
}

function bootstrap() {
  const root = document.getElementById("app");
  initScenes(root);
  on("profile:changed", (profile) => applyAccessibility(profile));
  on("session:started", async () => {
    const { getActiveProfile } = await import("./gameState.js");
    applyAccessibility(await getActiveProfile());
  });
  registerServiceWorker();
  watchInstallPrompt();
  installRewardListener();
  goTo("profileSelect");
}

bootstrap();
