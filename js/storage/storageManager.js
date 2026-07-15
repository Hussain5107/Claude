/**
 * Low-level storage adapter. Wraps localStorage today; the async interface
 * means we can swap in an IndexedDB or remote adapter later (see Phase 4 in
 * docs/ARCHITECTURE.md) without touching any calling code.
 */
const PREFIX = "dreamtown:";

function keyFor(name) {
  return `${PREFIX}${name}`;
}

export async function readJSON(name, fallback = null) {
  try {
    const raw = localStorage.getItem(keyFor(name));
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[storage] failed to read "${name}"`, err);
    return fallback;
  }
}

export async function writeJSON(name, value) {
  try {
    localStorage.setItem(keyFor(name), JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[storage] failed to write "${name}"`, err);
    return false;
  }
}

export async function remove(name) {
  localStorage.removeItem(keyFor(name));
}

export async function keysWithPrefix(prefix) {
  const full = keyFor(prefix);
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(full)) out.push(k.slice(PREFIX.length));
  }
  return out;
}

/** Rough byte-size estimate, used to warn before autosave on very old devices. */
export function estimateUsageBytes() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) {
      total += (k.length + (localStorage.getItem(k) || "").length) * 2;
    }
  }
  return total;
}

export const storageManager = { readJSON, writeJSON, remove, keysWithPrefix, estimateUsageBytes };
export default storageManager;
