import * as THREE from 'three/webgpu';

export type BackendKind = 'webgpu' | 'webgl2';

export interface RendererInit {
  renderer: THREE.WebGPURenderer;
  backend: BackendKind;
}

/** Quick pre-check. Real result is confirmed after renderer.init(). */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Creates a WebGPURenderer. If WebGPU is unavailable, three.js
 * falls back to its WebGL2 backend automatically.
 */
export async function createRenderer(canvas: HTMLCanvasElement): Promise<RendererInit> {
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, alpha: true });
  await renderer.init();

  const isWebGPU = (renderer.backend as unknown as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
  return { renderer, backend: isWebGPU ? 'webgpu' : 'webgl2' };
}
