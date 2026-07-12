import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import type { PipelineConfig } from "./config.js";

const API_BASE = "https://api.elevenlabs.io/v1";

export interface SynthesizeOptions {
  text: string;
  outPath: string;
  voiceId?: string;
  config: PipelineConfig;
}

export async function synthesizeSegment({
  text,
  outPath,
  voiceId,
  config,
}: SynthesizeOptions): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set. Copy .env.example to .env and add your key."
    );
  }
  const voice =
    voiceId || process.env.ELEVENLABS_VOICE_ID || config.voiceover.defaultVoiceId;

  const response = await axios.post(
    `${API_BASE}/text-to-speech/${voice}`,
    {
      text,
      model_id: config.voiceover.modelId,
      voice_settings: {
        stability: config.voiceover.stability,
        similarity_boost: config.voiceover.similarityBoost,
        style: config.voiceover.style,
        use_speaker_boost: config.voiceover.useSpeakerBoost,
      },
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      responseType: "arraybuffer",
      timeout: 120_000,
    }
  );

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(response.data));
}
