import * as THREE from 'three/webgpu';
import { CUBE_BOUNDING_RADIUS } from './constants';

const VIEW_DIRECTION = new THREE.Vector3(1, 0.85, 1.2).normalize();

/** Positions the camera so the whole cube fits for the given aspect ratio. */
export function frameCamera(camera: THREE.PerspectiveCamera, aspect: number): void {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const limiting = Math.min(vFov, hFov);
  const distance = (CUBE_BOUNDING_RADIUS / Math.sin(limiting / 2)) * 1.25;
  camera.position.copy(VIEW_DIRECTION).multiplyScalar(distance);
  camera.lookAt(0, 0, 0);
}

/** Soft sky/ground fill plus a key and a rim light. */
export function createLights(): THREE.Object3D[] {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.6);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 7, 5);

  const rim = new THREE.DirectionalLight(0xffffff, 0.8);
  rim.position.set(-5, -2, -4);

  return [hemi, key, rim];
}
