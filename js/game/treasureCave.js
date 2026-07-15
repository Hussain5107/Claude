import { getActiveProfile } from "../core/gameState.js";
import { hudHTML, wireHud, updateHudCurrency } from "../ui/hud.js";
import { award } from "../rewards/rewardEngine.js";
import { getDifficulty, recordAnswer } from "../education/adaptiveEngine.js";
import { generateMemoryDeck, gridColumnsFor } from "../education/memoryGenerator.js";
import { openModal } from "../ui/modal.js";
import { loadProfile } from "../core/profileManager.js";
import { sfx } from "../core/audioManager.js";

export const isLearning = true;

export async function render(container, { goBack }) {
  const profile = await getActiveProfile();
  if (!profile) { goBack("profileSelect"); return () => {}; }

  const difficulty = getDifficulty(profile, "logic.memory");
  const deck = generateMemoryDeck(profile.ageGroup, difficulty);
  const columns = gridColumnsFor(deck.length);

  container.innerHTML = `
    <div class="screen minigame">
      ${hudHTML(profile, { showBack: true, title: "🕳️ Treasure Cave" })}
      <div class="minigame-stage">
        <div class="row-wrap center">
          <span class="chip">Pairs found <span id="tv-found">0</span>/${deck.length / 2}</span>
          <span class="chip">Moves <span id="tv-moves">0</span></span>
        </div>
        <div class="memory-grid" id="tv-grid" style="grid-template-columns:repeat(${columns}, minmax(60px,1fr))"></div>
      </div>
    </div>`;
  wireHud(container, { profile, onBack: () => goBack("village") });

  const grid = container.querySelector("#tv-grid");
  let cancelled = false;
  let flipped = [];
  let matchedCount = 0;
  let moves = 0;
  let locked = false;

  function renderCard(card) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `memory-card${card.flipped ? " is-flipped" : ""}${card.matched ? " is-matched" : ""}`;
    el.setAttribute("aria-label", card.flipped || card.matched ? `Card showing ${card.symbol}` : "Hidden card");
    el.innerHTML = `<span class="memory-card__face">${card.flipped || card.matched ? card.symbol : "❓"}</span>`;
    el.disabled = card.matched;
    el.addEventListener("click", () => onCardClick(card, el));
    return el;
  }

  function draw() {
    grid.innerHTML = "";
    deck.forEach((card) => grid.appendChild(renderCard(card)));
  }

  async function onCardClick(card, el) {
    if (locked || card.flipped || card.matched || cancelled) return;
    card.flipped = true;
    sfx.pop();
    draw();
    flipped.push(card);
    if (flipped.length === 2) {
      locked = true;
      moves += 1;
      container.querySelector("#tv-moves").textContent = moves;
      const [a, b] = flipped;
      const isMatch = a.symbol === b.symbol;
      const fresh = await loadProfile(profile.id);
      const topicKey = "logic.memory";
      setTimeout(async () => {
        if (cancelled) return;
        if (isMatch) {
          a.matched = true; b.matched = true;
          matchedCount += 1;
          container.querySelector("#tv-found").textContent = matchedCount;
          sfx.correct();
        } else {
          a.flipped = false; b.flipped = false;
          sfx.wrong();
        }
        flipped = [];
        locked = false;
        draw();

        await award(profile.id, {
          coins: isMatch ? 3 : 0,
          xp: isMatch ? 5 : 1,
          questType: "puzzle",
          questAmount: isMatch ? 1 : 0,
          mutate: (draft) => recordAnswer(draft, topicKey, { correct: isMatch, timeMs: 0 }),
        });
        updateHudCurrency(container, await loadProfile(profile.id));

        if (matchedCount === deck.length / 2) finish();
      }, isMatch ? 450 : 750);
    }
  }

  async function finish() {
    const efficiency = (deck.length / 2) / moves;
    const stars = efficiency >= 0.7 ? 3 : efficiency >= 0.4 ? 2 : 1;
    await award(profile.id, {
      stars,
      rollChest: efficiency >= 0.5,
      chestChance: 0.4,
      mutate: (draft) => { draft.stats.memoryWins = (draft.stats.memoryWins || 0) + 1; },
    });
    openModal({
      title: "Treasure Found! 🏆",
      bodyHTML: `<p class="text-center">You matched all pairs in <strong>${moves}</strong> moves!</p>`,
      dismissible: false,
      actions: [
        { label: "Back to Village", variant: "success", onClick: () => goBack("village") },
        { label: "Play Again", variant: "purple", onClick: () => render(container, { goBack }) },
      ],
    });
  }

  draw();
  return () => { cancelled = true; };
}

export default { render, isLearning };
