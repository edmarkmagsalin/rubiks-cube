import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { createRenderer, type BackendKind } from './core/webgpu';
import { createCube } from './core/cubies';
import { createLights, frameCamera } from './core/stage';
import { DragControls } from './core/dragControls';
import { CubeInteraction } from './core/cubeInteraction';
import { watchPixelRatio } from './core/dpr';
import { TurnAnimator, type MoveSource } from './core/turnAnimator';
import { parseMoves, type Move } from './core/moves';
import { DEFAULT_COLORS } from './core/constants';

export interface RubiksCubeProps {
  /** Called once the renderer is ready, with the backend actually in use. */
  onBackendReady?: (backend: BackendKind) => void;
  /** Default duration of one move in milliseconds. Default 300. */
  moveDuration?: number;
  /** Fired after every finished move: from `applyMoves` ('api') or dragged by the user ('user'). */
  onMoveEnd?: (move: Move, source: MoveSource) => void;
  className?: string;
}

export interface RubiksCubeHandle {
  /**
   * Queue moves such as "R U R' U' F2 M x" (or Move objects). Supports faces
   * (U D L R F B), wide (u d l r f b or Rw), slices (M E S) and whole-cube
   * rotations (x y z). Resolves when the
   * last one finishes. `duration` overrides ms per move (0 = instant).
   * Rejects if the notation is invalid.
   */
  applyMoves: (moves: string | readonly Move[], options?: { duration?: number }) => Promise<void>;
}

/**
 * Phase 4b: rotatable cube that plays eased turns (faces, slices, wide, x y z)
 * and can be turned by hand: drag a layer, drag the background to rotate freely,
 * Shift/Ctrl/Cmd + drag or two fingers for a whole-cube x/y/z turn.
 * Use the ref handle's applyMoves(). Props for state/moves come in Phase 5.
 */
export const RubiksCube = forwardRef<RubiksCubeHandle, RubiksCubeProps>(function RubiksCube(
  { onBackendReady, moveDuration = 300, onMoveEnd, className },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onBackendReady);
  onReadyRef.current = onBackendReady;
  const onMoveEndRef = useRef(onMoveEnd);
  onMoveEndRef.current = onMoveEnd;
  const durationRef = useRef(moveDuration);
  durationRef.current = moveDuration;
  const animatorRef = useRef<TurnAnimator | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      applyMoves: async (moves, options) => {
        const animator = animatorRef.current;
        if (!animator) return;
        await animator.enqueue(parseMoves(moves), options?.duration);
      },
    }),
    [],
  );

  useEffect(() => {
    if (animatorRef.current) animatorRef.current.defaultDuration = moveDuration;
  }, [moveDuration]);

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

    const animator = new TurnAnimator(cube, durationRef.current);
    animator.onMoveEnd = (move, source) => onMoveEndRef.current?.(move, source);
    animatorRef.current = animator;
    const free = new DragControls(cube.group, camera, canvas);
    const interaction = new CubeInteraction(cube, animator, camera, canvas, free);

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
          free.update(dt);
          animator.update(dt * 1000);
          renderer!.render(scene, camera);
        });

        onReadyRef.current?.(backend);
      })
      .catch((err) => console.error('Renderer init failed', err));

    return () => {
      cancelled = true;
      observer?.disconnect();
      unwatchDpr?.();
      interaction.dispose();
      animator.dispose();
      animatorRef.current = null;
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
      }
      cube.dispose();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />;
});
