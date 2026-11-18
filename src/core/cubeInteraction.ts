import * as THREE from 'three/webgpu';
import type { CubeObject } from './cubies';
import type { DragControls } from './dragControls';
import type { TurnAnimator } from './turnAnimator';

interface Pt {
  x: number;
  y: number;
}

/** What the pointer grabbed, in the cube's own frame. */
interface Hit {
  normal: THREE.Vector3; // axis-aligned outward normal of the grabbed face
  point: THREE.Vector3; // grabbed point
  cubiePos: THREE.Vector3; // grid position of the grabbed cubie
}

/** How a drag maps to a turn. */
interface TurnSetup {
  axis: THREE.Vector3; // positive cube axis
  coord: number | null; // layer along the axis, null = whole cube
  dir: Pt; // unit screen direction in which a POSITIVE rotation moves the grabbed point
  pxPerUnit: number; // screen pixels per world unit along `dir`
  radius: number; // distance of the grabbed point from the axis
}

type Mode = 'idle' | 'free' | 'pending' | 'turn' | 'ignored';

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const isModifier = (e: PointerEvent): boolean => e.shiftKey || e.ctrlKey || e.metaKey;

/**
 * Owns all pointer input on the canvas:
 * - drag on the background            -> free 360 rotation (DragControls, with inertia)
 * - drag on the cube                  -> turns the grabbed layer, following the finger
 * - Shift/Ctrl/Cmd + drag, or two fingers -> whole-cube turn locked to one axis (x, y or z)
 * Released turns settle to the nearest quarter turn.
 */
export class CubeInteraction {
  private mode: Mode = 'idle';
  private readonly pointers = new Map<number, Pt>();
  private start: Pt = { x: 0, y: 0 };
  private hit: Hit | null = null;
  private wholeCube = false;

  private turn: TurnSetup | null = null;
  private origin: Pt = { x: 0, y: 0 };
  private lastAngle = 0;
  private lastT = 0;
  private angVel = 0;

  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly meshes: THREE.Mesh[];

  constructor(
    private readonly cube: CubeObject,
    private readonly animator: TurnAnimator,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly element: HTMLElement,
    private readonly free: DragControls,
  ) {
    this.meshes = cube.cubies.map((c) => c.mesh);
    element.style.touchAction = 'none'; // we handle swipes ourselves
    element.style.cursor = 'grab';
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onUp);
    element.addEventListener('pointercancel', this.onCancel);
    element.addEventListener('contextmenu', this.onContextMenu); // Ctrl+click on macOS
  }

  dispose(): void {
    const el = this.element;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onCancel);
    el.removeEventListener('contextmenu', this.onContextMenu);
    el.style.cursor = '';
    el.style.touchAction = '';
  }

  // ---- pointer events -----------------------------------------------------

  private onContextMenu = (e: Event): void => e.preventDefault();

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.element.setPointerCapture(e.pointerId);
    const pt = this.toLocal(e);
    this.pointers.set(e.pointerId, pt);
    this.element.style.cursor = 'grabbing';

    if (this.pointers.size === 1) {
      this.start = pt;
      this.hit = this.pick(pt);
      this.wholeCube = isModifier(e);
      if (this.hit || this.wholeCube) {
        this.mode = 'pending';
      } else {
        this.mode = 'free';
        this.free.begin(pt.x, pt.y, e.timeStamp);
      }
      return;
    }

    if (this.pointers.size === 2) {
      // Second finger: whole-cube gesture.
      if (this.mode === 'turn') {
        this.finishTurn(e.timeStamp, true);
        this.mode = 'ignored';
        return;
      }
      if (this.mode === 'ignored') return;
      if (this.mode === 'free') this.free.end(e.timeStamp, false);
      const c = this.centroid();
      this.start = c;
      this.hit = this.pick(c);
      this.wholeCube = true;
      this.mode = 'pending';
    }
    // 3+ pointers: ignored
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    const pt = this.toLocal(e);
    this.pointers.set(e.pointerId, pt);
    const cur = this.pointers.size > 1 ? this.centroid() : pt;

    if (this.mode === 'free') {
      this.free.move(cur.x, cur.y, e.timeStamp);
    } else if (this.mode === 'pending') {
      const threshold = e.pointerType === 'mouse' ? 5 : 8;
      if (Math.hypot(cur.x - this.start.x, cur.y - this.start.y) >= threshold) this.beginTurn(cur, e);
    } else if (this.mode === 'turn') {
      this.updateTurn(cur, e.timeStamp);
    }
  };

  private onUp = (e: PointerEvent): void => this.release(e, false);
  private onCancel = (e: PointerEvent): void => this.release(e, true);

  private release(e: PointerEvent, cancelled: boolean): void {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.element.hasPointerCapture(e.pointerId)) this.element.releasePointerCapture(e.pointerId);

    if (this.mode === 'free') this.free.end(e.timeStamp, !cancelled);
    else if (this.mode === 'turn') this.finishTurn(e.timeStamp, cancelled);

    if (this.pointers.size === 0) {
      this.mode = 'idle';
      this.hit = null;
      this.wholeCube = false;
      this.element.style.cursor = 'grab';
    } else {
      this.mode = 'ignored'; // remaining finger does nothing until all are up
    }
  }

  // ---- turning ------------------------------------------------------------

  private beginTurn(cur: Pt, e: PointerEvent): void {
    const whole = this.wholeCube || isModifier(e);
    const dx = cur.x - this.start.x;
    const dy = cur.y - this.start.y;
    const setup = this.hit ? this.fromHit(this.hit, dx, dy, whole) : this.fromScreen(dx, dy);

    if (!setup) {
      // Could not work out a turn: fall back to free rotation when possible.
      if (this.pointers.size === 1 && !whole) {
        this.mode = 'free';
        this.free.begin(cur.x, cur.y, e.timeStamp);
      } else {
        this.mode = 'ignored';
      }
      return;
    }
    if (!this.animator.beginManual(setup.axis, setup.coord)) {
      this.mode = 'ignored'; // cube is busy playing moves
      return;
    }
    this.turn = setup;
    this.origin = cur;
    this.lastAngle = 0;
    this.angVel = 0;
    this.lastT = e.timeStamp;
    this.mode = 'turn';
  }

  private updateTurn(cur: Pt, t: number): void {
    const s = this.turn!;
    const along = (cur.x - this.origin.x) * s.dir.x + (cur.y - this.origin.y) * s.dir.y;
    const angle = along / (s.pxPerUnit * s.radius);
    this.animator.setManualAngle(angle);

    const dt = Math.max((t - this.lastT) / 1000, 1 / 240);
    this.angVel += ((angle - this.lastAngle) / dt - this.angVel) * 0.4;
    this.lastAngle = angle;
    this.lastT = t;
  }

  private finishTurn(t: number, cancelled: boolean): void {
    if (!this.turn) return;
    if (cancelled || t - this.lastT > 80) this.angVel = 0; // held still -> no flick
    this.animator.releaseManual(this.angVel);
    this.turn = null;
  }

  /** Drag started on the cube: pick the axis from the drag direction on the grabbed face. */
  private fromHit(hit: Hit, dx: number, dy: number, whole: boolean): TurnSetup | null {
    const group = this.cube.group;
    group.updateMatrixWorld(true);
    this.camera.updateMatrixWorld();

    const pointWorld = group.localToWorld(hit.point.clone());
    const p0 = this.project(pointWorld);
    const dragLen = Math.hypot(dx, dy);
    if (dragLen < 1e-6) return null;

    let best: TurnSetup | null = null;
    let bestScore = -1;
    for (const axis of AXES) {
      if (Math.abs(axis.dot(hit.normal)) > 0.5) continue; // must lie in the grabbed face plane

      // A positive rotation about `axis` moves the grabbed point along axis x normal.
      const tangent = new THREE.Vector3().crossVectors(axis, hit.normal).applyQuaternion(group.quaternion);
      const p1 = this.project(pointWorld.clone().addScaledVector(tangent, 0.5));
      const sx = p1.x - p0.x;
      const sy = p1.y - p0.y;
      const len = Math.hypot(sx, sy);
      if (len < 1e-3) continue;

      const score = Math.abs(dx * sx + dy * sy) / (dragLen * len);
      if (score > bestScore) {
        bestScore = score;
        const radius = hit.point.clone().addScaledVector(axis, -hit.point.dot(axis)).length();
        best = {
          axis,
          coord: whole ? null : Math.round(hit.cubiePos.dot(axis)),
          dir: { x: sx / len, y: sy / len },
          pxPerUnit: len / 0.5,
          radius: Math.max(radius, 1),
        };
      }
    }
    // Edge-on faces give tiny screen vectors: refuse so we can fall back.
    return best && best.pxPerUnit > 8 ? best : null;
  }

  /** Whole-cube turn started on the background: lock to the cube axis closest to the drag. */
  private fromScreen(dx: number, dy: number): TurnSetup | null {
    const group = this.cube.group;
    const q = this.camera.quaternion;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const reference = horizontal ? up : right;

    let best: THREE.Vector3 | null = null;
    let bestDot = 0;
    for (const axis of AXES) {
      const d = axis.clone().applyQuaternion(group.quaternion).dot(reference);
      if (Math.abs(d) > Math.abs(bestDot)) {
        bestDot = d;
        best = axis;
      }
    }
    if (!best) return null;

    const sign = bestDot >= 0 ? 1 : -1;
    const size = Math.min(this.element.clientWidth, this.element.clientHeight) || 1;
    return {
      axis: best,
      coord: null,
      // dragging right (or down) rotates positively about camera up (or right)
      dir: horizontal ? { x: sign, y: 0 } : { x: 0, y: sign },
      pxPerUnit: size / Math.PI,
      radius: 1,
    };
  }

  // ---- helpers ------------------------------------------------------------

  private toLocal(e: PointerEvent): Pt {
    const rect = this.element.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private centroid(): Pt {
    let x = 0;
    let y = 0;
    for (const p of this.pointers.values()) {
      x += p.x;
      y += p.y;
    }
    const n = this.pointers.size || 1;
    return { x: x / n, y: y / n };
  }

  private project(world: THREE.Vector3): Pt {
    const v = world.clone().project(this.camera);
    return {
      x: ((v.x + 1) / 2) * this.element.clientWidth,
      y: ((1 - v.y) / 2) * this.element.clientHeight,
    };
  }

  /** Raycast the cubies; returns the grabbed face/point/cubie in the cube's frame. */
  private pick(pt: Pt): Hit | null {
    this.ndc.set((pt.x / this.element.clientWidth) * 2 - 1, -(pt.y / this.element.clientHeight) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    if (hits.length === 0) return null;

    const h = hits[0];
    const mesh = h.object as THREE.Mesh;

    // Dominant axis of the hit in the cubie's local frame = which cubie face was grabbed.
    const local = mesh.worldToLocal(h.point.clone());
    const ax = Math.abs(local.x);
    const ay = Math.abs(local.y);
    const az = Math.abs(local.z);
    const normal = new THREE.Vector3();
    if (ax >= ay && ax >= az) normal.x = Math.sign(local.x);
    else if (ay >= az) normal.y = Math.sign(local.y);
    else normal.z = Math.sign(local.z);

    // Local -> cube frame (the cubie's orientation), rounded to a clean axis.
    normal.applyQuaternion(mesh.quaternion);
    normal.set(Math.round(normal.x) || 0, Math.round(normal.y) || 0, Math.round(normal.z) || 0);

    return {
      normal,
      point: this.cube.group.worldToLocal(h.point.clone()),
      cubiePos: mesh.position.clone().round(),
    };
  }
}
