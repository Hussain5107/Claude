import { getActiveProfile } from "../core/gameState.js";
import { hudHTML, wireHud, updateHudCurrency } from "../ui/hud.js";
import { award } from "../rewards/rewardEngine.js";
import { getDifficulty, recordAnswer } from "../education/adaptiveEngine.js";
import { generateTypingPrompt, computeWpm, computeAccuracy, KEYBOARD_ROWS } from "../education/typingGenerator.js";
import { openModal } from "../ui/modal.js";
import { loadProfile } from "../core/profileManager.js";
import { sfx } from "../core/audioManager.js";

export const isLearning = true;

const PROMPTS_BY_AGE = { 5: 6, 7: 6, 12: 5 };

export async function render(container, { goBack }) {
  const profile = await getActiveProfile();
  if (!profile) { goBack("profileSelect"); return () => {}; }

  const totalPrompts = PROMPTS_BY_AGE[profile.ageGroup] || 6;

  container.innerHTML = `
    <div class="screen minigame">
      ${hudHTML(profile, { showBack: true, title: "⌨️ Typing Cafe" })}
      <div class="minigame-stage">
        <div class="row-wrap center">
          <span class="chip">Prompt <span id="tc-index">1</span>/${totalPrompts}</span>
          <span class="typing-stats">
            <span>⚡ <span id="tc-wpm">0</span> WPM</span>
            <span>🎯 <span id="tc-acc">100</span>%</span>
          </span>
        </div>
        <div class="typing-prompt" id="tc-prompt" aria-live="off"></div>
        <div class="keyboard" id="tc-keyboard" aria-hidden="true"></div>
        <label class="visually-hidden" for="tc-input">Type the text shown above</label>
        <input id="tc-input" class="input" style="max-width:400px" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Typing input" />
      </div>
      <div class="minigame-footer">
        <div class="meter"><div class="meter-fill success" id="tc-progress" style="width:0%"></div></div>
      </div>
    </div>`;

  wireHud(container, { profile, onBack: () => goBack("village") });

  const keyboardEl = container.querySelector("#tc-keyboard");
  keyboardEl.innerHTML = KEYBOARD_ROWS.map((row) => `<div class="keyboard-row">${row.map((k) => `<div class="key" data-key="${k}">${k}</div>`).join("")}</div>`).join("");

  const promptEl = container.querySelector("#tc-prompt");
  const input = container.querySelector("#tc-input");
  let cancelled = false;
  let index = 0;
  let totalCorrectChars = 0;
  let totalTypedChars = 0;
  let roundStartedAt = performance.now();
  let currentText = "";
  let promptStartedAt = 0;
  let topicKey = "typing.words";

  function highlightKey(char) {
    keyboardEl.querySelectorAll(".key.is-active").forEach((k) => k.classList.remove("is-active"));
    const el = keyboardEl.querySelector(`[data-key="${(char || "").toLowerCase()}"]`);
    el?.classList.add("is-active");
  }

  function renderPromptSpans(typedValue) {
    promptEl.innerHTML = [...currentText].map((ch, i) => {
      const cls = i < typedValue.length ? (typedValue[i] === ch ? "char-done" : "char-wrong") : i === typedValue.length ? "char-current" : "char-pending";
      return `<span class="${cls}">${escapeHTML(ch)}</span>`;
    }).join("");
  }

  function escapeHTML(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  async function nextPrompt() {
    if (index >= totalPrompts) { finish(); return; }
    const fresh = await loadProfile(profile.id);
    const difficulty = getDifficulty(fresh, "typing.words");
    const p = generateTypingPrompt(profile.ageGroup, difficulty);
    currentText = p.text;
    topicKey = p.topicKey;
    input.value = "";
    container.querySelector("#tc-index").textContent = index + 1;
    container.querySelector("#tc-progress").style.width = `${(index / totalPrompts) * 100}%`;
    renderPromptSpans("");
    highlightKey(currentText[0]);
    promptStartedAt = performance.now();
    input.disabled = false;
    input.focus();
  }

  function onInput() {
    if (cancelled) return;
    const typed = input.value;
    renderPromptSpans(typed);
    highlightKey(currentText[typed.length]);
    if (typed.length >= currentText.length) {
      input.disabled = true;
      let correctChars = 0;
      for (let i = 0; i < currentText.length; i++) if (typed[i] === currentText[i]) correctChars += 1;
      totalCorrectChars += correctChars;
      totalTypedChars += currentText.length;
      const accuracy = computeAccuracy(correctChars, currentText.length);
      const timeMs = performance.now() - promptStartedAt;
      const correct = accuracy >= 80;
      correct ? sfx.correct() : sfx.wrong();

      award(profile.id, {
        coins: correct ? 3 : 1,
        xp: correct ? 6 : 2,
        questType: "typing",
        mutate: (draft) => recordAnswer(draft, topicKey, { correct, timeMs }),
      }).then(async () => updateHudCurrency(container, await loadProfile(profile.id)));

      const elapsedMs = performance.now() - roundStartedAt;
      const wpm = computeWpm(totalTypedChars, elapsedMs);
      const overallAccuracy = computeAccuracy(totalCorrectChars, totalTypedChars);
      container.querySelector("#tc-wpm").textContent = wpm;
      container.querySelector("#tc-acc").textContent = overallAccuracy;

      index += 1;
      setTimeout(nextPrompt, 500);
    }
  }

  input.addEventListener("input", onInput);

  async function finish() {
    const elapsedMs = performance.now() - roundStartedAt;
    const wpm = computeWpm(totalTypedChars, elapsedMs);
    const accuracy = computeAccuracy(totalCorrectChars, totalTypedChars);
    await award(profile.id, {
      stars: accuracy >= 85 ? 3 : accuracy >= 60 ? 1 : 0,
      rollChest: accuracy >= 80,
      chestChance: 0.35,
      mutate: (draft) => {
        if (wpm > draft.stats.typingBestWpm) draft.stats.typingBestWpm = wpm;
        if (accuracy > draft.stats.typingBestAccuracy) draft.stats.typingBestAccuracy = accuracy;
      },
    });
    openModal({
      title: "Typing Cafe Closed for Today! ☕",
      bodyHTML: `<p class="text-center">Speed: <strong>${wpm} WPM</strong><br>Accuracy: <strong>${accuracy}%</strong></p>`,
      dismissible: false,
      actions: [
        { label: "Back to Village", variant: "success", onClick: () => goBack("village") },
        { label: "Play Again", variant: "purple", onClick: () => render(container, { goBack }) },
      ],
    });
  }

  nextPrompt();

  return () => { cancelled = true; input.removeEventListener("input", onInput); };
}

export default { render, isLearning };
