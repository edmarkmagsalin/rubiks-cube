import { describe, expect, it } from 'vitest';
import { TURN_SOUND_WAV_BASE64 } from './turnSoundData';

const bytes = Uint8Array.from(atob(TURN_SOUND_WAV_BASE64), (c) => c.charCodeAt(0));
const view = new DataView(bytes.buffer);
const text = (offset: number, length: number) => String.fromCharCode(...bytes.slice(offset, offset + length));

describe('embedded turn sound', () => {
  it('is a 16-bit PCM mono WAV', () => {
    expect(text(0, 4)).toBe('RIFF');
    expect(text(8, 4)).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  it('is short enough for fast turns and does not clip', () => {
    const sampleRate = view.getUint32(24, true);
    const dataLength = view.getUint32(40, true);
    const seconds = dataLength / 2 / sampleRate;
    expect(seconds > 0.05 && seconds < 0.3).toBe(true);

    let peak = 0;
    for (let i = 44; i + 1 < bytes.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
    expect(peak > 20000).toBe(true); // audible level
    expect(peak < 32767).toBe(true); // no clipping
  });
});
