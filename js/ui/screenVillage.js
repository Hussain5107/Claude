import { getActiveProfile, clearActiveProfile } from "../core/gameState.js";
import { hudHTML, wireHud } from "../ui/hud.js";
import { renderAvatarSVG } from "../avatar/avatarRenderer.js";
import { buildingsFor } from "../../data/villageMap.js";
import { openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { sfx } from "../core/audioManager.js";
import { moodFor } from "../pets/petManager.js";
import { findPet } from "../pets/petData.js";
import { on } from "../core/eventBus.js";

export async function render(container, { goTo }) {
  const profile = await getActiveProfile();
  if (!profile) { goTo("profileSelect"); return () => {}; }

  container.innerHTML = `
    <div class="screen village">
      ${hudHTML(profile, { title: `${profile.name}'s Dream Town` })}
      <div class="row-wrap center" style="padding:10px 16px 0">
        <button class="btn btn-ghost btn-sm" id="v-switch">🔁 Switch Profile</button>
        <div class="chip anim-float">${renderAvatarSVG(profile.avatar, { size: 34 })} ${profile.name}</div>
        ${activePetChip(profile)}
      </div>
      <div class="village-map" id="v-map"></div>
      <div class="village-footer">
        <button class="btn btn-accent btn-lg" id="v-quests">📜 Daily Quests <span class="badge" id="v-quest-badge"></span></button>
        <button class="btn btn-purple btn-lg" id="v-avatar">🧑 My Avatar</button>
      </div>
    </div>`;

  wireHud(container, { profile });

  const map = container.querySelector("#v-map");
  buildingsFor(profile).forEach((b) => {
    const tile = document.createElement("div");
    tile.className = "tile building-tile";
    tile.setAttribute("role", "button");
    tile.setAttribute("tabindex", "0");
    const disabled = b.comingSoon || b.locked;
    if (disabled) tile.setAttribute("aria-disabled", "true");
    tile.innerHTML = `
      ${disabled ? `<span class="locked-badge">🔒</span>` : ""}
      <div class="building-tile__icon">${b.icon}</div>
      <div class="building-tile__name">${b.name}</div>
      <div class="building-tile__sub">${b.comingSoon ? "Coming soon" : b.locked ? "Locked" : b.subject}</div>`;
    const activate = () => onBuildingClick(b);
    tile.addEventListener("click", activate);
    tile.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") activate(); });
    map.appendChild(tile);
  });

  function onBuildingClick(b) {
    if (b.comingSoon) {
      sfx.swoosh();
      showToast(`${b.name} is being built by magic — coming in a future update!`, { icon: "🔒" });
      return;
    }
    if (b.locked) {
      openModal({
        title: `${b.name} is Locked`,
        bodyHTML: `<p class="text-center">Keep leveling up to unlock the ${b.name}!</p>`,
        actions: [{ label: "Okay", variant: "success" }],
      });
      return;
    }
    sfx.click();
    goTo(b.scene);
  }

  container.querySelector("#v-switch").addEventListener("click", () => {
    clearActiveProfile();
    goTo("profileSelect");
  });
  container.querySelector("#v-avatar").addEventListener("click", () => goTo("avatarEditor"));
  container.querySelector("#v-quests").addEventListener("click", () => openQuestsModal(profile));

  updateQuestBadge(profile);

  const unsub = on("profile:changed", async () => {
    const fresh = await getActiveProfile();
    if (fresh) updateQuestBadge(fresh);
  });

  function updateQuestBadge(p) {
    const remaining = p.quests.daily.tasks.filter((t) => !t.done).length;
    const el = container.querySelector("#v-quest-badge");
    if (el) el.textContent = remaining > 0 ? remaining : "✓";
  }

  return () => unsub();
}

function activePetChip(profile) {
  const active = profile.pets.owned.find((p) => p.id === profile.pets.activePetId);
  if (!active) return "";
  const catalog = findPet(active.petId);
  const mood = moodFor(active.happiness);
  return `<div class="chip">${catalog?.emoji || "🐾"} ${active.name} ${mood.emoji}</div>`;
}

function openQuestsModal(profile) {
  const daily = profile.quests.daily;
  const rows = daily.tasks.map((t) => `
    <div class="quest-item ${t.done ? "is-done" : ""}">
      <span class="quest-item__icon">${t.icon}</span>
      <div class="quest-item__body">
        <div>${t.label}</div>
        <div class="meter"><div class="meter-fill ${t.done ? "success" : ""}" style="width:${Math.min(100, (t.progress / t.target) * 100)}%"></div></div>
      </div>
      <span>${t.done ? "✅" : `${t.progress}/${t.target}`}</span>
    </div>`).join("");
  openModal({
    title: `📜 Daily Quests — Streak 🔥${daily.streak}`,
    bodyHTML: `<div class="quest-list">${rows}</div>`,
    actions: [{ label: "Close", variant: "success" }],
  });
}

export default { render };
