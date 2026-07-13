import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { CACHE_DIR } from "./paths.js";

export interface StockClip {
  provider: "pexels" | "pixabay";
  id: string;
  keyword: string;
  downloadUrl: string;
  previewUrl?: string;
  width: number;
  height: number;
  durationSeconds: number;
}

const USED_CLIPS_LEDGER = path.join(CACHE_DIR, "stock-footage", "used-clips.json");

interface UsedClipsLedger {
  // clip key ("provider:id") -> array of video slugs that have used it
  [clipKey: string]: string[];
}

function loadLedger(): UsedClipsLedger {
  if (!fs.existsSync(USED_CLIPS_LEDGER)) return {};
  return JSON.parse(fs.readFileSync(USED_CLIPS_LEDGER, "utf-8"));
}

function saveLedger(ledger: UsedClipsLedger): void {
  fs.mkdirSync(path.dirname(USED_CLIPS_LEDGER), { recursive: true });
  fs.writeFileSync(USED_CLIPS_LEDGER, JSON.stringify(ledger, null, 2));
}

export function markClipsUsed(clips: StockClip[], slug: string): void {
  const ledger = loadLedger();
  for (const clip of clips) {
    const key = `${clip.provider}:${clip.id}`;
    ledger[key] = ledger[key] ? [...new Set([...ledger[key], slug])] : [slug];
  }
  saveLedger(ledger);
}

function timesUsed(clip: StockClip, ledger: UsedClipsLedger): number {
  return ledger[`${clip.provider}:${clip.id}`]?.length ?? 0;
}

async function searchPexelsVideos(keyword: string, perPage = 15): Promise<StockClip[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return [];
  const { data } = await axios.get("https://api.pexels.com/videos/search", {
    headers: { Authorization: apiKey },
    params: { query: keyword, per_page: perPage, orientation: "portrait" },
    timeout: 30_000,
  });
  return (data.videos ?? []).map((v: any): StockClip => {
    const bestFile =
      v.video_files
        .filter((f: any) => f.file_type === "video/mp4")
        .sort((a: any, b: any) => (b.height ?? 0) - (a.height ?? 0))[0] ?? v.video_files[0];
    return {
      provider: "pexels",
      id: String(v.id),
      keyword,
      downloadUrl: bestFile.link,
      previewUrl: v.image,
      width: bestFile.width ?? v.width,
      height: bestFile.height ?? v.height,
      durationSeconds: v.duration ?? 0,
    };
  });
}

async function searchPixabayVideos(keyword: string, perPage = 15): Promise<StockClip[]> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return [];
  const { data } = await axios.get("https://pixabay.com/api/videos/", {
    params: { key: apiKey, q: keyword, per_page: Math.max(perPage, 3) },
    timeout: 30_000,
  });
  return (data.hits ?? []).map((v: any): StockClip => {
    const best = v.videos.large?.url ? v.videos.large : v.videos.medium ?? v.videos.small;
    return {
      provider: "pixabay",
      id: String(v.id),
      keyword,
      downloadUrl: best.url,
      previewUrl: v.userImageURL,
      width: best.width ?? 0,
      height: best.height ?? 0,
      durationSeconds: v.duration ?? 0,
    };
  });
}

/**
 * Searches all configured providers for a keyword and returns clips sorted so
 * that clips never used before (across the whole channel) come first. This is
 * what keeps successive videos from recycling the same 3 loops, which is the
 * "reused content" flag this pipeline is designed to avoid.
 */
export async function findFreshClips(
  keyword: string,
  count: number
): Promise<StockClip[]> {
  const [pexels, pixabay] = await Promise.all([
    searchPexelsVideos(keyword),
    searchPixabayVideos(keyword),
  ]);
  const ledger = loadLedger();
  const all = [...pexels, ...pixabay].filter((c) => c.durationSeconds === 0 || c.durationSeconds >= 6);
  all.sort((a, b) => timesUsed(a, ledger) - timesUsed(b, ledger));
  return all.slice(0, count);
}

export async function downloadClip(clip: StockClip, destDir: string): Promise<string> {
  fs.mkdirSync(destDir, { recursive: true });
  const ext = path.extname(new URL(clip.downloadUrl).pathname) || ".mp4";
  const destPath = path.join(destDir, `${clip.provider}-${clip.id}${ext}`);
  if (fs.existsSync(destPath)) return destPath;
  const response = await axios.get(clip.downloadUrl, {
    responseType: "arraybuffer",
    timeout: 120_000,
  });
  fs.writeFileSync(destPath, Buffer.from(response.data));
  return destPath;
}
