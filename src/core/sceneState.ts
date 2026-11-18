import * as THREE from 'three/webgpu';
import type { CubeObject } from './cubies';
import {
  parseState,
  stateFromCubies,
  type CubiePlacement,
  type Mat3,
  type Vec3,
} from './cubeState';

const tmp = new THREE.Matrix4();
const clean = (n: number): number => Math.round(n) || 0;

/** Reads where every cubie currently sits. Only valid while no layer is mid-turn. */
export function readPlacements(cube: CubeObject): CubiePlacement[] {
  return cube.cubies.map(({ mesh, home }) => {
    tmp.makeRotationFromQuaternion(mesh.quaternion);
    const e = tmp.elements; // column-major
    const rot: Mat3 = [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]].map(clean);
    return {
      home: [home.x, home.y, home.z] as Vec3,
      pos: [clean(mesh.position.x), clean(mesh.position.y), clean(mesh.position.z)] as Vec3,
      rot,
    };
  });
}

/** Facelet string of the cube as it is now (whole-cube rotations factored out). */
export function readState(cube: CubeObject): string {
  return stateFromCubies(readPlacements(cube));
}

/** Puts every cubie where `state` says, instantly. Throws if the state is not valid. */
export function applyState(cube: CubeObject, state: string): void {
  const placements = parseState(state);
  for (const p of placements) {
    const cubie = cube.cubies.find((c) => c.home.x === p.home[0] && c.home.y === p.home[1] && c.home.z === p.home[2]);
    if (!cubie) continue;
    const { mesh } = cubie;
    mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
    tmp.set(p.rot[0], p.rot[1], p.rot[2], 0, p.rot[3], p.rot[4], p.rot[5], 0, p.rot[6], p.rot[7], p.rot[8], 0, 0, 0, 0, 1);
    mesh.quaternion.setFromRotationMatrix(tmp);
    mesh.updateMatrix();
  }
}
