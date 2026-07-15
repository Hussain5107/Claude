import { mutateProfile } from "../core/profileManager.js";
import { emit } from "../core/eventBus.js";
import { levelFromXp } from "../core/progression.js";
import { checkAchievements } from "./achievements.js";
import { progressQuest } from "./dailyQuests.js";
import { boostAllPets } from "../pets/petManager.js";
import { allUnlockableAvatarItems } from "../avatar/avatarCatalog.js";
import { HOUSE_ITEMS } from "../house/houseCatalog.js";
import { ROOMS } from "../house/houseCatalog.js";

const BUILDING_UNLOCKS = {
  2: ["boutique"],
  3: ["petHouse"],
};

/**
 * Central reward funnel. Every mini-game/quest routes through here so
 * currency, XP, achievements, quests and pet happiness always stay in sync.
 *
 * @param {string} profileId
 * @param {object} opts
 * @param {number} [opts.coins]
 * @param {number} [opts.stars]
 * @param {number} [opts.diamonds]
 * @param {number} [opts.xp]
 * @param {string} [opts.questType] one of 'math'|'typing'|'reading'|'puzzle'|'decorate'
 * @param {number} [opts.questAmount]
 * @param {boolean} [opts.rollChest] chance to award a bonus item
 * @param {number} [opts.chestChance] 0..1
 * @param {(draft:object)=>void} [opts.mutate] extra logic (e.g. adaptive engine
 *   recordAnswer) to run inside the same atomic profile mutation.
 */
export async function award(profileId, opts = {}) {
  const { coins = 0, stars = 0, diamonds = 0, xp = 0, questType, questAmount = 1, rollChest = false, chestChance = 0.15, mutate } = opts;

  let result = { coins, stars, diamonds, xp, leveledUp: false, newLevel: null, unlockedBuildings: [], unlockedRooms: [], achievements: [], questCompleted: false, chestItem: null };

  const profile = await mutateProfile(profileId, (draft) => {
    mutate?.(draft);
    draft.currency.coins += coins;
    draft.currency.stars += stars;
    draft.currency.diamonds += diamonds;
    draft.stats.totalCoinsEarned = (draft.stats.totalCoinsEarned || 0) + Math.max(0, coins);

    const before = levelFromXp(draft.xp);
    draft.xp += xp;
    const after = levelFromXp(draft.xp);
    draft.level = after.level;

    if (after.level > before.level) {
      result.leveledUp = true;
      result.newLevel = after.level;
      for (let lvl = before.level + 1; lvl <= after.level; lvl++) {
        (BUILDING_UNLOCKS[lvl] || []).forEach((b) => {
          if (!draft.unlockedBuildings.includes(b)) {
            draft.unlockedBuildings.push(b);
            result.unlockedBuildings.push(b);
          }
        });
        ROOMS.forEach((room) => {
          if (room.unlockLevel === lvl && !draft.house.unlockedRooms.includes(room.id)) {
            draft.house.unlockedRooms.push(room.id);
            result.unlockedRooms.push(room);
          }
        });
      }
      draft.currency.diamonds += 1; // small level-up bonus
    }

    if (questType) {
      const { completedTasks, questSetCompleted } = progressQuest(draft, questType, questAmount);
      if (questSetCompleted) {
        result.questCompleted = true;
        draft.currency.coins += 20;
        draft.currency.stars += 3;
      }
      completedTasks.forEach((t) => {
        draft.currency.coins += t.reward.coins || 0;
        draft.currency.stars += t.reward.stars || 0;
      });
    }

    if (rollChest && Math.random() < chestChance) {
      const pool = [
        ...allUnlockableAvatarItems().filter((it) => it.unlockLevel <= draft.level && !draft.wardrobe.owned.includes(it.id)),
        ...HOUSE_ITEMS.filter((it) => it.unlockLevel <= draft.level),
      ];
      if (pool.length) {
        const picked = pool[Math.floor(Math.random() * pool.length)];
        result.chestItem = picked;
        draft.stats.chestsOpened = (draft.stats.chestsOpened || 0) + 1;
        if (picked.category) {
          if (!draft.wardrobe.owned.includes(picked.id)) draft.wardrobe.owned.push(picked.id);
        } else {
          draft.house.rooms.bedroom.placed.push({ itemId: picked.id, x: 40, y: 40, rotation: 0, scale: 1, layer: draft.house.rooms.bedroom.placed.length });
        }
      }
    }

    boostAllPets(draft, 3);

    const newlyUnlocked = checkAchievements(draft);
    result.achievements = newlyUnlocked;
  });

  emit("reward:earned", { profileId, profile, ...result });
  if (result.leveledUp) emit("profile:levelup", { profileId, profile, newLevel: result.newLevel, unlockedBuildings: result.unlockedBuildings, unlockedRooms: result.unlockedRooms });
  result.achievements.forEach((a) => emit("achievement:unlocked", { profileId, achievement: a }));
  if (result.questCompleted) emit("quest:completed", { profileId });

  return { profile, ...result };
}

/** Spend currency on a shop/catalog item. Returns { ok, profile, reason }. */
export async function spend(profileId, { coins = 0, stars = 0, diamonds = 0 }) {
  let ok = true;
  let reason = null;
  const profile = await mutateProfile(profileId, (draft) => {
    if (draft.currency.coins < coins || draft.currency.stars < stars || draft.currency.diamonds < diamonds) {
      ok = false;
      reason = "not-enough-currency";
      return;
    }
    draft.currency.coins -= coins;
    draft.currency.stars -= stars;
    draft.currency.diamonds -= diamonds;
  });
  return { ok, reason, profile };
}

export default { award, spend };
