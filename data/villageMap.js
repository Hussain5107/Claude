/**
 * Village map data — one entry per building tile. `scene` buildings are
 * playable now (Phase 1); `comingSoon` buildings render as friendly locked
 * tiles and are already planned in docs/ARCHITECTURE.md §11 (Phase 2+).
 */
export const VILLAGE_BUILDINGS = [
  { id: "mathCastle", name: "Math Castle", icon: "🏰", scene: "mathCastle", subject: "Mathematics" },
  { id: "wordForest", name: "Word Forest", icon: "🌳", scene: "wordForest", subject: "Vocabulary" },
  { id: "typingCafe", name: "Typing Cafe", icon: "☕", scene: "typingCafe", subject: "Typing" },
  { id: "magicLibrary", name: "Magic Library", icon: "📚", scene: "magicLibrary", subject: "Reading" },
  { id: "treasureCave", name: "Treasure Cave", icon: "🕳️", scene: "treasureCave", subject: "Memory & Logic" },
  { id: "home", name: "My Home", icon: "🏠", scene: "houseEditor", subject: "Decorate" },
  { id: "petHouse", name: "Pet House", icon: "🐾", scene: "petHouse", subject: "Pets" },
  { id: "boutique", name: "Fashion Boutique", icon: "💃", scene: "avatarEditor", subject: "Avatar", requiresBuilding: "boutique" },

  { id: "school", name: "School", icon: "🏫", comingSoon: true },
  { id: "bakery", name: "Bakery", icon: "🍰", comingSoon: true },
  { id: "garden", name: "Garden", icon: "🌷", comingSoon: true },
  { id: "scienceLab", name: "Science Lab", icon: "🔬", comingSoon: true },
  { id: "musicHall", name: "Music Hall", icon: "🎵", comingSoon: true },
  { id: "homeDecor", name: "Home Decoration Store", icon: "🪑", comingSoon: true },
  { id: "beautySalon", name: "Beauty Salon", icon: "💅", comingSoon: true },
  { id: "artStudio", name: "Art Studio", icon: "🎨", comingSoon: true },
  { id: "animalFarm", name: "Animal Farm", icon: "🐄", comingSoon: true },
  { id: "adventureIsland", name: "Adventure Island", icon: "🏝️", comingSoon: true },
];

export function buildingsFor(profile) {
  return VILLAGE_BUILDINGS.map((b) => ({
    ...b,
    locked: !b.comingSoon && b.requiresBuilding ? !profile.unlockedBuildings.includes(b.requiresBuilding) : false,
  }));
}
