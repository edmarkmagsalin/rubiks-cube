import { describe, expect, it } from 'vitest';
import {
  SOLVED_STATE,
  applyMoveToCubies,
  parseState,
  solvedCubies,
  stateFromCubies,
  validateState,
} from './cubeState';
import { parseMoves, randomScramble, type Move } from './moves';

const play = (moves: string | readonly Move[], from = solvedCubies()) =>
  parseMoves(moves).reduce((cubies, move) => applyMoveToCubies(cubies, move), from);
const stateAfter = (moves: string) => stateFromCubies(play(moves));

/** Swap two facelets (to build impossible states). */
const swapped = (pairs: [number, number][]) => {
  const chars = SOLVED_STATE.split('');
  for (const [a, b] of pairs) [chars[a], chars[b]] = [chars[b], chars[a]];
  return chars.join('');
};

describe('facelet strings', () => {
  it('solved cube matches SOLVED_STATE', () => {
    expect(stateFromCubies(solvedCubies())).toBe(SOLVED_STATE);
  });

  it('matches the known facelets after R', () => {
    expect(stateAfter('R')).toBe('UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB');
  });

  it('matches the known facelets after U', () => {
    expect(stateAfter('U')).toBe('UUUUUUUUUBBBRRRRRRRRRFFFFFFDDDDDDDDDFFFLLLLLLLLLBBBBBB');
  });

  it('four quarter turns return to solved', () => {
    expect(stateAfter('R R R R')).toBe(SOLVED_STATE);
    expect(stateAfter("R U R' U' ".repeat(6))).toBe(SOLVED_STATE);
  });
});

describe('notation equivalences', () => {
  it('whole-cube rotations do not change the normalised state', () => {
    expect(stateAfter('x')).toBe(SOLVED_STATE);
    const scramble = "R U F2 L' D B2 U' R2";
    expect(stateAfter(`${scramble} x y z2`)).toBe(stateAfter(scramble));
  });

  it("M equals R L' x'", () => {
    expect(stateAfter('M')).toBe(stateAfter("R L' x'"));
  });

  it("r equals R M'", () => {
    expect(stateAfter('r')).toBe(stateAfter("R M'"));
  });
});

describe('parseState / validateState', () => {
  it('round-trips random scrambles and finds them valid', () => {
    for (let i = 0; i < 200; i++) {
      const state = stateFromCubies(play(randomScramble(25)));
      expect(validateState(state).ok).toBe(true);
      expect(stateFromCubies(parseState(state))).toBe(state);
    }
  });

  it('continues correctly from a parsed state', () => {
    for (let i = 0; i < 50; i++) {
      const first = randomScramble(20);
      const second = randomScramble(8);
      const direct = stateFromCubies(play([...first, ...second]));
      const mid = stateFromCubies(play(first));
      expect(stateFromCubies(play(second, parseState(mid)))).toBe(direct);
    }
  });

  it('accepts lowercase and surrounding spaces', () => {
    expect(validateState(` ${SOLVED_STATE.toLowerCase()} `).ok).toBe(true);
  });

  it('rejects wrong length, letters and color counts', () => {
    expect(validateState('UUU').ok).toBe(false);
    expect(validateState(`${'X'.repeat(54)}`).ok).toBe(false);
    expect(validateState(SOLVED_STATE.replace('B', 'U')).ok).toBe(false);
  });

  it('rejects a twisted corner, a flipped edge and swapped edges', () => {
    // URF corner: U8, R9, F20 rotated
    const twisted = SOLVED_STATE.split('');
    [twisted[8], twisted[9], twisted[20]] = [twisted[9], twisted[20], twisted[8]];
    const twist = validateState(twisted.join(''));
    expect(twist.ok).toBe(false);

    const flip = validateState(swapped([[7, 19]]));
    expect(flip.ok).toBe(false);

    const swap = validateState(swapped([[7, 5], [19, 10]]));
    expect(swap.ok).toBe(false);
  });

  it('explains why a state is rejected', () => {
    const result = validateState('R'.repeat(54));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/9 times/);
  });
});
