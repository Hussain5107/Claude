import { on } from "../core/eventBus.js";
import { flyCurrency, confettiBurst, showCelebration, sparkleAt } from "./rewardPopup.js";
import { showToast } from "./toast.js";
import { sfx } from "../core/audioManager.js";
import { getActiveProfileId } from "../core/gameState.js";

let installed = false;

/** Wires reward/achievement/level-up events to their visual+audio celebration. Call once. */
export function installRewardListener() {
  if (installed) return;
  installed = true;

  on("reward:earned", ({ profileId, coins, stars, sourceEl }) => {
    if (profileId !== getActiveProfileId()) return;
    if (coins > 0) flyCurrency({ fromEl: sourceEl, count: Math.min(5, coins), icon: "🪙" });
    if (stars > 0) {
      sfx.star();
      if (sourceEl) sparkleAt(sourceEl);
    }
  });

  on("profile:levelup", ({ profileId, newLevel, unlockedBuildings, unlockedRooms }) => {
    if (profileId !== getActiveProfileId()) return;
    const unlockedNote = [...unlockedBuildings, ...unlockedRooms.map((r) => r.label)];
    showCelebration({
      emoji: "🎉",
      title: `Level ${newLevel}!`,
      subtitle: unlockedNote.length ? `You unlocked: ${unlockedNote.join(", ")}!` : "The whole town is proud of you!",
    });
  });

  on("achievement:unlocked", ({ profileId, achievement }) => {
    if (profileId !== getActiveProfileId()) return;
    showToast(`Achievement unlocked: ${achievement.name}!`, { icon: achievement.icon, duration: 3200 });
  });

  on("quest:completed", () => {
    confettiBurst({ count: 30 });
    showToast("Daily Quests complete! Bonus chest earned!", { icon: "📦" });
  });
}

export default { installRewardListener };
