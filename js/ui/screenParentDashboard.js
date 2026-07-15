import { listProfiles, hasFamilyPin, verifyFamilyPin, setFamilyPin } from "../core/profileManager.js";
import { weakTopics, strongTopics } from "../education/adaptiveEngine.js";
import { ACHIEVEMENTS } from "../rewards/achievements.js";
import { exportBackup } from "../storage/backup.js";
import { openModal } from "./modal.js";
import { showToast } from "./toast.js";

const PIN_LENGTH = 4;

export async function render(container, { goBack }) {
  const hasPin = await hasFamilyPin();
  let pinBuffer = "";
  let unlocked = !hasPin;

  container.innerHTML = `<div class="screen dashboard" id="pd-root"></div>`;
  const root = container.querySelector("#pd-root");

  function drawGate() {
    root.innerHTML = `
      <div class="row" style="margin-bottom:16px">
        <button class="btn btn-ghost btn-icon" id="pd-back" aria-label="Back">←</button>
        <h1 class="grow text-center">👪 Parent Dashboard</h1>
      </div>
      <div class="card text-center" style="max-width:340px;margin:0 auto">
        <p>${hasPin ? "Enter your PIN to continue" : "Set a 4-digit PIN to protect this dashboard (optional but recommended)"}</p>
        <div class="pin-dots" id="pd-dots"></div>
        <div class="pin-pad" id="pd-pad"></div>
        ${!hasPin ? `<button class="btn btn-ghost btn-sm" id="pd-skip" style="margin-top:12px">Skip for now</button>` : ""}
      </div>`;
    root.querySelector("#pd-back").addEventListener("click", () => goBack("profileSelect"));
    root.querySelector("#pd-skip")?.addEventListener("click", () => { unlocked = true; drawDashboard(); });
    drawDots();
    const pad = root.querySelector("#pd-pad");
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].forEach((k) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-ghost";
      btn.textContent = k;
      btn.addEventListener("click", () => onKey(k));
      pad.appendChild(btn);
    });
  }

  function drawDots() {
    const dots = root.querySelector("#pd-dots");
    if (!dots) return;
    dots.innerHTML = Array.from({ length: PIN_LENGTH }, (_, i) => `<span class="pin-dot ${i < pinBuffer.length ? "is-filled" : ""}"></span>`).join("");
  }

  async function onKey(k) {
    if (k === "⌫") { pinBuffer = pinBuffer.slice(0, -1); drawDots(); return; }
    if (k === "OK") { await submitPin(); return; }
    if (pinBuffer.length < PIN_LENGTH) { pinBuffer += k; drawDots(); }
    if (pinBuffer.length === PIN_LENGTH) await submitPin();
  }

  async function submitPin() {
    if (pinBuffer.length !== PIN_LENGTH) { showToast("Enter 4 digits"); return; }
    if (hasPin) {
      const ok = await verifyFamilyPin(pinBuffer);
      if (ok) { unlocked = true; drawDashboard(); }
      else { showToast("Incorrect PIN", { icon: "🔒" }); pinBuffer = ""; drawDots(); }
    } else {
      await setFamilyPin(pinBuffer);
      showToast("PIN set! Remember it for next time.", { icon: "🔐" });
      unlocked = true; drawDashboard();
    }
  }

  async function drawDashboard() {
    const profiles = await listProfiles();
    if (!profiles.length) {
      root.innerHTML = `<p class="text-center">No profiles yet.</p>`;
      return;
    }
    let selectedId = profiles[0].id;

    root.innerHTML = `
      <div class="row-wrap" style="margin-bottom:16px">
        <button class="btn btn-ghost btn-icon" id="pd-back2" aria-label="Back">←</button>
        <h1 class="grow">👪 Family Reports</h1>
        <button class="btn btn-secondary" id="pd-export">⬇ Export Backup</button>
        <button class="btn btn-ghost" id="pd-change-pin">🔐 Set/Change PIN</button>
      </div>
      <div class="row-wrap" style="margin-bottom:16px">
        <label for="pd-profile">Profile</label>
        <select class="select" id="pd-profile" style="max-width:220px"></select>
      </div>
      <div id="pd-stats"></div>`;

    root.querySelector("#pd-back2").addEventListener("click", () => goBack("profileSelect"));
    root.querySelector("#pd-export").addEventListener("click", async () => { await exportBackup(); showToast("Backup downloaded", { icon: "⬇" }); });
    root.querySelector("#pd-change-pin").addEventListener("click", () => openPinChangeModal());

    const select = root.querySelector("#pd-profile");
    profiles.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.name;
      select.appendChild(opt);
    });
    select.value = selectedId;
    select.addEventListener("change", () => drawStats(profiles.find((p) => p.id === select.value)));

    drawStats(profiles[0]);
  }

  function openPinChangeModal() {
    let buffer = "";
    openModal({
      title: "Set a New PIN",
      bodyHTML: `<div class="pin-dots" id="pd-new-dots">${Array.from({ length: PIN_LENGTH }).map(() => '<span class="pin-dot"></span>').join("")}</div><input id="pd-new-pin" class="input" maxlength="4" inputmode="numeric" placeholder="Enter 4 digits" style="margin-top:12px" />`,
      actions: [
        { label: "Cancel", variant: "ghost" },
        { label: "Save PIN", variant: "success", onClick: async () => {
          const val = document.getElementById("pd-new-pin").value;
          if (val.length === PIN_LENGTH) { await setFamilyPin(val); showToast("PIN updated", { icon: "🔐" }); }
          else showToast("PIN must be 4 digits");
        } },
      ],
    });
  }

  function drawStats(profile) {
    const today = new Date().toISOString().slice(0, 10);
    const todayMs = profile.stats.sessionsByDay[today] || 0;
    const mathTopics = Object.entries(profile.education.topics).filter(([k]) => k.startsWith("math"));
    const mathAccuracy = mathTopics.length ? Math.round(mathTopics.reduce((s, [, t]) => s + t.mastery, 0) / mathTopics.length) : 0;
    const weak = weakTopics(profile, 3);
    const strong = strongTopics(profile, 3);
    const unlockedAch = ACHIEVEMENTS.filter((a) => profile.achievements.unlocked.includes(a.id));

    const statsEl = document.createElement("div");
    statsEl.innerHTML = `
      <div class="dashboard-grid">
        <div class="card stat-card"><div>Play time today</div><div class="stat-card__value">${Math.round(todayMs / 60000)}m</div></div>
        <div class="card stat-card"><div>Total learning time</div><div class="stat-card__value">${Math.round(profile.stats.learningMs / 60000)}m</div></div>
        <div class="card stat-card"><div>Daily streak</div><div class="stat-card__value">🔥${profile.quests.daily.streak}</div></div>
        <div class="card stat-card"><div>Math accuracy</div><div class="stat-card__value">${mathAccuracy}%</div></div>
        <div class="card stat-card"><div>Typing speed</div><div class="stat-card__value">${profile.stats.typingBestWpm} WPM</div></div>
        <div class="card stat-card"><div>Books read</div><div class="stat-card__value">${profile.stats.booksRead}</div></div>
        <div class="card stat-card"><div>Words learned</div><div class="stat-card__value">${profile.stats.wordsLearned}</div></div>
        <div class="card stat-card"><div>Level</div><div class="stat-card__value">${profile.level}</div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Learning minutes — last 14 days</h3>
        <canvas class="chart-canvas" id="pd-chart"></canvas>
      </div>
      <div class="dashboard-grid" style="margin-top:16px">
        <div class="card stat-card"><h3>Weak topics</h3>${weak.length ? weak.map((t) => `<div>🔸 ${t}</div>`).join("") : "<div class=\"text-soft\">Not enough data yet</div>"}</div>
        <div class="card stat-card"><h3>Strong topics</h3>${strong.length ? strong.map((t) => `<div>🔹 ${t}</div>`).join("") : "<div class=\"text-soft\">Not enough data yet</div>"}</div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Achievements (${unlockedAch.length}/${ACHIEVEMENTS.length})</h3>
        <div class="row-wrap">${unlockedAch.map((a) => `<span class="chip" title="${a.desc}">${a.icon} ${a.name}</span>`).join("") || '<span class="text-soft">None yet — keep playing!</span>'}</div>
      </div>`;
    const old = root.querySelector("#pd-stats");
    old.innerHTML = "";
    old.appendChild(statsEl);
    drawChart(profile);
  }

  function drawChart(profile) {
    const canvas = root.querySelector("#pd-chart");
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 180 * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const w = rect.width, h = 180;
    ctx.clearRect(0, 0, w, h);

    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const minutes = days.map((d) => Math.round((profile.stats.sessionsByDay[d] || 0) / 60000));
    const max = Math.max(5, ...minutes);
    const barW = w / days.length;

    ctx.fillStyle = "#b48cff";
    minutes.forEach((m, i) => {
      const barH = (m / max) * (h - 24);
      ctx.fillRect(i * barW + 3, h - barH - 18, barW - 6, barH);
    });
    ctx.fillStyle = "#8577a0";
    ctx.font = "10px sans-serif";
    days.forEach((d, i) => {
      if (i % 2 === 0) ctx.fillText(d.slice(5), i * barW, h - 4);
    });
  }

  if (unlocked) drawDashboard(); else drawGate();
  return () => {};
}

export default { render };
