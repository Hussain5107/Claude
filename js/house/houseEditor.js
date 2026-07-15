import { getActiveProfile } from "../core/gameState.js";
import { mutateProfile } from "../core/profileManager.js";
import { hudHTML, wireHud, updateHudCurrency } from "../ui/hud.js";
import { HOUSE_CATEGORIES, CATEGORY_LABELS, WALLPAPERS, FLOORINGS, ROOMS, itemsInCategory, findItem } from "./houseCatalog.js";
import { spend } from "../rewards/rewardEngine.js";
import { checkAchievements } from "../rewards/achievements.js";
import { progressQuest } from "../rewards/dailyQuests.js";
import { showToast } from "../ui/toast.js";
import { sfx } from "../core/audioManager.js";

function uid() { return `hi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`; }

export async function render(container, { goBack }) {
  let profile = await getActiveProfile();
  if (!profile) { goBack("profileSelect"); return () => {}; }

  let currentRoom = profile.house.unlockedRooms.includes("bedroom") ? "bedroom" : profile.house.unlockedRooms[0];
  let selectedInstanceId = null;

  container.innerHTML = `
    <div class="screen house-editor">
      ${hudHTML(profile, { showBack: true, title: "🏠 My Home" })}
      <div class="row-wrap center" style="padding:8px 16px 0">
        <select class="select" id="he-room" style="max-width:220px"></select>
        <select class="select" id="he-wallpaper" style="max-width:220px"></select>
        <select class="select" id="he-flooring" style="max-width:220px"></select>
        <button class="btn btn-success" id="he-done">Done ✓</button>
      </div>
      <div class="house-toolbar" id="he-toolbar" hidden>
        <button class="btn btn-sm" id="he-rotate">⟲ Rotate</button>
        <button class="btn btn-sm" id="he-smaller">− Smaller</button>
        <button class="btn btn-sm" id="he-bigger">+ Bigger</button>
        <button class="btn btn-sm btn-danger" id="he-delete">🗑 Delete</button>
      </div>
      <div class="house-body">
        <div class="house-canvas-wrap">
          <div class="house-canvas" id="he-canvas"></div>
        </div>
        <div class="house-catalog" id="he-catalog"></div>
      </div>
    </div>`;

  wireHud(container, { profile, onBack: () => goBack("village") });

  const roomSelect = container.querySelector("#he-room");
  const wallpaperSelect = container.querySelector("#he-wallpaper");
  const flooringSelect = container.querySelector("#he-flooring");
  const canvas = container.querySelector("#he-canvas");
  const catalogEl = container.querySelector("#he-catalog");
  const toolbar = container.querySelector("#he-toolbar");

  ROOMS.filter((r) => profile.house.unlockedRooms.includes(r.id)).forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r.id; opt.textContent = `${r.icon} ${r.label}`;
    roomSelect.appendChild(opt);
  });
  roomSelect.value = currentRoom;

  WALLPAPERS.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w.id; opt.textContent = `🎨 ${w.label}${w.unlockLevel > profile.level ? " 🔒" : ""}`;
    opt.disabled = w.unlockLevel > profile.level;
    wallpaperSelect.appendChild(opt);
  });
  FLOORINGS.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.id; opt.textContent = `🟫 ${f.label}${f.unlockLevel > profile.level ? " 🔒" : ""}`;
    opt.disabled = f.unlockLevel > profile.level;
    flooringSelect.appendChild(opt);
  });

  function roomData() {
    return profile.house.rooms[currentRoom];
  }

  function applyRoomBackground() {
    const room = roomData();
    wallpaperSelect.value = room.wallpaper;
    flooringSelect.value = room.flooring;
    const wp = WALLPAPERS.find((w) => w.id === room.wallpaper) || WALLPAPERS[0];
    const fl = FLOORINGS.find((f) => f.id === room.flooring) || FLOORINGS[0];
    canvas.style.background = `${wp.gradient}`;
    canvas.style.borderBottom = `40px solid ${fl.color}`;
  }

  function drawCanvas() {
    canvas.innerHTML = "";
    const room = roomData();
    room.placed.forEach((placed) => {
      const catalogItem = findItem(placed.itemId);
      if (!catalogItem) return;
      const el = document.createElement("div");
      el.className = `house-item ${placed.id === selectedInstanceId ? "is-selected" : ""}`;
      el.textContent = catalogItem.icon;
      el.style.left = `${placed.x}%`;
      el.style.top = `${placed.y}%`;
      el.style.transform = `translate(-50%,-50%) rotate(${placed.rotation}deg) scale(${placed.scale})`;
      el.style.zIndex = placed.layer;
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", catalogItem.label);
      el.addEventListener("pointerdown", (e) => startDrag(e, placed, el));
      el.addEventListener("click", (e) => { e.stopPropagation(); selectItem(placed.id); });
      canvas.appendChild(el);
    });
  }

  function selectItem(instanceId) {
    selectedInstanceId = instanceId;
    toolbar.hidden = !instanceId;
    drawCanvas();
  }

  canvas.addEventListener("click", () => selectItem(null));

  function startDrag(e, placed, el) {
    e.stopPropagation();
    selectItem(placed.id);
    el.setPointerCapture(e.pointerId);
    const canvasRect = canvas.getBoundingClientRect();

    function onMove(ev) {
      const x = Math.max(2, Math.min(98, ((ev.clientX - canvasRect.left) / canvasRect.width) * 100));
      const y = Math.max(2, Math.min(92, ((ev.clientY - canvasRect.top) / canvasRect.height) * 100));
      placed.x = x; placed.y = y;
      el.style.left = `${x}%`;
      el.style.top = `${y}%`;
    }
    function onUp() {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      persistRoom();
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
  }

  /** Persists the live (already-mutated in memory) placed positions for the current room. */
  async function persistRoom() {
    const localPlaced = roomData().placed;
    profile = await mutateProfile(profile.id, (draft) => {
      draft.house.rooms[currentRoom].placed = draft.house.rooms[currentRoom].placed.map((p) => {
        const live = localPlaced.find((lp) => lp.id === p.id);
        return live ? { ...p, x: live.x, y: live.y, rotation: live.rotation, scale: live.scale } : p;
      });
    });
  }

  function drawCatalog() {
    catalogEl.innerHTML = "";
    HOUSE_CATEGORIES.forEach((cat) => {
      const heading = document.createElement("div");
      heading.style.fontWeight = "800";
      heading.style.margin = "10px 0 4px";
      heading.textContent = CATEGORY_LABELS[cat];
      catalogEl.appendChild(heading);
      const grid = document.createElement("div");
      grid.className = "house-catalog-grid";
      itemsInCategory(cat).forEach((item) => {
        const locked = item.unlockLevel > profile.level;
        const btn = document.createElement("button");
        btn.className = "avatar-swatch";
        btn.disabled = locked || profile.currency.coins < item.price;
        btn.title = locked ? `Unlocks at level ${item.unlockLevel}` : `${item.label} — 🪙${item.price}`;
        btn.innerHTML = `<span>${item.icon}</span>`;
        if (locked) {
          const badge = document.createElement("span");
          badge.className = "locked-badge";
          badge.textContent = "🔒";
          btn.appendChild(badge);
        }
        btn.addEventListener("click", () => buyAndPlace(item));
        grid.appendChild(btn);
      });
      catalogEl.appendChild(grid);
    });
  }

  async function buyAndPlace(item) {
    const { ok, profile: after } = await spend(profile.id, { coins: item.price });
    if (!ok) {
      showToast("Not enough coins yet — keep learning to earn more!", { icon: "🪙" });
      return;
    }
    profile = after;
    sfx.coin();
    profile = await mutateProfile(profile.id, (draft) => {
      draft.house.rooms[currentRoom].placed.push({ id: uid(), itemId: item.id, x: 50, y: 60, rotation: 0, scale: 1, layer: draft.house.rooms[currentRoom].placed.length });
      const { questSetCompleted } = progressQuest(draft, "decorate", 1);
      if (questSetCompleted) { draft.currency.coins += 20; draft.currency.stars += 3; }
      checkAchievements(draft);
    });
    updateHudCurrency(container, profile);
    drawCanvas();
    drawCatalog();
  }

  container.querySelector("#he-rotate").addEventListener("click", () => mutateSelected((p) => { p.rotation = (p.rotation + 15) % 360; }));
  container.querySelector("#he-smaller").addEventListener("click", () => mutateSelected((p) => { p.scale = Math.max(0.5, p.scale - 0.1); }));
  container.querySelector("#he-bigger").addEventListener("click", () => mutateSelected((p) => { p.scale = Math.min(2, p.scale + 0.1); }));
  container.querySelector("#he-delete").addEventListener("click", async () => {
    await mutateProfile(profile.id, (draft) => {
      draft.house.rooms[currentRoom].placed = draft.house.rooms[currentRoom].placed.filter((p) => p.id !== selectedInstanceId);
    });
    profile = await getActiveProfile();
    selectItem(null);
    drawCanvas();
  });

  async function mutateSelected(fn) {
    const placed = roomData().placed.find((p) => p.id === selectedInstanceId);
    if (!placed) return;
    fn(placed);
    drawCanvas();
    await persistRoom();
  }

  roomSelect.addEventListener("change", () => {
    currentRoom = roomSelect.value;
    selectItem(null);
    applyRoomBackground();
    drawCanvas();
  });
  wallpaperSelect.addEventListener("change", async () => {
    if (WALLPAPERS.find((w) => w.id === wallpaperSelect.value)?.unlockLevel > profile.level) return;
    profile = await mutateProfile(profile.id, (draft) => { draft.house.rooms[currentRoom].wallpaper = wallpaperSelect.value; });
    applyRoomBackground();
  });
  flooringSelect.addEventListener("change", async () => {
    if (FLOORINGS.find((f) => f.id === flooringSelect.value)?.unlockLevel > profile.level) return;
    profile = await mutateProfile(profile.id, (draft) => { draft.house.rooms[currentRoom].flooring = flooringSelect.value; });
    applyRoomBackground();
  });
  container.querySelector("#he-done").addEventListener("click", () => goBack("village"));

  applyRoomBackground();
  drawCanvas();
  drawCatalog();

  return () => {};
}

export default { render };
