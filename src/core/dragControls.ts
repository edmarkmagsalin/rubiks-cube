import * as THREE from 'three/webgpu';

export interface DragControlsOptions {
  /** Inertia decay rate per second (higher = stops sooner). Default 3. */
  damping?: number;
  /** Max inertia speed in rad/s. Default 12. */
  maxSpeed?: number;
}

/**
 * Free (trackball-style) rotation of `target` by mouse drag or touch swipe.
 * Rotation happens around the camera's up/right axes, so every orientation
 * is reachable (full 360 degrees, no gimbal lock). Releasing while moving
 * keeps spinning and decays smoothly.
 */
export class DragControls {
  private pointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;
  private readonly velocity = new THREE.Vector3(); // rad/s, world space
  private readonly damping: number;
  private readonly maxSpeed: number;

  // scratch objects (no per-frame allocation)
  private readonly vUp = new THREE.Vector3();
  private readonly vRight = new THREE.Vector3();
  private readonly vRot = new THREE.Vector3();
  private readonly vAxis = new THREE.Vector3();
  private readonly vStep = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();

  constructor(
    private readonly target: THREE.Object3D,
    private readonly camera: THREE.Camera,
    private readonly element: HTMLElement,
    options: DragControlsOptions = {},
  ) {
    this.damping = options.damping ?? 3;
    this.maxSpeed = options.maxSpeed ?? 12;

    element.style.touchAction = 'none'; // let us handle swipes
    element.style.cursor = 'grab';
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onUp);
    element.addEventListener('pointercancel', this.onUp);
  }

  get isDragging(): boolean {
    return this.pointerId !== null;
  }

  /** Call once per frame with the elapsed time in seconds. */
  update(dt: number): void {
    if (this.isDragging) return;
    const speed = this.velocity.length();
    if (speed < 0.02) {
      this.velocity.set(0, 0, 0);
      return;
    }
    this.applyRotation(this.vStep.copy(this.velocity).multiplyScalar(dt));
    this.velocity.multiplyScalar(Math.exp(-dt * this.damping));
  }

  dispose(): void {
    const el = this.element;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    el.style.cursor = '';
    el.style.touchAction = '';
  }

  private onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null) return; // single pointer only
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointerId = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = e.timeStamp;
    this.velocity.set(0, 0, 0);
    this.element.setPointerCapture(e.pointerId);
    this.element.style.cursor = 'grabbing';
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    const dt = Math.max((e.timeStamp - this.lastT) / 1000, 1 / 240);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = e.timeStamp;

    // Dragging across the element's short side = 180 degrees.
    const size = Math.min(this.element.clientWidth, this.element.clientHeight) || 1;
    const k = Math.PI / size;
    const rot = this.rotationVector(dx * k, dy * k);
    this.applyRotation(rot);

    // Smoothed angular velocity for inertia on release.
    this.vStep.copy(rot).divideScalar(dt);
    this.velocity.lerp(this.vStep, 0.4);
    if (this.velocity.length() > this.maxSpeed) this.velocity.setLength(this.maxSpeed);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.element.hasPointerCapture(e.pointerId)) {
      this.element.releasePointerCapture(e.pointerId);
    }
    this.element.style.cursor = 'grab';
    // Held still before release -> no inertia.
    if (e.timeStamp - this.lastT > 80) this.velocity.set(0, 0, 0);
  };

  /** Screen drag (angles) -> rotation vector in world space. */
  private rotationVector(angleAroundUp: number, angleAroundRight: number): THREE.Vector3 {
    const q = this.camera.quaternion;
    this.vUp.set(0, 1, 0).applyQuaternion(q).multiplyScalar(angleAroundUp);
    this.vRight.set(1, 0, 0).applyQuaternion(q).multiplyScalar(angleAroundRight);
    return this.vRot.copy(this.vUp).add(this.vRight);
  }

  private applyRotation(rotation: THREE.Vector3): void {
    const angle = rotation.length();
    if (angle < 1e-9) return;
    this.vAxis.copy(rotation).divideScalar(angle);
    this.quat.setFromAxisAngle(this.vAxis, angle);
    this.target.quaternion.premultiply(this.quat).normalize();
  }
}
