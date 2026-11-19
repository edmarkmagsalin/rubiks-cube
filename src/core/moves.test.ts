import { describe, expect, it } from 'vitest';
import { formatMoves, parseMoves, randomScramble } from './moves';

describe('parseMoves', () => {
  it('parses faces with prime and half-turn suffixes', () => {
    expect(parseMoves("R U' F2")).toEqual([
      { symbol: 'R', amount: 1 },
      { symbol: 'U', amount: -1 },
      { symbol: 'F', amount: 2 },
    ]);
  });

  it("treats 2' as a half turn", () => {
    expect(parseMoves("R2'")).toEqual([{ symbol: 'R', amount: 2 }]);
  });

  it('accepts typographic primes', () => {
    expect(parseMoves('R\u2019')).toEqual([{ symbol: 'R', amount: -1 }]);
  });

  it('parses wide moves, slices and whole-cube rotations', () => {
    expect(parseMoves("Rw u M E' S2 x y' z2")).toEqual([
      { symbol: 'r', amount: 1 },
      { symbol: 'u', amount: 1 },
      { symbol: 'M', amount: 1 },
      { symbol: 'E', amount: -1 },
      { symbol: 'S', amount: 2 },
      { symbol: 'x', amount: 1 },
      { symbol: 'y', amount: -1 },
      { symbol: 'z', amount: 2 },
    ]);
  });

  it('ignores extra whitespace and accepts empty input', () => {
    expect(parseMoves('  R   U  ')).toHaveLength(2);
    expect(parseMoves('')).toHaveLength(0);
  });

  it('throws a readable error on invalid notation', () => {
    expect(() => parseMoves('R Q')).toThrow(/Invalid move "Q"/);
    expect(() => parseMoves('R3')).toThrow(/Invalid move/);
    expect(() => parseMoves('r w')).toThrow(/Invalid move/);
  });

  it('copies Move arrays instead of reusing them', () => {
    const input = [{ symbol: 'R' as const, amount: 1 as const }];
    const out = parseMoves(input);
    expect(out).toEqual(input);
    expect(out[0]).not.toBe(input[0]);
  });
});

describe('formatMoves', () => {
  it('round-trips standard notation', () => {
    const text = "R U' F2 r M x";
    expect(formatMoves(parseMoves(text))).toBe(text);
  });

  it('writes Rw as r', () => {
    expect(formatMoves(parseMoves('Rw'))).toBe('r');
  });
});

describe('randomScramble', () => {
  it('returns the requested number of face moves', () => {
    expect(randomScramble(25)).toHaveLength(25);
  });

  it('never repeats the same face twice in a row', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const moves = randomScramble(200, random);
    for (let i = 1; i < moves.length; i++) {
      expect(moves[i].symbol).not.toBe(moves[i - 1].symbol);
    }
  });
});
