/**
 * Synthesized sound effects via WebAudio — no audio files to download, so the
 * whole game stays instantly offline-capable. Respects mute/volume settings.
 */
let ctx = null;
let muted = false;
let volume = 0.5;

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Unlock audio on first user gesture (required by mobile browsers).
["pointerdown", "keydown"].forEach((evt) => {
  window.addEventListener(evt, () => ensureCtx(), { once: true, passive: true });
});

export function setMuted(value) {
  muted = value;
}
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
}
export function isMuted() {
  return muted;
}

function tone({ freq, duration = 0.15, type = "sine", delay = 0, gain = 1, glideTo = null }) {
  const c = ensureCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delay);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + delay + duration);
  g.gain.setValueAtTime(0, c.currentTime + delay);
  g.gain.linearRampToValueAtTime(gain * volume, c.currentTime + delay + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + duration + 0.02);
}

export const sfx = {
  click: () => tone({ freq: 520, duration: 0.06, type: "triangle", gain: 0.4 }),
  correct: () => {
    tone({ freq: 660, duration: 0.12, type: "sine", gain: 0.5 });
    tone({ freq: 880, duration: 0.16, delay: 0.1, type: "sine", gain: 0.5 });
  },
  wrong: () => tone({ freq: 220, duration: 0.22, type: "sawtooth", gain: 0.25, glideTo: 160 }),
  coin: () => {
    tone({ freq: 988, duration: 0.08, type: "square", gain: 0.3 });
    tone({ freq: 1318, duration: 0.12, delay: 0.06, type: "square", gain: 0.3 });
  },
  star: () => tone({ freq: 1046, duration: 0.3, type: "sine", gain: 0.4, glideTo: 1568 }),
  levelUp: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, duration: 0.2, delay: i * 0.12, type: "sine", gain: 0.5 }));
  },
  chest: () => {
    tone({ freq: 300, duration: 0.15, type: "triangle", gain: 0.4 });
    tone({ freq: 700, duration: 0.25, delay: 0.15, type: "sine", gain: 0.5, glideTo: 1200 });
  },
  swoosh: () => tone({ freq: 400, duration: 0.18, type: "sine", gain: 0.2, glideTo: 900 }),
  pop: () => tone({ freq: 700, duration: 0.08, type: "square", gain: 0.3 }),
  petHappy: () => {
    tone({ freq: 784, duration: 0.1, type: "sine", gain: 0.35 });
    tone({ freq: 988, duration: 0.14, delay: 0.08, type: "sine", gain: 0.35 });
  },
};

export function speak(text, { rate = 0.95, pitch = 1.15 } = {}) {
  if (muted || !("speechSynthesis" in window) || !text) return;
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    utter.volume = volume;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {
    /* speech synthesis unavailable — silently ignore */
  }
}

export const audioManager = { sfx, speak, setMuted, isMuted, setVolume };
export default audioManager;
