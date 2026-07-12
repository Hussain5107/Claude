import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import FormData from "form-data";
import type { PipelineConfig } from "./config.js";

interface ZahraVoice {
  id: number;
  name: string;
  default_exaggeration?: number;
  default_cfg_weight?: number;
  default_language?: string;
}

interface ZahraJobStatus {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  chunks_done: number;
  chunks_total: number;
  error: string | null;
  has_captions: boolean;
}

/**
 * Looks up a cloned voice by name against a running Zahra Studio instance.
 * Resolve this once per pipeline run and reuse the numeric id — the API
 * takes voice_id (int), not the name, on /generate-speech.
 */
export async function resolveVoiceId(baseUrl: string, voiceName: string): Promise<number> {
  if (!voiceName) {
    throw new Error(
      "ZAHRA_VOICE_NAME is not set. Clone a voice in Zahra Studio first (Clone New Voice tab, " +
        "or POST /clone-voice), then set ZAHRA_VOICE_NAME to its name in .env."
    );
  }
  const { data: voices } = await axios.get<ZahraVoice[]>(`${baseUrl}/voices`, { timeout: 15_000 });
  const match = voices.find((v) => v.name.toLowerCase() === voiceName.toLowerCase());
  if (!match) {
    const available = voices.map((v) => v.name).join(", ") || "(none saved yet)";
    throw new Error(
      `No Zahra Studio voice named "${voiceName}" found. Available voices: ${available}`
    );
  }
  return match.id;
}

async function submitGeneration({
  baseUrl,
  text,
  voiceId,
  config,
}: {
  baseUrl: string;
  text: string;
  voiceId: number;
  config: PipelineConfig;
}): Promise<string> {
  const form = new FormData();
  form.append("text", text);
  form.append("voice_id", String(voiceId));
  form.append("language", config.voiceover.language);
  form.append("exaggeration", String(config.voiceover.exaggeration));
  form.append("cfg_weight", String(config.voiceover.cfgWeight));

  const { data } = await axios.post<{ job_id: string }>(`${baseUrl}/generate-speech`, form, {
    headers: form.getHeaders(),
    timeout: 30_000,
  });
  return data.job_id;
}

async function waitForJob({
  baseUrl,
  jobId,
  pollIntervalMs,
  timeoutMs,
}: {
  baseUrl: string;
  jobId: string;
  pollIntervalMs: number;
  timeoutMs: number;
}): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { data: job } = await axios.get<ZahraJobStatus>(`${baseUrl}/jobs/${jobId}`, {
      timeout: 15_000,
    });
    if (job.status === "done") return;
    if (job.status === "failed") {
      throw new Error(`Zahra Studio generation job ${jobId} failed: ${job.error ?? "unknown error"}`);
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Zahra Studio generation job ${jobId} did not finish within ${Math.round(timeoutMs / 1000)}s`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

async function downloadJobAudio(baseUrl: string, jobId: string, outPath: string): Promise<void> {
  const response = await axios.get(`${baseUrl}/jobs/${jobId}/download`, {
    responseType: "arraybuffer",
    timeout: 60_000,
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(response.data));
}

export interface SynthesizeOptions {
  text: string;
  outPath: string;
  voiceId: number;
  config: PipelineConfig;
}

/**
 * Synthesizes one narration segment via a locally running Zahra Studio
 * instance (see voice_cloning_studio/ on the claude/voice-note-script-generation
 * branch) — free, runs entirely on the user's own machine, no API key.
 * Generation is a background job there, so this submits, polls, then downloads.
 */
export async function synthesizeSegment({ text, outPath, voiceId, config }: SynthesizeOptions): Promise<void> {
  const baseUrl = process.env.ZAHRA_STUDIO_BASE_URL || config.voiceover.baseUrl;
  const jobId = await submitGeneration({ baseUrl, text, voiceId, config });
  await waitForJob({
    baseUrl,
    jobId,
    pollIntervalMs: config.voiceover.pollIntervalMs,
    timeoutMs: config.voiceover.jobTimeoutMs,
  });
  await downloadJobAudio(baseUrl, jobId, outPath);
}
