/**
 * Achievement catalog. Each entry defines how to read progress from a profile
 * and a target value; `checkAchievements` unlocks any that just crossed target.
 */
export const ACHIEVEMENTS = [
  { id: "first_steps", name: "First Steps", icon: "👣", desc: "Play your first activity", target: 1, read: (p) => Object.values(p.education.topics).reduce((s, t) => s + t.attempts, 0) },
  { id: "math_whiz_10", name: "Math Whiz", icon: "➕", desc: "Answer 10 math questions correctly", target: 10, read: (p) => sumTopicPrefix(p, "math", "correct") },
  { id: "math_whiz_100", name: "Math Master", icon: "🧮", desc: "Answer 100 math questions correctly", target: 100, read: (p) => sumTopicPrefix(p, "math", "correct") },
  { id: "wordsmith_10", name: "Wordsmith", icon: "📖", desc: "Learn 10 new words", target: 10, read: (p) => p.stats.wordsLearned },
  { id: "wordsmith_50", name: "Word Wizard", icon: "🪄", desc: "Learn 50 new words", target: 50, read: (p) => p.stats.wordsLearned },
  { id: "bookworm_5", name: "Bookworm", icon: "🐛", desc: "Finish 5 stories", target: 5, read: (p) => p.stats.booksRead },
  { id: "fast_fingers_20", name: "Fast Fingers", icon: "⌨️", desc: "Reach 20 WPM typing", target: 20, read: (p) => p.stats.typingBestWpm },
  { id: "memory_master", name: "Memory Master", icon: "🧠", desc: "Win 5 memory rounds", target: 5, read: (p) => p.stats.memoryWins || 0 },
  { id: "streak_3", name: "Getting Started", icon: "🔥", desc: "3-day play streak", target: 3, read: (p) => p.quests.daily.streak },
  { id: "streak_7", name: "Week of Wonder", icon: "🌟", desc: "7-day play streak", target: 7, read: (p) => p.quests.daily.streak },
  { id: "pet_lover", name: "Pet Lover", icon: "🐾", desc: "Adopt your first pet", target: 1, read: (p) => p.pets.owned.length },
  { id: "pet_family", name: "Pet Family", icon: "🐶", desc: "Adopt 3 pets", target: 3, read: (p) => p.pets.owned.length },
  { id: "decorator", name: "Decorator", icon: "🛋️", desc: "Place your first piece of furniture", target: 1, read: (p) => countPlacedFurniture(p) },
  { id: "dream_home", name: "Dream Home", icon: "🏡", desc: "Place 15 pieces of furniture", target: 15, read: (p) => countPlacedFurniture(p) },
  { id: "fashionista", name: "Fashionista", icon: "👗", desc: "Own 10 wardrobe items", target: 10, read: (p) => p.wardrobe.owned.length },
  { id: "level_5", name: "Rising Star", icon: "⭐", desc: "Reach level 5", target: 5, read: (p) => p.level },
  { id: "level_10", name: "Village Hero", icon: "👑", desc: "Reach level 10", target: 10, read: (p) => p.level },
  { id: "coin_collector", name: "Coin Collector", icon: "🪙", desc: "Earn 500 coins total", target: 500, read: (p) => p.stats.totalCoinsEarned || 0 },
  { id: "treasure_hunter", name: "Treasure Hunter", icon: "🎁", desc: "Open your first mystery chest", target: 1, read: (p) => p.stats.chestsOpened || 0 },
];

function sumTopicPrefix(profile, prefix, field) {
  return Object.entries(profile.education.topics)
    .filter(([key]) => key.startsWith(prefix))
    .reduce((sum, [, t]) => sum + (t[field] || 0), 0);
}

function countPlacedFurniture(profile) {
  return Object.values(profile.house.rooms).reduce((sum, r) => sum + r.placed.length, 0);
}

/** Returns array of newly-unlocked achievement objects (mutates draft profile). */
export function checkAchievements(draft) {
  const unlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (draft.achievements.unlocked.includes(ach.id)) continue;
    const value = ach.read(draft);
    draft.achievements.progress[ach.id] = value;
    if (value >= ach.target) {
      draft.achievements.unlocked.push(ach.id);
      unlocked.push(ach);
    }
  }
  return unlocked;
}

export default { ACHIEVEMENTS, checkAchievements };
