import { useEffect, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { createRenderer, type BackendKind } from './core/webgpu';

export interface RubiksCubeProps {
  /** Called once the renderer is ready, with the backend actually in use. */
  onBackendReady?: (backend: BackendKind) => void;
  className?: string;
}

/**
 * Phase 1: renderer bootstrap only (WebGPU with WebGL2 fallback).
 * The placeholder mesh is replaced by the real cube in Phase 2.
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
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(5, 4, 6);
    camera.lookAt(0, 0, 0);

    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshNormalMaterial(),
    );
    scene.add(placeholder);

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
        };
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(container);

        renderer.setAnimationLoop(() => {
          placeholder.rotation.y += 0.01;
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
      placeholder.geometry.dispose();
      (placeholder.material as THREE.Material).dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />;
}
