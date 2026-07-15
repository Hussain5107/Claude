import { listProfiles, createProfile, deleteProfile } from "../core/profileManager.js";
import { setActiveProfile } from "../core/gameState.js";
import { renderAvatarSVG } from "../avatar/avatarRenderer.js";
import { openModal } from "../ui/modal.js";
import { showToast } from "../ui/toast.js";
import { sfx } from "../core/audioManager.js";
import { ensureDailyQuests, ensureWeeklyMissions } from "../rewards/dailyQuests.js";
import { applyHappinessDecay } from "../pets/petManager.js";
import { mutateProfile } from "../core/profileManager.js";

export async function render(container, { goTo }) {
  let manageMode = false;
  const profiles = await listProfiles();

  container.innerHTML = `
    <div class="screen profile-select">
      <h1 class="profile-select__title">✨ The Sisters' Dream Town ✨</h1>
      <p class="text-center text-soft">Choose your magical caretaker</p>
      <div class="profile-grid" id="ps-grid"></div>
      <div class="row-wrap center">
        <button class="btn btn-ghost" id="ps-manage">Manage Profiles</button>
        <button class="btn btn-purple" id="ps-dashboard">👪 Parent Dashboard</button>
      </div>
    </div>`;

  const grid = container.querySelector("#ps-grid");

  function draw() {
    grid.innerHTML = "";
    profiles.forEach((p) => {
      const card = document.createElement("div");
      card.className = "tile profile-card";
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.setAttribute("aria-label", `Play as ${p.name}, level ${p.level}`);
      card.innerHTML = `
        <div class="profile-card__avatar avatar-frame">${renderAvatarSVG(p.avatar, { size: 90 })}</div>
        <div class="profile-card__name">${p.name}</div>
        <div class="text-soft">Lv.${p.level} · ⭐${p.currency.stars}</div>
        ${manageMode ? `<button class="btn btn-sm btn-danger" style="margin-top:8px" data-delete="${p.id}">🗑 Remove</button>` : ""}
      `;
      const activate = () => selectProfile(p.id);
      if (!manageMode) {
        card.addEventListener("click", activate);
        card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") activate(); });
      }
      grid.appendChild(card);
    });

    const addCard = document.createElement("div");
    addCard.className = "tile profile-card profile-card--add";
    addCard.setAttribute("role", "button");
    addCard.setAttribute("tabindex", "0");
    addCard.innerHTML = `<span class="plus-icon">➕</span><span>Add Child</span>`;
    addCard.addEventListener("click", openCreateModal);
    addCard.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openCreateModal(); });
    grid.appendChild(addCard);

    grid.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        confirmDelete(btn.dataset.delete);
      });
    });
  }

  function confirmDelete(id) {
    const p = profiles.find((x) => x.id === id);
    openModal({
      title: "Remove Profile?",
      bodyHTML: `<p class="text-center">This will permanently delete <strong>${p?.name}</strong>'s progress, house, pets and avatar. This can't be undone.</p>`,
      actions: [
        { label: "Cancel", variant: "ghost" },
        { label: "Delete Forever", variant: "danger", onClick: async () => {
          await deleteProfile(id);
          const idx = profiles.findIndex((x) => x.id === id);
          if (idx >= 0) profiles.splice(idx, 1);
          draw();
          showToast("Profile removed", { icon: "🗑" });
        } },
      ],
    });
  }

  container.querySelector("#ps-manage").addEventListener("click", () => {
    manageMode = !manageMode;
    container.querySelector("#ps-manage").textContent = manageMode ? "Done" : "Manage Profiles";
    draw();
  });

  container.querySelector("#ps-dashboard").addEventListener("click", () => goTo("parentDashboard"));

  function openCreateModal() {
    openModal({
      title: "Add a New Caretaker",
      bodyHTML: `
        <div class="stack">
          <label>Name<input class="input" id="new-name" maxlength="20" placeholder="e.g. Meezab" /></label>
          <label>Age<input class="input" id="new-age" type="number" min="3" max="16" value="7" /></label>
        </div>`,
      actions: [
        { label: "Cancel", variant: "ghost" },
        { label: "Create ✨", variant: "success", onClick: async () => {
          const name = document.getElementById("new-name").value.trim() || "New Friend";
          const age = Math.max(3, Math.min(16, parseInt(document.getElementById("new-age").value, 10) || 7));
          const p = await createProfile({ name, age });
          profiles.push(p);
          draw();
          sfx.chest();
        } },
      ],
    });
  }

  async function selectProfile(id) {
    sfx.click();
    await setActiveProfile(id);
    await mutateProfile(id, (draft) => {
      ensureDailyQuests(draft);
      ensureWeeklyMissions(draft);
      applyHappinessDecay(draft);
    });
    goTo("village");
  }

  draw();
  return () => {};
}

export default { render };
