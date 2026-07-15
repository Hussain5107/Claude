import { sfx } from "../core/audioManager.js";

function fxLayer() {
  let layer = document.querySelector(".fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "fx-layer";
    document.body.appendChild(layer);
  }
  return layer;
}

const CONFETTI_COLORS = ["#ff7ab8", "#7fd8ff", "#ffd166", "#b48cff", "#6fd88a"];

/** Coins/stars flying from a source element toward the HUD wallet chip. */
export function flyCurrency({ fromEl, count = 3, icon = "🪙" }) {
  const layer = fxLayer();
  const target = document.querySelector("[data-hud-coins]") || document.body;
  const from = fromEl?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
  const to = target.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "fx-coin";
    el.textContent = icon;
    const x0 = from.left + from.width / 2;
    const y0 = from.top + from.height / 2;
    const x1 = to.left + to.width / 2 - x0;
    const y1 = to.top + to.height / 2 - y0;
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    el.style.setProperty("--fx-x0", "0px");
    el.style.setProperty("--fx-y0", "0px");
    el.style.setProperty("--fx-x1", `${x1}px`);
    el.style.setProperty("--fx-y1", `${y1}px`);
    el.style.animationDelay = `${i * 60}ms`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 900 + i * 60);
  }
  sfx.coin();
}

export function confettiBurst({ count = 24 } = {}) {
  const layer = fxLayer();
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.className = "fx-confetti";
    el.style.left = `${Math.random() * 100}vw`;
    el.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    el.style.animationDelay = `${Math.random() * 0.4}s`;
    el.style.animationDuration = `${1.8 + Math.random() * 1.2}s`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

export function sparkleAt(el) {
  if (!el) return;
  const layer = fxLayer();
  const rect = el.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const s = document.createElement("div");
    s.className = "fx-sparkle";
    s.textContent = "✨";
    s.style.left = `${rect.left + Math.random() * rect.width}px`;
    s.style.top = `${rect.top + Math.random() * rect.height}px`;
    s.style.animationDelay = `${i * 80}ms`;
    layer.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}

/** Big blocking celebration screen for level-ups, achievements, mystery chests. */
export function showCelebration({ emoji = "🎉", title, subtitle, actionLabel = "Yay!", onDone } = {}) {
  sfx.levelUp();
  confettiBurst({ count: 40 });
  const overlay = document.createElement("div");
  overlay.className = "celebration-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="celebration-card">
      <div style="font-size:4em" class="anim-pop" aria-hidden="true">${emoji}</div>
      <h2 style="margin:12px 0 6px">${title}</h2>
      <p class="text-soft">${subtitle || ""}</p>
      <button class="btn btn-lg btn-accent" style="margin-top:20px">${actionLabel}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("button").addEventListener("click", () => {
    overlay.remove();
    onDone?.();
  });
  overlay.querySelector("button").focus();
}

export default { flyCurrency, confettiBurst, sparkleAt, showCelebration };
