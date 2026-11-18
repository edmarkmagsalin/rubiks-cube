import type { Face } from './constants';

export type WideSymbol = 'u' | 'd' | 'l' | 'r' | 'f' | 'b';
export type SliceSymbol = 'M' | 'E' | 'S';
export type RotationSymbol = 'x' | 'y' | 'z';
/** Faces (U D L R F B), wide (u d l r f b), slices (M E S), whole-cube rotations (x y z). */
export type MoveSymbol = Face | WideSymbol | SliceSymbol | RotationSymbol;

/**
 * A single turn.
 * amount: 1 = standard direction (R), 2 = half turn (R2), -1 = inverse (R').
 */
export interface Move {
  symbol: MoveSymbol;
  amount: 1 | 2 | -1;
}

export interface MoveDef {
  /**
   * Axis the move turns around. A standard-direction turn (amount 1) is
   * clockwise when looking from the tip of this axis toward the cube center.
   */
  axis: readonly [number, number, number];
  /**
   * Which layers turn, as distances along `axis` from the center:
   * 1 = the outer layer on that side, 0 = the middle slice, -1 = the opposite outer layer.
   */
  layers: readonly number[];
}

export const MOVE_DEFS: Record<MoveSymbol, MoveDef> = {
  // Faces (U=+y, R=+x, F=+z)
  U: { axis: [0, 1, 0], layers: [1] },
  D: { axis: [0, -1, 0], layers: [1] },
  R: { axis: [1, 0, 0], layers: [1] },
  L: { axis: [-1, 0, 0], layers: [1] },
  F: { axis: [0, 0, 1], layers: [1] },
  B: { axis: [0, 0, -1], layers: [1] },
  // Wide = face + adjacent middle slice (Rw = r)
  u: { axis: [0, 1, 0], layers: [1, 0] },
  d: { axis: [0, -1, 0], layers: [1, 0] },
  r: { axis: [1, 0, 0], layers: [1, 0] },
  l: { axis: [-1, 0, 0], layers: [1, 0] },
  f: { axis: [0, 0, 1], layers: [1, 0] },
  b: { axis: [0, 0, -1], layers: [1, 0] },
  // Slices: M follows L, E follows D, S follows F
  M: { axis: [-1, 0, 0], layers: [0] },
  E: { axis: [0, -1, 0], layers: [0] },
  S: { axis: [0, 0, 1], layers: [0] },
  // Whole cube: x follows R, y follows U, z follows F
  x: { axis: [1, 0, 0], layers: [1, 0, -1] },
  y: { axis: [0, 1, 0], layers: [1, 0, -1] },
  z: { axis: [0, 0, 1], layers: [1, 0, -1] },
};

const TOKEN = /^([UDLRFB]w|[UDLRFBudlrfbMESxyz])(2'?|')?$/;

function parseToken(raw: string): Move {
  const token = raw.replace(/[\u2019\u2018`]/g, "'"); // tolerate typographic primes
  const match = TOKEN.exec(token);
  if (!match) {
    throw new Error(
      `Invalid move "${raw}". Use U D L R F B, wide (Rw or r), slices M E S, rotations x y z, with optional ' or 2.`,
    );
  }
  const base = match[1];
  const symbol = (base.length === 2 ? base[0].toLowerCase() : base) as MoveSymbol; // Rw -> r
  const suffix = match[2];
  const amount = !suffix ? 1 : suffix.startsWith('2') ? 2 : -1;
  return { symbol, amount };
}

/** Accepts "R U R' U' F2 M x" or an array of Move objects. Throws on invalid input. */
export function parseMoves(input: string | readonly Move[]): Move[] {
  if (typeof input !== 'string') return input.map((m) => ({ ...m }));
  return input.trim().split(/\s+/).filter(Boolean).map(parseToken);
}

export function formatMove(move: Move): string {
  return move.symbol + (move.amount === 2 ? '2' : move.amount === -1 ? "'" : '');
}

export function formatMoves(moves: readonly Move[]): string {
  return moves.map(formatMove).join(' ');
}

const AXIS_OF: Record<Face, 'x' | 'y' | 'z'> = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' };
const ALL_FACES: Face[] = ['U', 'D', 'R', 'L', 'F', 'B'];

/** Random face-turn scramble: no repeated face, no 3rd move on the same axis in a row. */
export function randomScramble(length = 20, random: () => number = Math.random): Move[] {
  const amounts: Move['amount'][] = [1, 2, -1];
  const faces: Face[] = [];
  const moves: Move[] = [];
  while (moves.length < length) {
    const face = ALL_FACES[Math.floor(random() * ALL_FACES.length)];
    const prev = faces[faces.length - 1];
    const prev2 = faces[faces.length - 2];
    if (prev && prev === face) continue;
    if (prev && prev2 && AXIS_OF[prev] === AXIS_OF[prev2] && AXIS_OF[face] === AXIS_OF[prev]) continue;
    faces.push(face);
    moves.push({ symbol: face, amount: amounts[Math.floor(random() * amounts.length)] });
  }
  return moves;
}
