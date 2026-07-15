/**
 * Data-only avatar catalog. The renderer (avatarRenderer.js) turns these
 * ids into a layered inline-SVG "chibi" doll — no external art assets needed,
 * so avatars work fully offline from the first load.
 */
export const SKIN_TONES = [
  { id: "porcelain", color: "#ffe0c7" },
  { id: "peach", color: "#ffcda3" },
  { id: "tan", color: "#e0a878" },
  { id: "deep", color: "#a56a42" },
];

export const HAIR_COLORS = [
  { id: "brown", color: "#8a5a3b" },
  { id: "black", color: "#2e2430" },
  { id: "blonde", color: "#f0c85e" },
  { id: "red", color: "#d3673f" },
  { id: "pink", color: "#ff8fc0" },
  { id: "blue", color: "#6fb8e8" },
  { id: "purple", color: "#b48cff" },
];

export const HAIR_STYLES = [
  { id: "twin-tails", label: "Twin Tails", unlockLevel: 0 },
  { id: "pigtails", label: "Pigtails", unlockLevel: 0 },
  { id: "ponytail", label: "Ponytail", unlockLevel: 0 },
  { id: "curly-bun", label: "Curly Bun", unlockLevel: 0 },
  { id: "short-bob", label: "Short Bob", unlockLevel: 2 },
  { id: "long-wavy", label: "Long Wavy", unlockLevel: 4 },
  { id: "braid-crown", label: "Braid Crown", unlockLevel: 6 },
];

export const EYE_STYLES = [
  { id: "round", label: "Round" },
  { id: "sparkle", label: "Sparkle" },
  { id: "happy", label: "Happy Curve" },
];

export const OUTFITS = [
  { id: "sundress", label: "Sundress", color: "#ff9ecb", unlockLevel: 0 },
  { id: "overalls", label: "Overalls", color: "#7fd8ff", unlockLevel: 0 },
  { id: "romper", label: "Romper", color: "#ffd166", unlockLevel: 0 },
  { id: "hoodie-skirt", label: "Hoodie & Skirt", color: "#b48cff", unlockLevel: 0 },
  { id: "fairy-gown", label: "Fairy Gown", color: "#f6c9ff", unlockLevel: 3, rarity: "rare" },
  { id: "explorer-vest", label: "Explorer Vest", color: "#a3d977", unlockLevel: 3, rarity: "rare" },
  { id: "starlight-dress", label: "Starlight Dress", color: "#5b6bd8", unlockLevel: 8, rarity: "legendary" },
  { id: "royal-gown", label: "Royal Gown", color: "#e85ba0", unlockLevel: 10, rarity: "legendary" },
];

export const SHOES = [
  { id: "sneakers", label: "Sneakers", color: "#ffffff", unlockLevel: 0 },
  { id: "sandals", label: "Sandals", color: "#ffd166", unlockLevel: 0 },
  { id: "boots", label: "Boots", color: "#8a5a3b", unlockLevel: 2 },
  { id: "glass-slippers", label: "Glass Slippers", color: "#cdeeff", unlockLevel: 6, rarity: "rare" },
];

export const HATS = [
  { id: null, label: "None" },
  { id: "sunhat", label: "Sun Hat", emoji: "👒", unlockLevel: 0 },
  { id: "bow", label: "Bow", emoji: "🎀", unlockLevel: 0 },
  { id: "crown", label: "Crown", emoji: "👑", unlockLevel: 5, rarity: "rare" },
  { id: "wizard-hat", label: "Wizard Hat", emoji: "🎩", unlockLevel: 7, rarity: "rare" },
  { id: "flower-crown", label: "Flower Crown", emoji: "🌸", unlockLevel: 3 },
];

export const GLASSES = [
  { id: null, label: "None" },
  { id: "round-glasses", label: "Round Glasses", emoji: "👓", unlockLevel: 0 },
  { id: "star-glasses", label: "Star Glasses", emoji: "🕶️", unlockLevel: 4, rarity: "rare" },
];

export const BAGS = [
  { id: null, label: "None" },
  { id: "backpack", label: "Backpack", emoji: "🎒", unlockLevel: 0 },
  { id: "purse", label: "Purse", emoji: "👜", unlockLevel: 2 },
];

export const ACCESSORIES = [
  { id: "necklace", label: "Necklace", emoji: "📿", unlockLevel: 2 },
  { id: "wings", label: "Fairy Wings", emoji: "🦋", unlockLevel: 5, rarity: "rare" },
  { id: "wand", label: "Magic Wand", emoji: "🪄", unlockLevel: 5, rarity: "rare" },
];

export const AVATAR_CATEGORIES = [
  { key: "skin", label: "Skin", options: SKIN_TONES, multi: false },
  { key: "hairStyle", label: "Hair Style", options: HAIR_STYLES, multi: false },
  { key: "hairColor", label: "Hair Color", options: HAIR_COLORS, multi: false },
  { key: "eyes", label: "Eyes", options: EYE_STYLES, multi: false },
  { key: "outfit", label: "Outfit", options: OUTFITS, multi: false },
  { key: "shoes", label: "Shoes", options: SHOES, multi: false },
  { key: "hat", label: "Hat", options: HATS, multi: false },
  { key: "glasses", label: "Glasses", options: GLASSES, multi: false },
  { key: "bag", label: "Bag", options: BAGS, multi: false },
  { key: "accessories", label: "Accessories", options: ACCESSORIES, multi: true },
];

/** Every unlockable (non-starter) item across all categories, for reward chests. */
export function allUnlockableAvatarItems() {
  const items = [];
  for (const cat of AVATAR_CATEGORIES) {
    for (const opt of cat.options) {
      if (opt.id && (opt.unlockLevel || 0) > 0) {
        items.push({ category: cat.key, ...opt });
      }
    }
  }
  return items;
}
