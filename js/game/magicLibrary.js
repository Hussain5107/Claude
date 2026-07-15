import { getActiveProfile } from "../core/gameState.js";
import { hudHTML, wireHud, updateHudCurrency } from "../ui/hud.js";
import { askQuestion } from "../ui/questionCard.js";
import { award } from "../rewards/rewardEngine.js";
import { recordAnswer } from "../education/adaptiveEngine.js";
import { pickStory, questionWithShuffledChoices } from "../education/readingContent.js";
import { openModal } from "../ui/modal.js";
import { loadProfile } from "../core/profileManager.js";
import { speak } from "../core/audioManager.js";

export const isLearning = true;

export async function render(container, { goBack }) {
  const profile = await getActiveProfile();
  if (!profile) { goBack("profileSelect"); return () => {}; }

  const story = pickStory(profile.ageGroup);
  let cancelled = false;

  container.innerHTML = `
    <div class="screen minigame">
      ${hudHTML(profile, { showBack: true, title: "📚 Magic Library" })}
      <div class="minigame-stage" id="ml-stage"></div>
    </div>`;
  wireHud(container, { profile, onBack: () => goBack("village") });

  const stage = container.querySelector("#ml-stage");

  function showStory() {
    stage.innerHTML = `
      <div class="story-page">
        <div class="story-page__title">${story.emoji} ${story.title}</div>
        <p>${story.text}</p>
      </div>
      <div class="row-wrap center" style="margin-top:16px">
        <button class="btn btn-secondary" id="ml-read-aloud">🔊 Read Aloud</button>
        <button class="btn btn-success" id="ml-continue">I'm Done Reading ➜</button>
      </div>`;
    stage.querySelector("#ml-read-aloud").addEventListener("click", () => speak(story.text));
    stage.querySelector("#ml-continue").addEventListener("click", () => runQuestions());
  }

  async function runQuestions() {
    let correctCount = 0;
    for (let i = 0; i < story.questions.length; i++) {
      if (cancelled) return;
      const q = questionWithShuffledChoices({ prompt: story.questions[i].q, choices: story.questions[i].choices, answer: story.questions[i].answer, type: "choice" });
      const { correct, timeMs } = await askQuestion(stage, q, { voice: profile.settings.voice });
      if (cancelled) return;
      if (correct) correctCount += 1;
      const sourceEl = stage.querySelector(".option-btn.is-correct");
      await award(profile.id, {
        coins: correct ? 4 : 1,
        xp: correct ? 8 : 2,
        questType: "reading",
        mutate: (draft) => recordAnswer(draft, `reading.${profile.ageGroup}`, { correct, timeMs }),
        sourceEl,
      });
      updateHudCurrency(container, await loadProfile(profile.id));
    }
    finish(correctCount);
  }

  async function finish(correctCount) {
    const accuracy = Math.round((correctCount / story.questions.length) * 100);
    await award(profile.id, {
      stars: accuracy >= 80 ? 3 : 1,
      rollChest: accuracy >= 70,
      chestChance: 0.35,
      mutate: (draft) => { draft.stats.booksRead += 1; },
    });
    openModal({
      title: "Story Complete! 📖✨",
      bodyHTML: `<p class="text-center">You understood <strong>${correctCount}/${story.questions.length}</strong> questions correctly. The library glows brighter!</p>`,
      dismissible: false,
      actions: [
        { label: "Back to Village", variant: "success", onClick: () => goBack("village") },
        { label: "Read Another", variant: "purple", onClick: () => render(container, { goBack }) },
      ],
    });
  }

  showStory();
  return () => { cancelled = true; };
}

export default { render, isLearning };
