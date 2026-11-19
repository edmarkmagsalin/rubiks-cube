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
  texture,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import { FACES, STICKER_CORNER, STICKER_HALF, type Face, type FaceColors } from './constants';

const makeColorUniform = (hex: string) => uniform(new THREE.Color(hex));
type ColorUniform = ReturnType<typeof makeColorUniform>;

export interface LogoSettings {
  /** Logo width as a fraction of the sticker (aspect ratio is kept). Default 0.75. */
  scale?: number;
  /** Degrees, clockwise as seen looking at the white face. Default 0. */
  rotation?: number;
}

export interface StickerMaterial {
  material: THREE.MeshStandardNodeMaterial;
  /** Update any subset of the six face colors at runtime (uniform update, no rebuild). */
  setColors: (colors: Partial<FaceColors>) => void;
  /** Show a logo on the white (U) center sticker, or pass null to remove it. No shader rebuild. */
  setLogo: (logo: THREE.Texture | null, settings?: LogoSettings) => void;
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

  // ---- logo on the U-face center sticker ----
  const placeholder = new THREE.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1);
  placeholder.colorSpace = THREE.SRGBColorSpace;
  placeholder.needsUpdate = true;

  const logoOn = uniform(0);
  const logoSize = uniform(new THREE.Vector2(1, 1)); // logo box in cubie-local units
  const logoRot = uniform(new THREE.Vector2(1, 0)); // cos, sin

  const isLogoCubie = home.y
    .greaterThan(0.5)
    .and(abs(home.x).lessThan(0.5))
    .and(abs(home.z).lessThan(0.5));
  const onTop = isY.and(axisSign.greaterThan(0));

  // Face-plane coordinates as seen from above: x to the right, -z is "up" on screen.
  const lp = vec2(p.x, p.z.mul(-1));
  const rp = vec2(
    lp.x.mul(logoRot.x).sub(lp.y.mul(logoRot.y)),
    lp.x.mul(logoRot.y).add(lp.y.mul(logoRot.x)),
  );
  const logoUv = rp.div(logoSize).add(0.5);
  const insideLogo = logoUv.x
    .greaterThan(0)
    .and(logoUv.x.lessThan(1))
    .and(logoUv.y.greaterThan(0))
    .and(logoUv.y.lessThan(1));

  const logoSample = texture(placeholder, logoUv);
  const logoMix = logoSample.a
    .mul(select(insideLogo.and(isLogoCubie).and(onTop), float(1), float(0)))
    .mul(logoOn)
    .mul(stickerMask); // the logo is clipped to the sticker shape

  const material = new THREE.MeshStandardNodeMaterial();
  material.metalness = 0;
  const baseColor = mix(vec3(0.02, 0.02, 0.022), faceColor, stickerMask);
  material.colorNode = mix(baseColor, logoSample.rgb, logoMix);
  material.roughnessNode = mix(float(0.55), float(0.3), stickerMask);

  return {
    material,
    setColors: (next) => {
      for (const f of FACES) {
        const value = next[f];
        if (value) u[f].value.set(value);
      }
    },
    setLogo: (logo, settings = {}) => {
      if (!logo) {
        logoOn.value = 0;
        logoSample.value = placeholder;
        return;
      }
      const image = logo.image as { width?: number; height?: number } | undefined;
      const aspect = image?.width && image?.height ? image.width / image.height : 1;
      const full = STICKER_HALF * 2 * (settings.scale ?? 0.75);
      logoSize.value.set(aspect >= 1 ? full : full * aspect, aspect >= 1 ? full / aspect : full);
      const angle = THREE.MathUtils.degToRad(settings.rotation ?? 0);
      logoRot.value.set(Math.cos(angle), Math.sin(angle));
      logoSample.value = logo;
      logoOn.value = 1;
    },
    dispose: () => {
      placeholder.dispose();
      material.dispose();
    },
  };
}
