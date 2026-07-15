import { levelFromXp } from "../core/progression.js";
import { setMuted, isMuted } from "../core/audioManager.js";
import { mutateProfile } from "../core/profileManager.js";

/** Returns HUD markup string. `back` optional {label, onBack-handled via data attr}. */
export function hudHTML(profile, { showBack = false, title = "" } = {}) {
  const lvl = levelFromXp(profile.xp);
  return `
    <div class="hud">
      ${showBack ? `<button class="btn btn-ghost btn-icon" data-hud-back aria-label="Back">←</button>` : ""}
      ${title ? `<strong style="font-size:1.1em">${title}</strong>` : ""}
      <div class="hud-currency grow row-wrap">
        <span class="chip" data-hud-coins>🪙 <span data-value="coins">${profile.currency.coins}</span></span>
        <span class="chip">⭐ <span data-value="stars">${profile.currency.stars}</span></span>
        <span class="chip">💎 <span data-value="diamonds">${profile.currency.diamonds}</span></span>
      </div>
      <div class="hud-level">
        <span class="chip">Lv.${lvl.level}</span>
        <div class="meter" role="progressbar" aria-valuenow="${lvl.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Experience progress">
          <div class="meter-fill purple" style="width:${lvl.percent}%"></div>
        </div>
      </div>
      <button class="btn btn-ghost btn-icon" data-hud-mute aria-label="${isMuted() ? "Unmute sound" : "Mute sound"}">${isMuted() ? "🔇" : "🔊"}</button>
    </div>`;
}

/** Wires up the HUD's interactive bits after insertion into the DOM. */
export function wireHud(container, { profile, onBack } = {}) {
  container.querySelector("[data-hud-back]")?.addEventListener("click", () => onBack?.());
  const muteBtn = container.querySelector("[data-hud-mute]");
  muteBtn?.addEventListener("click", async () => {
    const next = !isMuted();
    setMuted(next);
    muteBtn.textContent = next ? "🔇" : "🔊";
    muteBtn.setAttribute("aria-label", next ? "Unmute sound" : "Mute sound");
    if (profile) {
      await mutateProfile(profile.id, (p) => { p.settings.sound = !next; });
    }
  });
}

export function updateHudCurrency(container, profile) {
  const root = container.querySelector(".hud");
  if (!root) return;
  root.querySelector('[data-value="coins"]').textContent = profile.currency.coins;
  root.querySelector('[data-value="stars"]').textContent = profile.currency.stars;
  root.querySelector('[data-value="diamonds"]').textContent = profile.currency.diamonds;
  const lvl = levelFromXp(profile.xp);
  const lvlChip = root.querySelector(".hud-level .chip");
  if (lvlChip) lvlChip.textContent = `Lv.${lvl.level}`;
  const fill = root.querySelector(".meter-fill");
  if (fill) fill.style.width = `${lvl.percent}%`;
}

export default { hudHTML, wireHud, updateHudCurrency };
