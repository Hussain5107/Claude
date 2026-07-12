import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "fluent-ffmpeg";

const execFileAsync = promisify(execFile);

export async function getAudioDurationSeconds(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      // ffprobe reports "N/A" (a string, not null/undefined) when it can't
      // determine duration — e.g. an empty/corrupt audio file. Left
      // unvalidated, that string silently propagates as a segment "duration"
      // and only surfaces much later as a cryptic NaN in Remotion's render.
      const raw = data.format.duration;
      const duration = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(duration)) {
        throw new Error(
          `ffprobe could not determine a valid duration for ${filePath} (got ${JSON.stringify(
            raw
          )}) — the audio file is likely empty or corrupt.`
        );
      }
      resolve(duration);
    });
  });
}

export async function generateSilence(
  durationSeconds: number,
  outPath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=channel_layout=stereo:sample_rate=44100",
    "-t",
    durationSeconds.toFixed(2),
    "-q:a",
    "9",
    outPath,
  ]);
}

/**
 * Concatenates narration segments and silence gaps, in order, into a single
 * audio track. Uses the concat *filter* (not the concat demuxer) so mixed
 * input codecs/containers (Zahra Studio wav + generated silence wav) are
 * decoded and re-joined safely rather than requiring byte-identical formats.
 */
export async function concatAudioFiles(
  files: string[],
  outPath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const inputArgs = files.flatMap((f) => ["-i", f]);
  const filterInputs = files.map((_, i) => `[${i}:a]`).join("");
  const filterComplex = `${filterInputs}concat=n=${files.length}:v=0:a=1[out]`;
  await execFileAsync("ffmpeg", [
    "-y",
    ...inputArgs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[out]",
    outPath,
  ]);
}

export async function loopAndTrimMusic(
  musicPath: string,
  targetDurationSeconds: number,
  outPath: string
): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await execFileAsync("ffmpeg", [
    "-y",
    "-stream_loop",
    "-1",
    "-i",
    musicPath,
    "-t",
    targetDurationSeconds.toFixed(2),
    "-c:a",
    "pcm_s16le",
    outPath,
  ]);
}

export interface DuckingOptions {
  narrationPath: string;
  musicPath: string;
  outPath: string;
  musicVolumeDb: number;
  duckingVolumeDb: number;
  attackSeconds: number;
  releaseSeconds: number;
}

/**
 * Mixes narration (dry) with a music bed that ducks automatically whenever
 * narration is present, using sidechaincompress keyed off the narration
 * track. This reacts to the real narration audio rather than a hand-authored
 * keyframe list, so it stays correct even if segment timing is edited later.
 */
export async function duckMusicUnderNarration({
  narrationPath,
  musicPath,
  outPath,
  musicVolumeDb,
  duckingVolumeDb,
  attackSeconds,
  releaseSeconds,
}: DuckingOptions): Promise<void> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // ratio chosen so the sidechain compressor pulls music down close to
  // duckingVolumeDb (relative to musicVolumeDb) whenever narration is active.
  const duckDeltaDb = Math.max(1, musicVolumeDb - duckingVolumeDb);
  const ratio = Math.min(20, Math.max(2, duckDeltaDb / 2));
  const filterComplex = [
    `[1:a]volume=${musicVolumeDb}dB[musicvol]`,
    `[0:a][musicvol]sidechaincompress=threshold=0.04:ratio=${ratio.toFixed(
      1
    )}:attack=${Math.round(attackSeconds * 1000)}:release=${Math.round(
      releaseSeconds * 1000
    )}:makeup=1[ducked]`,
    `[0:a][ducked]amix=inputs=2:duration=first:weights='1 1':normalize=0[mix]`,
  ].join(";");
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    narrationPath,
    "-i",
    musicPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[mix]",
    "-ac",
    "2",
    outPath,
  ]);
}
