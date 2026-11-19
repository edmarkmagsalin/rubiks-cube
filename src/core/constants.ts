/** Face order follows the Kociemba convention: U R F D L B. */
export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];
export type FaceColors = Record<Face, string>;

/** Default primaries. White is U (top), green is F (front). */
export const DEFAULT_COLORS: FaceColors = {
  U: '#ffffff', // white
  R: '#b71234', // red
  F: '#009b48', // green
  D: '#ffd500', // yellow
  L: '#ff5800', // orange
  B: '#0046ad', // blue
};

/** Fills any missing/empty face color with the default. */
export function resolveColors(colors?: Partial<FaceColors> | null): FaceColors {
  const out = { ...DEFAULT_COLORS };
  if (colors) for (const f of FACES) if (colors[f]) out[f] = colors[f] as string;
  return out;
}

// Cubie geometry (cubies are spaced 1 unit apart)
export const CUBIE_SIZE = 0.98;
export const CUBIE_RADIUS = 0.09;
/** Small dark core that only fills the hidden center void. Must stay smaller than the
 * void so it never shows while layers turn (a larger core poked out as a black slab). */
export const CORE_SIZE = 0.9;
/** Bounding sphere radius of the whole cube (corner of the outer cubies). */
export const CUBE_BOUNDING_RADIUS = 2.6;

// Sticker shape (in cubie-local units)
export const STICKER_HALF = 0.385;
export const STICKER_CORNER = 0.09;
