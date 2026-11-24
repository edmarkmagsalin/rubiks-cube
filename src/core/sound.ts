type AudioContextCtor = typeof AudioContext;

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * A small synthesized "click" for finished turns (no audio files to ship).
 * Browser only: the AudioContext is created lazily on the first click, and
 * everything is a silent no-op when audio is unavailable or still blocked by
 * the browser's autoplay policy (it unlocks after the first user gesture).
 */
export class TurnSound {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private failed = false;
  private lastAt = 0;

  /** Play one click. `volume` is 0..1. */
  click(volume: number): void {
    const v = clamp01(volume);
    if (v <= 0) return;

    const now = performance.now();
    if (now - this.lastAt < 30) return; // keep fast sequences from piling up
    const ctx = this.context();
    if (!ctx) return;
    this.lastAt = now;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = v;
    out.connect(ctx.destination);

    // Plastic "tick": a very short, band-passed noise burst.
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.playbackRate.value = 0.9 + Math.random() * 0.25;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800 + Math.random() * 900;
    band.Q.value = 0.9;
    const tick = ctx.createGain();
    tick.gain.setValueAtTime(0.9, t);
    tick.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.connect(band);
    band.connect(tick);
    tick.connect(out);
    src.start(t);
    src.stop(t + 0.06);

    // Low "thock" for the body of the cube.
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.05);
    const thock = ctx.createGain();
    thock.gain.setValueAtTime(0.5, t);
    thock.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(thock);
    thock.connect(out);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  dispose(): void {
    const ctx = this.ctx;
    this.ctx = null;
    this.noise = null;
    if (ctx && ctx.state !== 'closed') void ctx.close();
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

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const length = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    this.noise = buffer;
    return buffer;
  }
}
