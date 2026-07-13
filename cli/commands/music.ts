import fs from "node:fs";
import path from "node:path";
import type { PipelineConfig } from "../lib/config.js";
import {
  duckMusicUnderNarration,
  getAudioDurationSeconds,
  loopAndTrimMusic,
} from "../lib/audio-utils.js";

export interface MixMusicOptions {
  narrationPath: string;
  musicLibraryDir: string;
  /** Optional explicit track (e.g. user-specified via CLI flag); otherwise one is picked at random from musicLibraryDir. */
  musicTrackPath?: string;
  mixedOutPath: string;
  config: PipelineConfig;
}

function pickRandomTrack(musicLibraryDir: string): string {
  if (!fs.existsSync(musicLibraryDir)) {
    throw new Error(
      `Music library folder not found: ${musicLibraryDir}. Add at least one royalty-free ambient track (.mp3/.wav) there.`
    );
  }
  const tracks = fs
    .readdirSync(musicLibraryDir)
    .filter((f) => /\.(mp3|wav|m4a)$/i.test(f));
  if (tracks.length === 0) {
    throw new Error(
      `No music tracks found in ${musicLibraryDir}. Add at least one royalty-free ambient track (.mp3/.wav).`
    );
  }
  return path.join(musicLibraryDir, tracks[Math.floor(Math.random() * tracks.length)]);
}

/**
 * Loops/trims an ambient track to the narration's length, then mixes it in
 * with sidechain ducking so it drops under the narration automatically.
 */
export async function mixMusicUnderNarration({
  narrationPath,
  musicLibraryDir,
  musicTrackPath,
  mixedOutPath,
  config,
}: MixMusicOptions): Promise<void> {
  const track = musicTrackPath ?? pickRandomTrack(musicLibraryDir);
  const narrationDuration = await getAudioDurationSeconds(narrationPath);

  const loopedPath = path.join(path.dirname(mixedOutPath), "music.loop.wav");
  await loopAndTrimMusic(track, narrationDuration, loopedPath);

  await duckMusicUnderNarration({
    narrationPath,
    musicPath: loopedPath,
    outPath: mixedOutPath,
    musicVolumeDb: config.music.musicVolumeDb,
    duckingVolumeDb: config.music.duckingVolumeDb,
    attackSeconds: config.music.duckAttackSeconds,
    releaseSeconds: config.music.duckReleaseSeconds,
  });

  fs.rmSync(loopedPath, { force: true });
}
