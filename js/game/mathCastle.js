import { getActiveProfile } from "../core/gameState.js";
import { hudHTML, wireHud, updateHudCurrency } from "../ui/hud.js";
import { askQuestion } from "../ui/questionCard.js";
import { award } from "../rewards/rewardEngine.js";
import { getDifficulty, recordAnswer, pickWeightedTopic } from "../education/adaptiveEngine.js";
import { generateMathQuestion, SUBTOPICS_BY_AGE } from "../education/mathGenerator.js";
import { openModal } from "../ui/modal.js";
import { loadProfile } from "../core/profileManager.js";

export const isLearning = true;

const TOTAL_QUESTIONS = 10;

export async function render(container, { goBack }) {
  const profile = await getActiveProfile();
  if (!profile) { goBack("profileSelect"); return () => {}; }

  container.innerHTML = `
    <div class="screen minigame">
      ${hudHTML(profile, { showBack: true, title: "🏰 Math Castle" })}
      <div class="minigame-stage" id="mc-stage"></div>
      <div class="minigame-footer">
        <div class="row-wrap center" style="margin-bottom:8px">
          <span class="chip">🔥 Streak <span id="mc-streak">0</span></span>
          <span class="chip">Question <span id="mc-index">1</span>/${TOTAL_QUESTIONS}</span>
        </div>
        <div class="meter"><div class="meter-fill success" id="mc-progress" style="width:0%"></div></div>
      </div>
    </div>`;

  wireHud(container, { profile, onBack: () => goBack("village") });

  let cancelled = false;
  let streak = 0;
  let correctCount = 0;
  const stage = container.querySelector("#mc-stage");
  const candidates = (SUBTOPICS_BY_AGE[profile.ageGroup] || SUBTOPICS_BY_AGE["7"]).map((s) => `math.${s}`);

  async function runRound() {
    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      if (cancelled) return;
      const fresh = await loadProfile(profile.id);
      const topicKey = pickWeightedTopic(fresh, candidates);
      const subtopic = topicKey.split(".")[1];
      const difficulty = getDifficulty(fresh, topicKey);
      const question = generateMathQuestion(subtopic, difficulty, profile.ageGroup);

      container.querySelector("#mc-index").textContent = i + 1;
      container.querySelector("#mc-progress").style.width = `${(i / TOTAL_QUESTIONS) * 100}%`;

      const { correct, timeMs } = await askQuestion(stage, question, { voice: profile.settings.voice });
      if (cancelled) return;

      streak = correct ? streak + 1 : 0;
      if (correct) correctCount += 1;
      container.querySelector("#mc-streak").textContent = streak;

      const coins = correct ? 3 + Math.floor(streak / 3) : 0;
      const xp = correct ? 6 : 1;
      const sourceEl = stage.querySelector(".option-btn.is-correct");
      await award(profile.id, {
        coins, xp, questType: "math",
        mutate: (draft) => recordAnswer(draft, topicKey, { correct, timeMs }),
        sourceEl,
      });
      updateHudCurrency(container, await loadProfile(profile.id));
    }
    if (!cancelled) showRoundComplete();
  }

  function showRoundComplete() {
    const accuracy = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
    openModal({
      title: accuracy >= 70 ? "Magical Math Master! 🏰✨" : "Great Practice! 🏰",
      bodyHTML: `<p class="text-center">You got <strong>${correctCount}/${TOTAL_QUESTIONS}</strong> correct (${accuracy}% accuracy). The castle grows brighter with your magic!</p>`,
      dismissible: false,
      actions: [
        { label: "Back to Village", variant: "success", onClick: () => goBack("village") },
        { label: "Play Again", variant: "purple", onClick: () => render(container, { goBack }) },
      ],
    });
    finishRoundReward(accuracy);
  }

  async function finishRoundReward(accuracy) {
    const bonusStars = accuracy >= 80 ? 3 : accuracy >= 50 ? 1 : 0;
    await award(profile.id, { stars: bonusStars, rollChest: accuracy >= 70, chestChance: 0.35 });
  }

  runRound();

  return () => { cancelled = true; };
}

export default { render, isLearning };
