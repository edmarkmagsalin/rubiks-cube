import { MOVE_DEFS, type Move } from './moves';
import type { Face } from './constants';

/**
 * Pure (no three.js) cube model: facelet string <-> cubie placements.
 *
 * Facelet string: 54 chars, faces in the order U R F D L B (Kociemba standard),
 * 9 stickers per face read row by row as seen from outside the face
 * (U: back row on top; D: front row on top; others: U on top, and for B the
 * view is from behind). Each char is the face letter of that sticker's color.
 * Solved = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB".
 */

export type Vec3 = readonly [number, number, number];
/** Row-major 3x3 matrix. */
export type Mat3 = readonly number[];

export interface CubiePlacement {
  /** Solved-position grid coordinates (identity of the piece). */
  home: Vec3;
  /** Current grid position. */
  pos: Vec3;
  /** Rotation mapping the piece's own frame to the cube frame. */
  rot: Mat3;
}

export const SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// ---- small integer linear algebra ----------------------------------------

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const clean = (n: number): number => Math.round(n) || 0;

const mulMV = (m: Mat3, v: Vec3): Vec3 => [
  clean(m[0] * v[0] + m[1] * v[1] + m[2] * v[2]),
  clean(m[3] * v[0] + m[4] * v[1] + m[5] * v[2]),
  clean(m[6] * v[0] + m[7] * v[1] + m[8] * v[2]),
];
const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const mulMM = (a: Mat3, b: Mat3): Mat3 => {
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(clean(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));
    }
  }
  return out;
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vecEq = (a: Vec3, b: Vec3): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const posKey = (v: Vec3): string => `${v[0]},${v[1]},${v[2]}`;

/** Rotation by `quarters` x 90 degrees about a unit axis (right-hand rule). */
export function rotationMatrix(axis: Vec3, quarters: number): Mat3 {
  const k = ((quarters % 4) + 4) % 4;
  const c = [1, 0, -1, 0][k];
  const s = [0, 1, 0, -1][k];
  const [x, y, z] = axis;
  const m = [
    c + (1 - c) * x * x, (1 - c) * x * y - s * z, (1 - c) * x * z + s * y,
    (1 - c) * y * x + s * z, c + (1 - c) * y * y, (1 - c) * y * z - s * x,
    (1 - c) * z * x - s * y, (1 - c) * z * y + s * x, c + (1 - c) * z * z,
  ];
  return m.map(clean);
}

// ---- facelet layout -------------------------------------------------------

const FACE_ORDER: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const FACE_NORMAL: Record<Face, Vec3> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};
/** Grid position of the sticker at (row, col) of each face. */
const FACE_POS: Record<Face, (r: number, c: number) => Vec3> = {
  U: (r, c) => [c - 1, 1, r - 1],
  R: (r, c) => [1, 1 - r, 1 - c],
  F: (r, c) => [c - 1, 1 - r, 1],
  D: (r, c) => [c - 1, -1, 1 - r],
  L: (r, c) => [-1, 1 - r, c - 1],
  B: (r, c) => [1 - c, 1 - r, -1],
};

interface Facelet {
  pos: Vec3;
  normal: Vec3;
}
const FACELETS: Facelet[] = FACE_ORDER.flatMap((face) =>
  Array.from({ length: 9 }, (_, i) => ({
    pos: FACE_POS[face](Math.floor(i / 3), i % 3),
    normal: FACE_NORMAL[face],
  })),
);

const letterOf = (normal: Vec3): Face => FACE_ORDER.find((f) => vecEq(FACE_NORMAL[f], normal))!;

/** All 26 grid positions (= piece identities). */
const HOMES: Vec3[] = [];
for (let x = -1; x <= 1; x++)
  for (let y = -1; y <= 1; y++)
    for (let z = -1; z <= 1; z++) if (x || y || z) HOMES.push([x, y, z]);

/** Outward normals of the faces a piece at `p` touches. */
function exteriorNormals(p: Vec3): Vec3[] {
  const out: Vec3[] = [];
  if (p[0]) out.push([p[0], 0, 0]);
  if (p[1]) out.push([0, p[1], 0]);
  if (p[2]) out.push([0, 0, p[2]]);
  return out;
}
const colorKey = (letters: string[]): string => [...letters].sort().join('');
const HOME_BY_COLORS = new Map<string, Vec3>(
  HOMES.map((h) => [colorKey(exteriorNormals(h).map(letterOf)), h]),
);
const kindOf = (p: Vec3): 'center' | 'edge' | 'corner' =>
  ['center', 'edge', 'corner'][Math.abs(p[0]) + Math.abs(p[1]) + Math.abs(p[2]) - 1] as 'center' | 'edge' | 'corner';

// ---- state -> placements ---------------------------------------------------

export function normalizeState(input: string): string {
  return input.trim().toUpperCase();
}

/** Builds piece placements from a facelet string. Throws a readable Error if impossible. */
export function parseState(input: string): CubiePlacement[] {
  const state = normalizeState(input);
  if (state.length !== 54) throw new Error(`State must have 54 characters, got ${state.length}.`);
  if (!/^[URFDLB]+$/.test(state)) throw new Error('State may only contain the letters U R F D L B.');
  for (const f of FACE_ORDER) {
    const n = state.split(f).length - 1;
    if (n !== 9) throw new Error(`Each color must appear exactly 9 times; "${f}" appears ${n} times.`);
  }

  const bySlot = new Map<string, { normal: Vec3; letter: Face }[]>();
  FACELETS.forEach((fl, i) => {
    const k = posKey(fl.pos);
    const list = bySlot.get(k) ?? [];
    list.push({ normal: fl.normal, letter: state[i] as Face });
    bySlot.set(k, list);
  });

  const placements: CubiePlacement[] = [];
  const used = new Set<string>();

  for (const pos of HOMES) {
    const stickers = bySlot.get(posKey(pos))!;
    const home = HOME_BY_COLORS.get(colorKey(stickers.map((s) => s.letter)));
    const where = `at position (${pos.join(', ')})`;
    if (!home) throw new Error(`Impossible piece ${where}: colors ${stickers.map((s) => s.letter).join('')} never share a piece.`);
    if (used.has(posKey(home))) throw new Error(`Piece ${stickers.map((s) => s.letter).join('')} appears twice (${where}).`);
    used.add(posKey(home));

    if (kindOf(pos) === 'center') {
      if (!vecEq(home, pos)) throw new Error(`Center ${where} must be ${letterOf(pos)}; centers cannot move.`);
      placements.push({ home, pos, rot: IDENTITY });
      continue;
    }

    // Pair each of the piece's own stickers with the slot face currently showing that color.
    const pairs = exteriorNormals(home).map((local) => {
      const target = stickers.find((s) => s.letter === letterOf(local))!;
      return { local, target: target.normal };
    });
    const l1 = pairs[0].local;
    const l2 = pairs[1].local;
    const m1 = pairs[0].target;
    const m2 = pairs[1].target;
    const l3 = cross(l1, l2);
    const m3 = cross(m1, m2);
    const outer = (a: Vec3, b: Vec3): number[] => [
      a[0] * b[0], a[0] * b[1], a[0] * b[2],
      a[1] * b[0], a[1] * b[1], a[1] * b[2],
      a[2] * b[0], a[2] * b[1], a[2] * b[2],
    ];
    const rot = [outer(m1, l1), outer(m2, l2), outer(m3, l3)].reduce((acc, o) => acc.map((v, i) => v + o[i])).map(clean);

    if (pairs.length === 3 && !vecEq(mulMV(rot, pairs[2].local), pairs[2].target)) {
      throw new Error(`Corner ${where} has its colors in an impossible (mirrored) order.`);
    }
    placements.push({ home, pos, rot });
  }
  return placements;
}

// ---- placements -> state ---------------------------------------------------

/**
 * Facelet string of the current piece placements. Whole-cube rotations
 * (x y z) are factored out, so the result always has the standard centers.
 */
export function stateFromCubies(cubies: readonly CubiePlacement[]): string {
  // Find the whole-cube rotation from where the R and U centers sit now
  // (face turns spin a center in place but never move it; slices and x y z do).
  const centerR = cubies.find((c) => vecEq(c.home, [1, 0, 0]));
  const centerU = cubies.find((c) => vecEq(c.home, [0, 1, 0]));
  let undo: Mat3 = IDENTITY;
  if (centerR && centerU) {
    const pr = centerR.pos;
    const pu = centerU.pos;
    const pf = cross(pr, pu);
    // columns of the rotation that took the solved centers to where they are now
    undo = transpose([pr[0], pu[0], pf[0], pr[1], pu[1], pf[1], pr[2], pu[2], pf[2]]);
  }

  const grid = new Map<string, CubiePlacement>();
  for (const c of cubies) grid.set(posKey(mulMV(undo, c.pos)), { ...c, rot: mulMM(undo, c.rot) });

  return FACELETS.map((fl) => {
    const c = grid.get(posKey(fl.pos));
    if (!c) throw new Error('Cube pieces are not on the grid.');
    return letterOf(mulMV(transpose(c.rot), fl.normal)); // sticker normal in the piece's own frame
  }).join('');
}

/** Pure move application (used by tests and state tracking). */
export function applyMoveToCubies(cubies: readonly CubiePlacement[], move: Move): CubiePlacement[] {
  const def = MOVE_DEFS[move.symbol];
  const axis: Vec3 = [def.axis[0], def.axis[1], def.axis[2]];
  const r = rotationMatrix(axis, -move.amount); // standard direction = negative quarter turn about the axis
  return cubies.map((c) => {
    const d = dot(c.pos, axis);
    return def.layers.some((v) => Math.abs(d - v) < 0.5) ? { ...c, pos: mulMV(r, c.pos), rot: mulMM(r, c.rot) } : c;
  });
}

export const solvedCubies = (): CubiePlacement[] => HOMES.map((h) => ({ home: h, pos: h, rot: IDENTITY }));

// ---- validation ---------------------------------------------------------------

const AXIS_INDEX = (v: Vec3): number => (v[0] ? 0 : v[1] ? 1 : 2);

function permutationParity(perm: number[]): number {
  const seen = new Array(perm.length).fill(false);
  let parity = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = perm[j]) {
      seen[j] = true;
      len++;
    }
    parity += len - 1;
  }
  return parity % 2;
}

/** Returns an error message if the placements cannot be reached by legal turns, else null. */
export function solvabilityError(cubies: readonly CubiePlacement[]): string | null {
  const corners = HOMES.filter((h) => kindOf(h) === 'corner');
  const edges = HOMES.filter((h) => kindOf(h) === 'edge');
  const byPos = new Map(cubies.map((c) => [posKey(c.pos), c]));
  const homeIndex = (list: Vec3[], home: Vec3): number => list.findIndex((h) => vecEq(h, home));

  let twist = 0;
  const cornerPerm = corners.map((slot) => {
    const c = byPos.get(posKey(slot))!;
    // ref sticker = the piece's U/D sticker (local y axis)
    const image = AXIS_INDEX(mulMV(c.rot, [0, c.home[1], 0]));
    // slot's counter-clockwise axis cycle starting at y
    const cycle = slot[0] * slot[1] * slot[2] > 0 ? [1, 2, 0] : [1, 0, 2];
    twist += cycle.indexOf(image);
    return homeIndex(corners, c.home);
  });

  let flip = 0;
  const edgePerm = edges.map((slot) => {
    const c = byPos.get(posKey(slot))!;
    const refLocal: Vec3 = c.home[1] ? [0, c.home[1], 0] : [0, 0, c.home[2]];
    const slotRef = slot[1] ? 1 : 2;
    flip += AXIS_INDEX(mulMV(c.rot, refLocal)) === slotRef ? 0 : 1;
    return homeIndex(edges, c.home);
  });

  if (twist % 3 !== 0) return 'A corner is twisted: this state cannot be reached by legal turns.';
  if (flip % 2 !== 0) return 'An edge is flipped: this state cannot be reached by legal turns.';
  if (permutationParity(cornerPerm) !== permutationParity(edgePerm)) {
    return 'Two pieces are swapped: this state cannot be reached by legal turns.';
  }
  return null;
}

export type StateValidation = { ok: true; state: string } | { ok: false; error: string };

/** Checks format, piece consistency and solvability. */
export function validateState(input: string): StateValidation {
  try {
    const placements = parseState(input);
    const err = solvabilityError(placements);
    return err ? { ok: false, error: err } : { ok: true, state: normalizeState(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
