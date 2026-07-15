import { readJSON, writeJSON, keysWithPrefix } from "./storageManager.js";

/** Export every family/profile record into one downloadable JSON backup. */
export async function exportBackup() {
  const family = await readJSON("family", null);
  const profileKeys = (await keysWithPrefix("profile:"));
  const profiles = {};
  for (const key of profileKeys) {
    profiles[key] = await readJSON(key);
  }
  const payload = { app: "dreamtown", exportedAt: new Date().toISOString(), family, profiles };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dream-town-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return payload;
}

/** Restore a previously exported backup file (merges/overwrites by id). */
export async function importBackup(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (payload.app !== "dreamtown") throw new Error("Not a Dream Town backup file.");
  if (payload.family) await writeJSON("family", payload.family);
  for (const [key, value] of Object.entries(payload.profiles || {})) {
    await writeJSON(key, value);
  }
  return true;
}

export default { exportBackup, importBackup };
