import * as THREE from 'three/webgpu';
import type { CubeObject } from './cubies';
import { MOVE_DEFS, type Move, type MoveSymbol } from './moves';

export type MoveSource = 'api' | 'user';

interface QueueItem {
  move: Move;
  /** ms for this move; 0 = apply instantly. */
  duration: number;
  /** Settles the promise of the batch this move belongs to (set on its last move). */
  done?: (completed: boolean) => void;
}

interface ActiveTurn extends QueueItem {
  elapsed: number;
  axis: THREE.Vector3;
  layer: THREE.Mesh[];
}

/** A turn driven by the user's finger / mouse. */
interface ManualTurn {
  axis: THREE.Vector3; // positive cube axis
  coord: number | null; // layer along the axis, null = whole cube
  layer: THREE.Mesh[];
  angle: number; // radians about +axis
  state: 'drag' | 'settle';
  from: number;
  to: number;
  elapsed: number;
  duration: number;
}

const QUARTER = Math.PI / 2;

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Converts a finished manual turn (quarters about +axis) into standard notation. */
function moveFromTurn(axis: THREE.Vector3, coord: number | null, quarters: number): Move | null {
  const key = axis.x !== 0 ? 'x' : axis.y !== 0 ? 'y' : 'z';
  let symbol: MoveSymbol;
  let q = quarters; // quarters about the move's own axis (see MOVE_DEFS)
  if (coord === null) {
    symbol = key;
  } else if (coord > 0.5) {
    symbol = key === 'x' ? 'R' : key === 'y' ? 'U' : 'F';
  } else if (coord < -0.5) {
    symbol = key === 'x' ? 'L' : key === 'y' ? 'D' : 'B';
    q = -q;
  } else {
    symbol = key === 'x' ? 'M' : key === 'y' ? 'E' : 'S';
    if (key !== 'z') q = -q;
  }
  // Standard direction (amount 1) is a NEGATIVE quarter turn about the move's axis.
  const m = (((-q % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  if (m === 0) return null;
  return { symbol, amount: m === 1 ? 1 : m === 2 ? 2 : -1 };
}

/**
 * Plays face/slice/rotation turns one after another, and also drives
 * user-dragged turns.
 * - Turning cubies are re-parented to a pivot that rotates.
 * - When a turn ends, cubies go back to the cube group and their transforms
 *   are snapped to exact 90-degree multiples (no floating point drift).
 */
export class TurnAnimator {
  /** Default ms per move. */
  defaultDuration: number;
  /** Called when a queued (API) move starts turning. */
  onMoveStart?: (move: Move) => void;
  /** Called after every finished move (API-queued or user-dragged). */
  onMoveEnd?: (move: Move, source: MoveSource) => void;
  /** While true, queued moves hold still (a move already turning freezes mid-turn). */
  paused = false;

  private readonly pivot = new THREE.Group();
  private readonly queue: QueueItem[] = [];
  private current: ActiveTurn | null = null;
  private manual: ManualTurn | null = null;
  private readonly tmpMatrix = new THREE.Matrix4();

  constructor(
    private readonly cube: CubeObject,
    defaultDuration = 300,
  ) {
    this.defaultDuration = defaultDuration;
    cube.group.add(this.pivot);
  }

  /** True while queued/API moves are pending or playing. */
  get isAnimating(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** True while anything (API moves or a user-dragged turn) is turning the cube. */
  get isBusy(): boolean {
    return this.isAnimating || this.manual !== null;
  }

  /**
   * Queue moves. Resolves true when the last of them has finished, or false
   * if they were cancelled first. `duration` overrides the default ms per move
   * for this batch (0 = instant).
   */
  enqueue(moves: readonly Move[], duration?: number): Promise<boolean> {
    const ms = Math.max(0, duration ?? this.defaultDuration);
    if (moves.length === 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      moves.forEach((move, i) => {
        this.queue.push({ move, duration: ms, done: i === moves.length - 1 ? resolve : undefined });
      });
    });
  }

  // ---- user-dragged turns -------------------------------------------------

  /**
   * Start a user turn around a positive cube axis. `coord` is the layer along
   * that axis (-1, 0, 1), or null for the whole cube. Returns false if busy.
   */
  beginManual(axis: THREE.Vector3, coord: number | null): boolean {
    if (this.isBusy) return false;
    const layer = this.cube.cubies
      .map((c) => c.mesh)
      .filter((mesh) => coord === null || Math.abs(mesh.position.dot(axis) - coord) < 0.5);
    this.pivot.quaternion.identity();
    this.pivot.updateMatrixWorld(true);
    for (const mesh of layer) this.pivot.attach(mesh);
    this.manual = {
      axis: axis.clone(),
      coord,
      layer,
      angle: 0,
      state: 'drag',
      from: 0,
      to: 0,
      elapsed: 0,
      duration: 0,
    };
    return true;
  }

  /** Follow the pointer: absolute angle in radians about the +axis. */
  setManualAngle(angle: number): void {
    const m = this.manual;
    if (!m || m.state !== 'drag') return;
    m.angle = angle;
    this.pivot.quaternion.setFromAxisAngle(m.axis, angle);
  }

  /**
   * Let go. Settles to the nearest quarter turn (a flick can carry it to the
   * next one). `velocity` is the angular speed in rad/s about +axis.
   */
  releaseManual(velocity: number): void {
    const m = this.manual;
    if (!m || m.state !== 'drag') return;
    const cur = m.angle / QUARTER;
    let target = Math.round((m.angle + velocity * 0.12) / QUARTER);
    target = Math.min(Math.max(target, Math.floor(cur)), Math.ceil(cur));
    m.state = 'settle';
    m.from = m.angle;
    m.to = target * QUARTER;
    m.elapsed = 0;
    m.duration = 120 + 160 * Math.abs(target - cur);
  }

  /** Drop queued moves that have not started. The move already turning finishes. */
  clearQueue(): void {
    for (const item of this.queue) item.done?.(false);
    this.queue.length = 0;
  }

  /**
   * Hard stop: abandon everything, including a half-turned layer. Only use it
   * right before the cube's pieces are overwritten (setState / reset / dispose).
   */
  cancel(): void {
    // Pivot back to identity first: the half-turned layer snaps back to where it started.
    if (this.manual) {
      this.pivot.quaternion.identity();
      this.commit(this.manual.layer);
      this.manual = null;
    }
    if (this.current) {
      this.pivot.quaternion.identity();
      this.commit(this.current.layer);
      this.current.done?.(false);
      this.current = null;
    }
    this.clearQueue();
  }

  // ---- frame update -------------------------------------------------------

  /** Advance the animation. Call once per frame with elapsed milliseconds. */
  update(dtMs: number): void {
    if (this.manual) {
      this.updateManual(dtMs);
      if (this.manual) return; // still dragging or settling: queued moves wait
    }
    if (this.paused) return;

    let budget = dtMs;
    for (;;) {
      if (!this.current && !this.startNext()) return;
      const cur = this.current!;

      if (cur.duration <= 0) {
        this.finish();
        continue;
      }
      const need = cur.duration - cur.elapsed;
      if (budget < need) {
        cur.elapsed += budget;
        this.applyProgress(cur, cur.elapsed / cur.duration);
        return;
      }
      budget -= need; // carry leftover time into the next move: no stutter between moves
      this.finish();
    }
  }

  dispose(): void {
    this.cancel();
    this.cube.group.remove(this.pivot);
  }

  // ---- internals ----------------------------------------------------------

  private updateManual(dtMs: number): void {
    const m = this.manual!;
    if (m.state !== 'settle') return;
    m.elapsed += dtMs;
    const t = Math.min(m.elapsed / m.duration, 1);
    m.angle = m.from + (m.to - m.from) * easeOutCubic(t);
    this.pivot.quaternion.setFromAxisAngle(m.axis, m.angle);
    if (t < 1) return;

    this.pivot.quaternion.setFromAxisAngle(m.axis, m.to);
    this.commit(m.layer);
    this.manual = null;

    const move = moveFromTurn(m.axis, m.coord, Math.round(m.to / QUARTER));
    if (move) this.onMoveEnd?.(move, 'user');
  }

  private startNext(): boolean {
    const item = this.queue.shift();
    if (!item) return false;

    const def = MOVE_DEFS[item.move.symbol];
    const axis = new THREE.Vector3(def.axis[0], def.axis[1], def.axis[2]);

    // Layer = cubies currently at the requested distance(s) along the axis.
    const layer = this.cube.cubies
      .map((c) => c.mesh)
      .filter((mesh) => {
        const d = mesh.position.dot(axis);
        return def.layers.some((v) => Math.abs(d - v) < 0.5);
      });

    this.current = { ...item, elapsed: 0, axis, layer };
    this.pivot.quaternion.identity();
    this.pivot.updateMatrixWorld(true);
    for (const mesh of layer) this.pivot.attach(mesh);
    this.onMoveStart?.(item.move);
    return true;
  }

  private applyProgress(turn: ActiveTurn, t: number): void {
    // Standard direction = clockwise seen from the axis tip = negative rotation about the axis.
    const angle = -turn.move.amount * QUARTER * easeInOutCubic(Math.min(t, 1));
    this.pivot.quaternion.setFromAxisAngle(turn.axis, angle);
  }

  private finish(): void {
    const turn = this.current!;
    this.applyProgress(turn, 1);
    this.commit(turn.layer);
    this.current = null;
    this.onMoveEnd?.(turn.move, 'api');
    turn.done?.(true);
  }

  /** Return the layer's cubies to the cube group and snap them to the grid. */
  private commit(layer: THREE.Mesh[]): void {
    this.pivot.updateMatrixWorld(true);
    for (const mesh of layer) {
      this.cube.group.attach(mesh);
      this.snap(mesh);
    }
    this.pivot.quaternion.identity();
  }

  /** Round position to the integer grid and orientation to the nearest 90-degree rotation. */
  private snap(mesh: THREE.Mesh): void {
    mesh.position.set(
      Math.round(mesh.position.x) || 0,
      Math.round(mesh.position.y) || 0,
      Math.round(mesh.position.z) || 0,
    );
    this.tmpMatrix.makeRotationFromQuaternion(mesh.quaternion);
    const e = this.tmpMatrix.elements;
    for (let i = 0; i < e.length; i++) e[i] = Math.round(e[i]) || 0;
    mesh.quaternion.setFromRotationMatrix(this.tmpMatrix);
    mesh.updateMatrix();
  }
}
