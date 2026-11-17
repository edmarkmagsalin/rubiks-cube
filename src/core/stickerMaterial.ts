import * as THREE from 'three/webgpu';
import {
  abs,
  attribute,
  float,
  length,
  max,
  min,
  mix,
  positionLocal,
  select,
  sign,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import { FACES, STICKER_CORNER, STICKER_HALF, type Face, type FaceColors } from './constants';

const makeColorUniform = (hex: string) => uniform(new THREE.Color(hex));
type ColorUniform = ReturnType<typeof makeColorUniform>;

export interface StickerMaterial {
  material: THREE.MeshStandardNodeMaterial;
  /** Update any subset of the six face colors at runtime (uniform update, no rebuild). */
  setColors: (colors: Partial<FaceColors>) => void;
  dispose: () => void;
}

/**
 * One shared TSL material for every cubie.
 *
 * Per-cubie data: a constant `home` vec3 attribute (grid coords, each -1/0/1).
 * A sticker exists on a local face only if the cubie's home coordinate on that
 * axis equals the face sign, so stickers stay glued to the cubie as it moves.
 */
export function createStickerMaterial(initial: FaceColors): StickerMaterial {
  const u: Record<Face, ColorUniform> = {
    U: makeColorUniform(initial.U),
    R: makeColorUniform(initial.R),
    F: makeColorUniform(initial.F),
    D: makeColorUniform(initial.D),
    L: makeColorUniform(initial.L),
    B: makeColorUniform(initial.B),
  };

  const home = attribute('home', 'vec3');
  const p = positionLocal;
  const ap = abs(p);

  // Dominant axis of the local position = which cubie face this fragment is on.
  const isX = ap.x.greaterThanEqual(ap.y).and(ap.x.greaterThanEqual(ap.z));
  const isY = isX.not().and(ap.y.greaterThanEqual(ap.z));

  const axisSign = select(isX, sign(p.x), select(isY, sign(p.y), sign(p.z)));
  const homeAxis = select(isX, home.x, select(isY, home.y, home.z));
  const exterior = homeAxis.mul(axisSign).greaterThan(0.5);

  // 2D coords on the face plane
  const facePos = select(isX, vec2(p.y, p.z), select(isY, vec2(p.x, p.z), vec2(p.x, p.y)));

  // Rounded-rectangle signed distance -> anti-aliased sticker mask
  const q = abs(facePos).sub(float(STICKER_HALF - STICKER_CORNER));
  const dist = length(max(q, 0.0))
    .add(min(max(q.x, q.y), 0.0))
    .sub(STICKER_CORNER);
  const edge = 0.006;
  const stickerMask = float(1)
    .sub(smoothstep(-edge, edge, dist))
    .mul(select(exterior, float(1), float(0)));

  const positive = axisSign.greaterThan(0);
  const faceColor = select(
    isX,
    select(positive, u.R, u.L),
    select(isY, select(positive, u.U, u.D), select(positive, u.F, u.B)),
  );

  const material = new THREE.MeshStandardNodeMaterial();
  material.metalness = 0;
  material.colorNode = mix(vec3(0.02, 0.02, 0.022), faceColor, stickerMask);
  material.roughnessNode = mix(float(0.55), float(0.3), stickerMask);

  return {
    material,
    setColors: (next) => {
      for (const f of FACES) {
        const value = next[f];
        if (value) u[f].value.set(value);
      }
    },
    dispose: () => material.dispose(),
  };
}
