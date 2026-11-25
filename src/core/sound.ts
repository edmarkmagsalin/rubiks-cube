import { TURN_SOUND_WAV_BASE64 } from './turnSoundData';

type AudioContextCtor = typeof AudioContext;

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Never start more than this many overlapping hits (keeps very fast sequences clean). */
const MAX_VOICES = 8;
/** Minimum time between two hits, in milliseconds. */
const MIN_GAP_MS = 12;

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer as ArrayBuffer;
}

/**
 * Plays the recorded turn sound (a short WAV embedded in the package) when a move
 * finishes. Every hit is its own short-lived buffer source, so fast turns overlap
 * cleanly instead of cutting each other off. Browser only, and a silent no-op when
 * audio is unavailable or the browser has not allowed sound yet (it unlocks after
 * the first user interaction with the page).
 */
export class TurnSound {
  private ctx: AudioContext | null = null;
  private master: DynamicsCompressorNode | null = null;
  private buffer: AudioBuffer | null = null;
  private loading = false;
  private failed = false;
  private voices = 0;
  private lastAt = 0;

  /** Create the audio context and decode the sample ahead of the first hit. */
  prepare(): void {
    if (this.buffer || this.loading || this.failed || !this.allowed()) return;
    const ctx = this.context();
    if (!ctx) return;
    this.loading = true;
    ctx
      .decodeAudioData(base64ToArrayBuffer(TURN_SOUND_WAV_BASE64))
      .then((decoded) => {
        this.buffer = decoded;
      })
      .catch(() => {
        this.failed = true;
      })
      .finally(() => {
        this.loading = false;
      });
  }

  /** Play one hit. `volume` is 0..1. */
  click(volume: number): void {
    const v = clamp01(volume);
    if (v <= 0 || this.failed || !this.allowed()) return;

    const now = performance.now();
    if (now - this.lastAt < MIN_GAP_MS || this.voices >= MAX_VOICES) return;

    const ctx = this.context();
    if (!ctx) return;
    if (!this.buffer) {
      this.prepare(); // normally done earlier; the very first hit is skipped while decoding
      return;
    }
    this.lastAt = now;
    if (ctx.state === 'suspended') void ctx.resume();

    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = 0.96 + Math.random() * 0.08; // tiny variation: rapid turns never sound identical
    const gain = ctx.createGain();
    gain.gain.value = v * (0.9 + Math.random() * 0.1);
    src.connect(gain);
    gain.connect(this.output(ctx));

    this.voices++;
    src.onended = () => {
      this.voices--;
      src.disconnect();
      gain.disconnect();
    };
    src.start();
  }

  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.buffer = null;
    if (ctx && ctx.state !== 'closed') void ctx.close();
  }

  /** Browsers only allow sound after the user has interacted with the page. */
  private allowed(): boolean {
    if (typeof window === 'undefined') return false;
    const activation = navigator.userActivation;
    return !activation || activation.hasBeenActive;
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.failed || typeof window === 'undefined') return null;
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) {
      this.failed = true;
      return null;
    }
    try {
      this.ctx = new Ctor();
    } catch {
      this.failed = true;
    }
    return this.ctx;
  }

  /** A gentle limiter so many overlapping hits never clip. */
  private output(ctx: AudioContext): AudioNode {
    if (this.master) return this.master;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    limiter.connect(ctx.destination);
    this.master = limiter;
    return limiter;
  }
}
