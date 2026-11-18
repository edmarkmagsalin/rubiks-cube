import * as THREE from 'three/webgpu';

export interface DragControlsOptions {
  /** Inertia decay rate per second (higher = stops sooner). Default 3. */
  damping?: number;
  /** Max inertia speed in rad/s. Default 12. */
  maxSpeed?: number;
}

/**
 * Free (trackball-style) rotation of `target`, driven by CubeInteraction
 * (it owns the pointer events and calls begin / move / end).
 * Rotation happens around the camera's up/right axes, so every orientation
 * is reachable (no gimbal lock). Releasing while moving keeps spinning and decays.
 */
export class DragControls {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;
  private readonly velocity = new THREE.Vector3(); // rad/s, world space
  private readonly damping: number;
  private readonly maxSpeed: number;
  private readonly target: THREE.Object3D;
  private readonly camera: THREE.Camera;
  private readonly element: HTMLElement;

  // scratch objects (no per-frame allocation)
  private readonly vUp = new THREE.Vector3();
  private readonly vRight = new THREE.Vector3();
  private readonly vRot = new THREE.Vector3();
  private readonly vAxis = new THREE.Vector3();
  private readonly vStep = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();

  constructor(
    target: THREE.Object3D,
    camera: THREE.Camera,
    element: HTMLElement,
    options: DragControlsOptions = {},
  ) {
    this.target = target;
    this.camera = camera;
    this.element = element;
    this.damping = options.damping ?? 3;
    this.maxSpeed = options.maxSpeed ?? 12;
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  begin(x: number, y: number, t: number): void {
    this.dragging = true;
    this.lastX = x;
    this.lastY = y;
    this.lastT = t;
    this.velocity.set(0, 0, 0);
  }

  move(x: number, y: number, t: number): void {
    if (!this.dragging) return;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dt = Math.max((t - this.lastT) / 1000, 1 / 240);
    this.lastX = x;
    this.lastY = y;
    this.lastT = t;

    // Dragging across the element's short side = 180 degrees.
    const size = Math.min(this.element.clientWidth, this.element.clientHeight) || 1;
    const k = Math.PI / size;
    const rot = this.rotationVector(dx * k, dy * k);
    this.applyRotation(rot);

    // Smoothed angular velocity for inertia on release.
    this.vStep.copy(rot).divideScalar(dt);
    this.velocity.lerp(this.vStep, 0.4);
    if (this.velocity.length() > this.maxSpeed) this.velocity.setLength(this.maxSpeed);
  }

  /** Stop dragging. With `inertia` the cube keeps spinning if it was moving when released. */
  end(t: number, inertia = true): void {
    if (!this.dragging) return;
    this.dragging = false;
    // Held still before release (or cancelled) -> no inertia.
    if (!inertia || t - this.lastT > 80) this.velocity.set(0, 0, 0);
  }

  /** Call once per frame with the elapsed time in seconds. */
  update(dt: number): void {
    if (this.dragging) return;
    const speed = this.velocity.length();
    if (speed < 0.02) {
      this.velocity.set(0, 0, 0);
      return;
    }
    this.applyRotation(this.vStep.copy(this.velocity).multiplyScalar(dt));
    this.velocity.multiplyScalar(Math.exp(-dt * this.damping));
  }

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
