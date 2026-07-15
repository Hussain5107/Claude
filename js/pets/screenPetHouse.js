import { getActiveProfile } from "../core/gameState.js";
import { mutateProfile } from "../core/profileManager.js";
import { hudHTML, wireHud, updateHudCurrency } from "../ui/hud.js";
import { PET_CATALOG, findPet } from "./petData.js";
import { adoptPet, feedPet, moodFor } from "./petManager.js";
import { spend } from "../rewards/rewardEngine.js";
import { checkAchievements } from "../rewards/achievements.js";
import { showToast } from "../ui/toast.js";
import { sfx } from "../core/audioManager.js";
import { sparkleAt } from "../ui/rewardPopup.js";

export async function render(container, { goBack }) {
  let profile = await getActiveProfile();
  if (!profile) { goBack("profileSelect"); return () => {}; }

  container.innerHTML = `
    <div class="screen">
      ${hudHTML(profile, { showBack: true, title: "🐾 Pet House" })}
      <h2 class="text-center" style="margin-top:16px">My Pets</h2>
      <div class="pet-grid" id="ph-owned"></div>
      <h2 class="text-center">Adopt a New Friend</h2>
      <div class="pet-grid" id="ph-shop"></div>
    </div>`;
  wireHud(container, { profile, onBack: () => goBack("village") });

  const ownedEl = container.querySelector("#ph-owned");
  const shopEl = container.querySelector("#ph-shop");

  function drawOwned() {
    ownedEl.innerHTML = "";
    if (!profile.pets.owned.length) {
      ownedEl.innerHTML = `<p class="text-soft text-center">No pets yet — adopt one below!</p>`;
      return;
    }
    profile.pets.owned.forEach((p) => {
      const catalog = findPet(p.petId);
      const mood = moodFor(p.happiness);
      const card = document.createElement("div");
      card.className = "tile pet-card";
      card.innerHTML = `
        <div class="pet-card__emoji anim-float">${catalog?.emoji || "🐾"}</div>
        <div style="font-weight:800">${p.name}</div>
        <div class="text-soft">${mood.emoji} ${mood.label} · Lv.${p.level}</div>
        <div class="meter pet-happiness"><div class="meter-fill success" style="width:${p.happiness}%"></div></div>
        <div class="row-wrap center" style="margin-top:8px">
          <button class="btn btn-sm btn-accent" data-feed="${p.id}">🍎 Feed</button>
          <button class="btn btn-sm ${profile.pets.activePetId === p.id ? "btn-success" : "btn-ghost"}" data-active="${p.id}">${profile.pets.activePetId === p.id ? "★ Companion" : "Set as Companion"}</button>
        </div>`;
      ownedEl.appendChild(card);
    });
    ownedEl.querySelectorAll("[data-feed]").forEach((btn) => btn.addEventListener("click", () => feed(btn.dataset.feed, btn)));
    ownedEl.querySelectorAll("[data-active]").forEach((btn) => btn.addEventListener("click", () => setActive(btn.dataset.active)));
  }

  function drawShop() {
    shopEl.innerHTML = "";
    PET_CATALOG.forEach((catalogPet) => {
      const locked = catalogPet.unlockLevel > profile.level;
      const currencyIcon = catalogPet.currency === "diamonds" ? "💎" : "🪙";
      const affordable = catalogPet.currency === "diamonds" ? profile.currency.diamonds >= catalogPet.price : profile.currency.coins >= catalogPet.price;
      const card = document.createElement("div");
      card.className = "tile pet-card";
      if (locked) card.setAttribute("aria-disabled", "true");
      card.innerHTML = `
        <div class="pet-card__emoji">${catalogPet.emoji}</div>
        <div style="font-weight:800">${catalogPet.label}</div>
        <div class="text-soft">${locked ? `🔒 Level ${catalogPet.unlockLevel}` : `${currencyIcon} ${catalogPet.price}`}</div>
        <button class="btn btn-sm ${affordable && !locked ? "btn-success" : "btn-ghost"}" data-adopt="${catalogPet.id}" ${locked ? "disabled" : ""}>Adopt</button>`;
      shopEl.appendChild(card);
    });
    shopEl.querySelectorAll("[data-adopt]").forEach((btn) => btn.addEventListener("click", () => adopt(btn.dataset.adopt)));
  }

  async function feed(ownedId, btn) {
    profile = await mutateProfile(profile.id, (draft) => {
      feedPet(draft, ownedId, 15);
      checkAchievements(draft);
    });
    sfx.petHappy();
    sparkleAt(btn);
    drawOwned();
  }

  async function setActive(ownedId) {
    profile = await mutateProfile(profile.id, (draft) => { draft.pets.activePetId = ownedId; });
    sfx.click();
    drawOwned();
  }

  async function adopt(petId) {
    const catalogPet = findPet(petId);
    const cost = catalogPet.currency === "diamonds" ? { diamonds: catalogPet.price } : { coins: catalogPet.price };
    const { ok } = await spend(profile.id, cost);
    if (!ok) {
      showToast("You need more to adopt this friend — keep playing!", { icon: currencyEmoji(catalogPet) });
      return;
    }
    profile = await mutateProfile(profile.id, (draft) => {
      adoptPet(draft, petId);
      checkAchievements(draft);
    });
    sfx.chest();
    showToast(`You adopted a new ${catalogPet.label}!`, { icon: catalogPet.emoji });
    updateHudCurrency(container, profile);
    drawOwned();
    drawShop();
  }

  function currencyEmoji(p) { return p.currency === "diamonds" ? "💎" : "🪙"; }

  drawOwned();
  drawShop();
  return () => {};
}

export default { render };
