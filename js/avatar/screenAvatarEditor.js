import { getActiveProfile } from "../core/gameState.js";
import { mutateProfile } from "../core/profileManager.js";
import { hudHTML, wireHud } from "../ui/hud.js";
import { renderAvatarSVG } from "./avatarRenderer.js";
import { AVATAR_CATEGORIES } from "./avatarCatalog.js";
import { sfx } from "../core/audioManager.js";

function isOwned(profile, item) {
  if (!item.id) return true;
  return (item.unlockLevel || 0) === 0 || profile.wardrobe.owned.includes(item.id);
}
function isUnlockedByLevel(profile, item) {
  return (item.unlockLevel || 0) <= profile.level;
}

export async function render(container, { goTo, goBack }) {
  let profile = await getActiveProfile();
  if (!profile) { goTo("profileSelect"); return () => {}; }

  let activeCategory = AVATAR_CATEGORIES[0].key;

  container.innerHTML = `
    <div class="screen">
      ${hudHTML(profile, { showBack: true, title: "🧑 My Avatar" })}
      <div class="avatar-editor">
        <div class="avatar-preview card">
          <div class="avatar-preview__stage" id="ae-preview"></div>
          <div class="row-wrap center">
            <button class="btn btn-secondary btn-sm" id="ae-wave">👋 Wave</button>
            <button class="btn btn-accent btn-sm" id="ae-dance">💃 Dance</button>
            <button class="btn btn-success btn-sm" id="ae-celebrate">🎉 Celebrate</button>
          </div>
        </div>
        <div class="avatar-options card">
          <div class="avatar-tabs" id="ae-tabs"></div>
          <div class="avatar-swatch-grid" id="ae-swatches"></div>
        </div>
      </div>
    </div>`;

  wireHud(container, { profile, onBack: () => goBack("village") });

  const preview = container.querySelector("#ae-preview");
  const tabsEl = container.querySelector("#ae-tabs");
  const swatchesEl = container.querySelector("#ae-swatches");

  function drawPreview() {
    preview.innerHTML = renderAvatarSVG(profile.avatar, { size: 220 });
  }

  function drawTabs() {
    tabsEl.innerHTML = "";
    AVATAR_CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = `btn btn-sm ${cat.key === activeCategory ? "btn-purple" : "btn-ghost"}`;
      btn.textContent = cat.label;
      btn.addEventListener("click", () => { activeCategory = cat.key; drawTabs(); drawSwatches(); });
      tabsEl.appendChild(btn);
    });
  }

  function isSelected(cat, item) {
    if (cat.multi) return (profile.avatar[cat.key] || []).includes(item.id);
    return profile.avatar[cat.key] === item.id;
  }

  function drawSwatches() {
    const cat = AVATAR_CATEGORIES.find((c) => c.key === activeCategory);
    swatchesEl.innerHTML = "";
    cat.options.forEach((item) => {
      const owned = isOwned(profile, item);
      const levelOk = isUnlockedByLevel(profile, item);
      const locked = !owned;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `avatar-swatch ${isSelected(cat, item) ? "is-selected" : ""} ${locked ? "is-locked" : ""}`;
      btn.setAttribute("aria-label", item.label || item.id || "None");
      btn.disabled = locked;
      btn.innerHTML = swatchContent(item);
      if (locked) {
        const badge = document.createElement("span");
        badge.className = "locked-badge";
        badge.textContent = levelOk ? "🎁" : "🔒";
        badge.title = levelOk ? "Find in a mystery chest!" : `Unlocks at level ${item.unlockLevel}`;
        btn.appendChild(badge);
      }
      btn.addEventListener("click", () => selectItem(cat, item));
      swatchesEl.appendChild(btn);
    });
  }

  function swatchContent(item) {
    if (item.color) return `<span style="width:28px;height:28px;border-radius:50%;background:${item.color};display:inline-block;border:2px solid #fff;box-shadow:0 0 0 1px #ddd"></span>`;
    if (item.emoji) return `<span>${item.emoji}</span>`;
    return `<span style="font-size:0.6em">${item.label}</span>`;
  }

  async function selectItem(cat, item) {
    sfx.click();
    profile = await mutateProfile(profile.id, (draft) => {
      if (cat.multi) {
        const list = draft.avatar[cat.key] || [];
        const idx = list.indexOf(item.id);
        if (idx >= 0) list.splice(idx, 1); else list.push(item.id);
        draft.avatar[cat.key] = list;
      } else {
        draft.avatar[cat.key] = item.id;
      }
    });
    drawPreview();
    drawSwatches();
  }

  container.querySelector("#ae-wave").addEventListener("click", () => playAnim("wave"));
  container.querySelector("#ae-dance").addEventListener("click", () => playAnim("dance"));
  container.querySelector("#ae-celebrate").addEventListener("click", () => playAnim("celebrate"));

  function playAnim(kind) {
    sfx.pop();
    preview.style.animation = "none";
    // Force reflow so repeated clicks always restart the animation.
    void preview.offsetWidth;
    preview.style.animation = kind === "wave" ? "wiggle 0.6s ease-in-out 2" : kind === "dance" ? "floatY 0.5s ease-in-out 3" : "bounceIn 0.6s var(--ease-bounce)";
  }

  drawPreview();
  drawTabs();
  drawSwatches();

  return () => {};
}

export default { render };
