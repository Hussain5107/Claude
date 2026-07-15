import { findPet } from "./petData.js";

const MAX_HAPPINESS = 100;
const DAILY_DECAY = 8;

function uid() {
  return `pet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Adopts a pet into the draft profile. Caller must already have deducted currency. */
export function adoptPet(draft, petId, name) {
  const catalogPet = findPet(petId);
  if (!catalogPet) throw new Error(`Unknown pet ${petId}`);
  const owned = { id: uid(), petId, name: name || catalogPet.label, happiness: 80, level: 1, adoptedAt: new Date().toISOString(), lastInteractedAt: new Date().toISOString() };
  draft.pets.owned.push(owned);
  if (!draft.pets.activePetId) draft.pets.activePetId = owned.id;
  return owned;
}

/** Call once per profile load to apply idle happiness decay since last visit. */
export function applyHappinessDecay(draft) {
  const now = Date.now();
  for (const p of draft.pets.owned) {
    const last = new Date(p.lastInteractedAt || p.adoptedAt).getTime();
    const daysSince = Math.floor((now - last) / 86400000);
    if (daysSince > 0) {
      p.happiness = Math.max(10, p.happiness - daysSince * DAILY_DECAY);
      p.lastInteractedAt = new Date().toISOString();
    }
  }
}

export function feedPet(draft, ownedPetId, amount = 15) {
  const p = draft.pets.owned.find((x) => x.id === ownedPetId);
  if (!p) return null;
  p.happiness = Math.min(MAX_HAPPINESS, p.happiness + amount);
  p.lastInteractedAt = new Date().toISOString();
  if (p.happiness >= MAX_HAPPINESS && p.level < 5) {
    p.level += 1;
    p.happiness = 70;
  }
  return p;
}

/** Boost all active/owned pets slightly whenever the child completes learning — the emotional payoff loop. */
export function boostAllPets(draft, amount = 4) {
  for (const p of draft.pets.owned) {
    p.happiness = Math.min(MAX_HAPPINESS, p.happiness + amount);
    p.lastInteractedAt = new Date().toISOString();
  }
}

export function moodFor(happiness) {
  if (happiness >= 80) return { label: "Ecstatic", emoji: "💖" };
  if (happiness >= 55) return { label: "Happy", emoji: "🙂" };
  if (happiness >= 30) return { label: "Okay", emoji: "😐" };
  return { label: "Needs love", emoji: "🥺" };
}

export default { adoptPet, applyHappinessDecay, feedPet, boostAllPets, moodFor };
