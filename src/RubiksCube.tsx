import { useEffect, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { createRenderer, type BackendKind } from './core/webgpu';
import { createCube } from './core/cubies';
import { createLights, frameCamera } from './core/stage';
import { DEFAULT_COLORS } from './core/constants';

export interface RubiksCubeProps {
  /** Called once the renderer is ready, with the backend actually in use. */
  onBackendReady?: (backend: BackendKind) => void;
  className?: string;
}

/**
 * Phase 2: static solved cube (26 cubies, TSL sticker material, lights, framing).
 * A slow auto-rotation is TEMPORARY so every face can be checked; it is
 * replaced by drag controls in Phase 3.
 */
export function RubiksCube({ onBackendReady, className }: RubiksCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onBackendReady);
  onReadyRef.current = onBackendReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let renderer: THREE.WebGPURenderer | null = null;
    let observer: ResizeObserver | null = null;

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    frameCamera(camera, 1);
    createLights().forEach((light) => scene.add(light));

    const cube = createCube(DEFAULT_COLORS);
    scene.add(cube.group);

    createRenderer(canvas)
      .then(({ renderer: r, backend }) => {
        if (cancelled) {
          r.dispose();
          return;
        }
        renderer = r;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const resize = () => {
          const { clientWidth: w, clientHeight: h } = container;
          if (w === 0 || h === 0) return;
          renderer!.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          frameCamera(camera, camera.aspect);
        };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(container);

        renderer.setAnimationLoop(() => {
          cube.group.rotation.y += 0.004; // TEMPORARY (Phase 3 replaces this)
          renderer!.render(scene, camera);
        });

        onReadyRef.current?.(backend);
      })
      .catch((err) => console.error('Renderer init failed', err));

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
      }
      cube.dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
