import { useEffect, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { createRenderer, type BackendKind } from './core/webgpu';
import { createCube } from './core/cubies';
import { createLights, frameCamera } from './core/stage';
import { DragControls } from './core/dragControls';
import { watchPixelRatio } from './core/dpr';
import { DEFAULT_COLORS } from './core/constants';

export interface RubiksCubeProps {
  /** Called once the renderer is ready, with the backend actually in use. */
  onBackendReady?: (backend: BackendKind) => void;
  className?: string;
}

/**
 * Phase 3: static solved cube you can rotate 360 degrees by dragging
 * (mouse) or swiping (touch), with inertia. Resize and pixel-ratio aware.
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
    let unwatchDpr: (() => void) | null = null;

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

    const controls = new DragControls(cube.group, camera, canvas);

    createRenderer(canvas)
      .then(({ renderer: r, backend }) => {
        if (cancelled) {
          r.dispose();
          return;
        }
        renderer = r;

        const resize = () => {
          const { clientWidth: w, clientHeight: h } = container;
          if (w === 0 || h === 0) return;
          renderer!.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          frameCamera(camera, camera.aspect);
        };

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(container);
        unwatchDpr = watchPixelRatio((dpr) => {
          renderer!.setPixelRatio(Math.min(dpr, 2));
          resize();
        });

        let last = performance.now();
        renderer.setAnimationLoop(() => {
          const now = performance.now();
          const dt = Math.min((now - last) / 1000, 0.1);
          last = now;
          controls.update(dt);
          renderer!.render(scene, camera);
        });

        onReadyRef.current?.(backend);
      })
      .catch((err) => console.error('Renderer init failed', err));

    return () => {
      cancelled = true;
      observer?.disconnect();
      unwatchDpr?.();
      controls.dispose();
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
