import { readJSON, writeJSON, remove as removeKey } from "../storage/storageManager.js";
import { emit } from "./eventBus.js";
import { ageGroupFor } from "./progression.js";

const SCHEMA_VERSION = 1;
const FAMILY_KEY = "family";
const profileKey = (id) => `profile:${id}`;

let familyCache = null;
const profileCache = new Map();

function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultAvatarFor(ageGroup) {
  const base = { skin: "peach", hairStyle: "twin-tails", hairColor: "brown", eyes: "round", outfit: "sundress", shoes: "sneakers", hat: null, glasses: null, bag: null, accessories: [] };
  if (ageGroup === "12") return { ...base, hairStyle: "ponytail", outfit: "hoodie-skirt" };
  if (ageGroup === "7") return { ...base, hairStyle: "pigtails", outfit: "overalls" };
  return { ...base, hairStyle: "curly-bun", outfit: "romper" };
}

export function createProfileData({ name, age, avatarSeed }) {
  const ageGroup = ageGroupFor(age);
  return {
    schemaVersion: SCHEMA_VERSION,
    id: uid(),
    name,
    age,
    ageGroup,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    currency: { coins: 25, stars: 3, diamonds: 0 },
    xp: 0,
    level: 1,
    avatar: avatarSeed || defaultAvatarFor(ageGroup),
    wardrobe: { owned: [], equipped: {} },
    house: {
      rooms: { bedroom: { wallpaper: "wp-clouds", flooring: "fl-wood", placed: [] } },
      unlockedRooms: ["bedroom"],
    },
    pets: { owned: [], activePetId: null },
    achievements: { unlocked: [], progress: {} },
    quests: {
      daily: { date: null, tasks: [], completed: false, streak: 0, lastCompletedDate: null },
      weekly: { weekKey: null, tasks: [], completed: false },
    },
    education: { topics: {} },
    stats: {
      totalPlayMs: 0,
      learningMs: 0,
      sessionsByDay: {},
      typingBestWpm: 0,
      typingBestAccuracy: 0,
      booksRead: 0,
      wordsLearned: 0,
    },
    settings: {
      sound: true,
      music: true,
      voice: ageGroup === "5",
      highContrast: false,
      largeText: ageGroup === "5",
      reducedMotion: false,
    },
    unlockedBuildings: ["mathCastle", "wordForest", "typingCafe", "magicLibrary", "treasureCave", "home", "petHouse"],
  };
}

async function loadFamily() {
  if (familyCache) return familyCache;
  familyCache = await readJSON(FAMILY_KEY, { pinHash: null, profileIds: [], createdAt: new Date().toISOString() });
  return familyCache;
}

async function saveFamily() {
  await writeJSON(FAMILY_KEY, familyCache);
}

export async function listProfiles() {
  const family = await loadFamily();
  const profiles = [];
  for (const id of family.profileIds) {
    const p = await loadProfile(id);
    if (p) profiles.push(p);
  }
  return profiles;
}

export async function loadProfile(id) {
  if (profileCache.has(id)) return profileCache.get(id);
  const data = await readJSON(profileKey(id));
  if (data) profileCache.set(id, data);
  return data;
}

export async function createProfile({ name, age }) {
  const family = await loadFamily();
  const data = createProfileData({ name, age });
  profileCache.set(data.id, data);
  await writeJSON(profileKey(data.id), data);
  family.profileIds.push(data.id);
  await saveFamily();
  emit("family:changed", family);
  return data;
}

export async function deleteProfile(id) {
  const family = await loadFamily();
  family.profileIds = family.profileIds.filter((pid) => pid !== id);
  await saveFamily();
  await removeKey(profileKey(id));
  profileCache.delete(id);
  emit("family:changed", family);
}

/**
 * The single write path into profile data. `recipe(draft) => void | draft`
 * mutates (or returns a replacement for) the profile; the result is persisted
 * and broadcast so every screen stays in sync.
 */
export async function mutateProfile(id, recipe) {
  const current = await loadProfile(id);
  if (!current) throw new Error(`No profile with id ${id}`);
  const draft = JSON.parse(JSON.stringify(current));
  const replacement = recipe(draft);
  const next = replacement || draft;
  next.lastPlayedAt = new Date().toISOString();
  profileCache.set(id, next);
  await writeJSON(profileKey(id), next);
  emit("profile:changed", next);
  return next;
}

export function trackSessionTime(id, ms, { learning = false } = {}) {
  return mutateProfile(id, (p) => {
    p.stats.totalPlayMs += ms;
    if (learning) p.stats.learningMs += ms;
    const day = todayKey();
    p.stats.sessionsByDay[day] = (p.stats.sessionsByDay[day] || 0) + ms;
  });
}

export async function setFamilyPin(pin) {
  const family = await loadFamily();
  family.pinHash = await hashPin(pin);
  await saveFamily();
}

export async function verifyFamilyPin(pin) {
  const family = await loadFamily();
  if (!family.pinHash) return true; // no PIN set yet — first run
  return (await hashPin(pin)) === family.pinHash;
}

export async function hasFamilyPin() {
  const family = await loadFamily();
  return !!family.pinHash;
}

/** Deterrent-only hash (this is a kids' app, not a security boundary). */
async function hashPin(pin) {
  const enc = new TextEncoder().encode(`dreamtown-salt-${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const profileManager = {
  listProfiles,
  loadProfile,
  createProfile,
  deleteProfile,
  mutateProfile,
  trackSessionTime,
  setFamilyPin,
  verifyFamilyPin,
  hasFamilyPin,
};
export default profileManager;
