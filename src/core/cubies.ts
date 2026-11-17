import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CORE_SIZE, CUBIE_RADIUS, CUBIE_SIZE, type FaceColors } from './constants';
import { createStickerMaterial } from './stickerMaterial';

export interface Cubie {
  mesh: THREE.Mesh;
  /** Solved-position grid coordinates (-1, 0, 1). Never changes. */
  home: THREE.Vector3;
}

export interface CubeObject {
  group: THREE.Group;
  cubies: Cubie[];
  setColors: (colors: Partial<FaceColors>) => void;
  dispose: () => void;
}

/** Builds the 26 cubies (solved state) plus a dark inner core that hides gaps. */
export function createCube(colors: FaceColors): CubeObject {
  const group = new THREE.Group();
  const sticker = createStickerMaterial(colors);
  const base = new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 4, CUBIE_RADIUS);
  const vertexCount = base.getAttribute('position').count;

  const cubies: Cubie[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;

        // Share the heavy attributes, own only the per-cubie `home` attribute.
        const geometry = new THREE.BufferGeometry();
        geometry.setIndex(base.getIndex());
        geometry.setAttribute('position', base.getAttribute('position'));
        geometry.setAttribute('normal', base.getAttribute('normal'));
        geometry.setAttribute('uv', base.getAttribute('uv'));

        const home = new Float32Array(vertexCount * 3);
        for (let i = 0; i < vertexCount; i++) {
          home[i * 3] = x;
          home[i * 3 + 1] = y;
          home[i * 3 + 2] = z;
        }
        geometry.setAttribute('home', new THREE.BufferAttribute(home, 3));
        geometries.push(geometry);

        const mesh = new THREE.Mesh(geometry, sticker.material);
        mesh.position.set(x, y, z);
        group.add(mesh);
        cubies.push({ mesh, home: new THREE.Vector3(x, y, z) });
      }
    }
  }

  const coreGeometry = new THREE.BoxGeometry(CORE_SIZE, CORE_SIZE, CORE_SIZE);
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x050506 });
  group.add(new THREE.Mesh(coreGeometry, coreMaterial));

  return {
    group,
    cubies,
    setColors: sticker.setColors,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      base.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      sticker.dispose();
    },
  };
}
