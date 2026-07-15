import { sfx, speak } from "../core/audioManager.js";

/**
 * Renders one multiple-choice (or visual-count) question into `stageEl` and
 * resolves with { correct, selected, timeMs, el } once the child answers.
 * Shared by Math Castle and Word Forest.
 */
export function askQuestion(stageEl, question, { voice = false } = {}) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const visualHTML = question.type === "visual-count"
      ? `<div class="count-objects" aria-hidden="true">${question.visualItems.map((e) => `<span>${e}</span>`).join("")}</div>`
      : "";

    stageEl.innerHTML = `
      ${visualHTML}
      <div class="minigame-question" role="heading" aria-level="2">${escapeHTML(question.prompt).replace(/\n/g, "<br>")}</div>
      <div class="minigame-options" role="group" aria-label="Answer choices"></div>
    `;

    if (voice) speak(question.prompt.replace(/\n/g, ". "));

    const optionsEl = stageEl.querySelector(".minigame-options");
    let answered = false;

    question.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.type = "button";
      btn.textContent = String(choice);
      btn.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const correct = choice === question.answer;
        const timeMs = performance.now() - startedAt;
        [...optionsEl.children].forEach((b) => (b.disabled = true));
        if (correct) {
          btn.classList.add("is-correct");
          sfx.correct();
        } else {
          btn.classList.add("is-wrong");
          btn.classList.add("anim-shake");
          sfx.wrong();
          [...optionsEl.children].find((b) => b.textContent === String(question.answer))?.classList.add("is-correct");
        }
        setTimeout(() => resolve({ correct, selected: choice, timeMs }), correct ? 500 : 900);
      });
      optionsEl.appendChild(btn);
    });
  });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

export default { askQuestion };
