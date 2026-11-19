import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three/webgpu';
import { createRenderer, type BackendKind } from './core/webgpu';
import { createCube, type CubeObject } from './core/cubies';
import { createLights, frameCamera } from './core/stage';
import { DragControls } from './core/dragControls';
import { CubeInteraction } from './core/cubeInteraction';
import { watchPixelRatio } from './core/dpr';
import { TurnAnimator, type MoveSource } from './core/turnAnimator';
import { formatMoves, parseMoves, type Move } from './core/moves';
import { SOLVED_STATE, validateState } from './core/cubeState';
import { applyState, readState } from './core/sceneState';
import { FACES, resolveColors, type FaceColors } from './core/constants';

export interface LogoOptions {
  /** Image URL (PNG, JPG, WebP, or SVG with width/height). Transparent PNG works best. */
  src: string;
  /** Logo width as a fraction of the sticker; aspect ratio is kept. Default 0.75. */
  scale?: number;
  /** Degrees, clockwise as seen looking at the white face. Default 0. */
  rotation?: number;
}

function normalizeLogo(logo: RubiksCubeProps['logo']): LogoOptions | null {
  if (!logo) return null;
  const options = typeof logo === 'string' ? { src: logo } : logo;
  return options.src ? options : null;
}

export interface RubiksCubeProps {
  /**
   * Sticker colors per face (U R F D L B). Any CSS color. Missing faces use the
   * default primaries: U white, D yellow, F green, B blue, L orange, R red.
   */
  colors?: Partial<FaceColors>;
  /**
   * Logo on the center sticker of the white (U) face. A URL string or options.
   * Default: no logo.
   */
  logo?: string | LogoOptions | null;
  /**
   * Cube state as a 54-character facelet string in U R F D L B order
   * (9 stickers per face, read row by row as seen from outside the face).
   * Defaults to solved. Changing it re-renders the cube in that state instantly.
   */
  state?: string;
  /**
   * Moves to animate, e.g. "R U R' U' F2 M x" or Move objects. They play
   * from the current state whenever the sequence changes (if `autoPlay`).
   */
  moves?: string | readonly Move[];
  /** Play `moves` automatically when they change. Default true. Otherwise call ref.play(). */
  autoPlay?: boolean;
  /** Milliseconds per move. Default 300. */
  moveDuration?: number;
  /** Renderer ready: backend actually in use ('webgpu' or the 'webgl2' fallback). */
  onBackendReady?: (backend: BackendKind) => void;
  /** A queued (API) move started turning. */
  onMoveStart?: (move: Move) => void;
  /** A move finished: played from `moves` / applyMoves ('api') or dragged by the user ('user'). */
  onMoveEnd?: (move: Move, source: MoveSource) => void;
  /** A `moves` / play() / applyMoves() sequence finished (not called if it was cancelled). */
  onSequenceEnd?: () => void;
  /** Facelet string after every finished move. Whole-cube rotations (x y z) are factored out. */
  onStateChange?: (state: string) => void;
  /** Invalid `state` or `moves` props. Without it, errors are logged to the console. */
  onError?: (error: Error) => void;
  className?: string;
}

export interface RubiksCubeHandle {
  /**
   * Queue moves such as "R U R' U' F2 M x" (or Move objects). Supports faces
   * (U D L R F B), wide (u d l r f b or Rw), slices (M E S) and whole-cube
   * rotations (x y z). Resolves true when the last one finishes, false if
   * cancelled. Rejects if the notation is invalid. `duration` = ms per move (0 = instant).
   */
  applyMoves: (moves: string | readonly Move[], options?: { duration?: number }) => Promise<boolean>;
  /** Play the current `moves` prop (useful with autoPlay={false} or to replay). */
  play: () => Promise<boolean>;
  /** Freeze playback. Queued moves wait; a turn in progress stops mid-way. */
  pause: () => void;
  resume: () => void;
  /** Drop queued moves that have not started yet. */
  stop: () => void;
  /** Show this state instantly (cancels any animation). Throws if the state is invalid. */
  setState: (state: string) => void;
  /** Back to solved, instantly. */
  reset: () => void;
  /** Facelet string after the last finished move. */
  getState: () => string;
}

/**
 * Rubik's Cube rendered with Three.js TSL on WebGPU (WebGL2 fallback).
 * Drag the background to rotate freely, drag the cube to turn a layer,
 * Shift/Ctrl/Cmd + drag or two fingers for a whole-cube x/y/z turn.
 */
export const RubiksCube = forwardRef<RubiksCubeHandle, RubiksCubeProps>(function RubiksCube(
  {
    colors,
    logo,
    state,
    moves,
    autoPlay = true,
    moveDuration = 300,
    onBackendReady,
    onMoveStart,
    onMoveEnd,
    onSequenceEnd,
    onStateChange,
    onError,
    className,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<CubeObject | null>(null);
  const animatorRef = useRef<TurnAnimator | null>(null);
  const stateRef = useRef(SOLVED_STATE);

  // Latest props for use inside long-lived callbacks.
  const live = useRef({ colors, logo, state, moves, moveDuration, onBackendReady, onMoveStart, onMoveEnd, onSequenceEnd, onStateChange, onError });
  live.current = { colors, logo, state, moves, moveDuration, onBackendReady, onMoveStart, onMoveEnd, onSequenceEnd, onStateChange, onError };

  const report = (err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    if (live.current.onError) live.current.onError(error);
    else console.error(error);
  };

  /** Instantly show a state. Throws on invalid input. */
  const setStateNow = (value: string) => {
    const cube = cubeRef.current;
    const animator = animatorRef.current;
    if (!cube || !animator) return;
    const check = validateState(value);
    if (!check.ok) throw new Error(check.error);
    animator.cancel();
    applyState(cube, check.state);
    stateRef.current = check.state;
  };

  const run = async (input: string | readonly Move[], duration?: number): Promise<boolean> => {
    const animator = animatorRef.current;
    if (!animator) return false;
    const completed = await animator.enqueue(parseMoves(input), duration);
    if (completed) live.current.onSequenceEnd?.();
    return completed;
  };

  useImperativeHandle(
    ref,
    () => ({
      applyMoves: (input, options) => run(input, options?.duration),
      play: () => (live.current.moves === undefined ? Promise.resolve(true) : run(live.current.moves)),
      pause: () => {
        if (animatorRef.current) animatorRef.current.paused = true;
      },
      resume: () => {
        if (animatorRef.current) animatorRef.current.paused = false;
      },
      stop: () => animatorRef.current?.clearQueue(),
      setState: (value) => setStateNow(value),
      reset: () => setStateNow(SOLVED_STATE),
      getState: () => stateRef.current,
    }),
    [],
  );

  // ---- scene lifecycle (runs once) ----
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

    const cube = createCube(resolveColors(live.current.colors));
    scene.add(cube.group);
    cubeRef.current = cube;

    const animator = new TurnAnimator(cube, live.current.moveDuration);
    animatorRef.current = animator;
    animator.onMoveStart = (move) => live.current.onMoveStart?.(move);
    animator.onMoveEnd = (move, source) => {
      live.current.onMoveEnd?.(move, source);
      stateRef.current = readState(cube);
      live.current.onStateChange?.(stateRef.current);
    };

    // Initial state before the first frame, so there is no solved-cube flash.
    stateRef.current = SOLVED_STATE;
    if (live.current.state !== undefined) {
      try {
        setStateNow(live.current.state);
      } catch (err) {
        report(err);
      }
    }

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

        live.current.onBackendReady?.(backend);
      })
      .catch((err) => console.error('Renderer init failed', err));

    return () => {
      cancelled = true;
      observer?.disconnect();
      unwatchDpr?.();
      interaction.dispose();
      animator.dispose();
      animatorRef.current = null;
      cubeRef.current = null;
      if (renderer) {
        renderer.setAnimationLoop(null);
        renderer.dispose();
      }
      cube.dispose();
      canvas.remove();
    };
  }, []);

  // ---- props -> cube ----
  useEffect(() => {
    if (moveDuration !== undefined && animatorRef.current) animatorRef.current.defaultDuration = moveDuration;
  }, [moveDuration]);

  // `colors` prop changed: uniform update, no rebuild.
  const colorsKey = FACES.map((f) => colors?.[f] ?? '').join('|');
  useEffect(() => {
    cubeRef.current?.setColors(resolveColors(live.current.colors));
  }, [colorsKey]);

  // `logo` image changed: load it (the texture is kept while size/rotation change).
  const logoTexRef = useRef<THREE.Texture | null>(null);
  const logoSrc = normalizeLogo(logo)?.src ?? '';
  useEffect(() => {
    const cube = cubeRef.current;
    if (!cube) return;
    if (!logoSrc) {
      cube.setLogo(null);
      return;
    }

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      logoSrc,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        logoTexRef.current = tex;
        const o = normalizeLogo(live.current.logo);
        cube.setLogo(tex, { scale: o?.scale, rotation: o?.rotation });
      },
      undefined,
      () => {
        if (!cancelled) report(new Error(`Could not load the logo image "${logoSrc}".`));
      },
    );

    return () => {
      cancelled = true;
      cube.setLogo(null);
      logoTexRef.current?.dispose();
      logoTexRef.current = null;
    };
  }, [logoSrc]);

  // `logo.scale` / `logo.rotation` changed: cheap uniform update.
  const logoScale = normalizeLogo(logo)?.scale;
  const logoRotation = normalizeLogo(logo)?.rotation;
  useEffect(() => {
    if (logoTexRef.current) cubeRef.current?.setLogo(logoTexRef.current, { scale: logoScale, rotation: logoRotation });
  }, [logoScale, logoRotation]);

  // `state` prop changed: show it instantly (undefined = solved).
  useEffect(() => {
    try {
      setStateNow(state ?? SOLVED_STATE);
    } catch (err) {
      report(err);
    }
  }, [state]);

  // `moves` prop changed: replace anything still queued and play the new sequence.
  const movesKey = moves === undefined ? null : typeof moves === 'string' ? moves.trim().replace(/\s+/g, ' ') : formatMoves(moves);
  useEffect(() => {
    if (movesKey === null || !autoPlay) return;
    animatorRef.current?.clearQueue();
    run(live.current.moves!).catch(report);
  }, [movesKey, autoPlay]);

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />;
});
