# Rubik's Cube (React + Three.js TSL + WebGPU)

## Description
A reusable React component that renders an interactive 3x3 Rubik's Cube using
Three.js `WebGPURenderer` and Three Shading Language (TSL) node materials.
Built with Vite.

- Drag / swipe to inspect the cube 360 degrees
- Smooth, eased layer turns (never snap)
- Customizable colors (default: W/Y/G/B/O/R) and optional logo on the white face
- Render any cube state; animate a sequence of moves at a given speed

## Proposed Public API (draft)

```tsx
<RubiksCube
  state="UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB" // optional, default solved
  moves="R U R' U' F2"            // optional, string or Move[]
  moveDuration={300}              // ms per quarter turn (or speed multiplier)
  autoPlay                        // play `moves` on mount / change
  colors={{ U: '#fff', D: '#ffd500', F: '#009b48', B: '#0046ad', L: '#ff5900', R: '#b71234' }}
  logo={{ src: '/logo.png', scale: 0.6, rotation: 0 }} // optional, white face only
  onMoveStart / onMoveEnd / onSequenceEnd
  ref -> { applyMoves(), reset(), setState(), pause(), resume() }
/>
```

- State format: 54-char facelet string, order U R F D L B (Kociemba standard)
- Move notation: U D L R F B, with `'` and `2` (wide/slice moves: later)
- White = U face (logo sits on the white center)

## Architecture (draft)
- `src/RubiksCube.tsx` - React wrapper, props, imperative handle
- `src/core/cubeModel.ts` - state <-> facelets, move parsing, permutations
- `src/core/scene.ts` - WebGPURenderer, camera, resize, render loop
- `src/core/cubies.ts` - 26 rounded cubies, sticker materials
- `src/core/stickerMaterial.ts` - TSL node material (sticker mask, color, logo)
- `src/core/turnAnimator.ts` - move queue, pivot group, easing, commit
- `src/core/dragControls.ts` - pointer/touch trackball rotation with inertia
- `src/demo/App.tsx` - demo playground (controls for state/moves/colors/logo)

## Todo

### Phase 0 - Planning
- [x] Gather requirements
- [x] Write plan + draft API (this file)
- [x] Resolve pending decisions (see Decisions below)

### Phase 1 - Scaffold
- [x] Vite + React + TypeScript project setup
- [x] Declare `three`, `lucide-react` dependencies (run `npm install`)
- [x] WebGPU init + capability check + WebGL2 fallback info notice
- [x] Demo page shell (header, backend badge, stage)
- [x] Verify Phase 1 locally (`npm install && npm run dev`) - confirmed

### Phase 2 - Static cube
- [x] Cubie geometry (rounded box) x 26 + dark inner core
- [x] TSL sticker material (rounded sticker mask, dark plastic body)
- [x] Default colors via uniforms (`setColors` ready for Phase 6)
- [x] Lighting + camera framing
- [x] Verify Phase 2 locally (colors, sticker shape, lighting, WebGPU + WebGL2) - confirmed

### Phase 3 - Interaction
- [x] Drag / swipe 360 degree rotation (mouse + touch)
- [x] Inertia / damping
- [x] Resize + DPR handling (ResizeObserver + pixel-ratio watcher)
- [x] Verify Phase 3 locally (mouse drag, touch swipe, inertia feel, browser zoom) - confirmed

### Phase 4 - Turning
- [x] Move parser: faces U D L R F B, wide (u d l r f b or Rw), slices M E S, whole-cube x y z; suffixes ' and 2 (also 2' and typographic primes)
- [x] Layer selection + pivot group
- [x] Eased animation (ease-in-out cubic on axis-angle; chosen over slerp because half turns are ambiguous for slerp)
- [x] Move queue (leftover frame time carries into the next move, no stutter)
- [x] Commit rotation back to cubies, snapped to the 90-degree grid (no drift)
- [x] Minimal `applyMoves()` ref handle + `moveDuration` prop (needed to test; rest of API in Phase 5)
- [x] Demo controls: 18 move buttons, sequence input, scramble, speed slider
- [x] Whole-cube rotations (x y z), middle slices (M E S) and wide moves (round 2 feedback)
- [x] Fix: black slab visible during turns (inner core was larger than the turning layer; now small enough to stay hidden)
- [x] Demo: removed the 18 move buttons (sequence input, Scramble and speed slider kept)
- [ ] Verify Phase 4 (round 2): no black slab, slices and x y z turn correctly, long scrambles stay aligned - needs your confirmation

### Phase 4b - Manual layer turning by drag
- [x] Raycast to find the grabbed cubie, face and point
- [x] Drag direction on the grabbed face picks the axis and layer (works for outer layers and middle slices)
- [x] Layer follows the finger/mouse; on release it settles to the nearest quarter turn (a flick can carry to the next one)
- [x] Background drag = free 360 rotation with inertia (kept)
- [x] Whole-cube turn locked to x / y / z: Shift/Ctrl/Cmd + drag (desktop), two-finger drag (touch)
- [x] Animator manual-turn API; programmatic moves wait while the user is turning, user drags are ignored while moves play
- [x] `onMoveEnd(move, source)` callback ('api' or 'user'); dragged turns are reported in standard notation
- [x] Demo shows the last move and the gesture hints
- [ ] Verify Phase 4b: layer drag direction/feel, middle slices, Shift/Ctrl whole-cube lock, two-finger turn, flick, background rotation - needs your confirmation

### Phase 5 - State and sequences
- [ ] `state` prop (facelet string) + validation
- [ ] `moves` prop with duration / speed
- [ ] Imperative handle + callbacks
- [ ] Solved default

### Phase 6 - Customization
- [ ] `colors` prop
- [ ] `logo` prop (texture on white center, TSL texture node)
- [ ] Default = no logo

### Phase 7 - Polish
- [ ] Cleanup / dispose on unmount
- [ ] Tests for model (moves, state)
- [ ] README + usage docs
- [ ] Library build mode (publishable component)

## Decisions (resolved)
1. TypeScript
2. Vanilla Three.js inside React hooks (no react-three-fiber)
3. WebGL2 fallback when WebGPU is unavailable, with an info notice shown
4. Logo on the white center sticker only
5. Speed prop in ms per move
6. App component first (library packaging later)
7. Manual layer turning by drag: yes. Drag on the cube turns that layer; drag on the background rotates the whole cube freely.
8. Whole-cube turn gesture: two-finger drag on touch; on desktop, holding Shift or Ctrl while dragging locks the drag to a whole-cube x/y/z turn.

## Pending Decisions
1. Facelet string format for the `state` prop (Phase 5): 54 characters in URFDLB order (Kociemba standard). Not yet confirmed.

## Progress Log
- Planning: plan drafted, decisions resolved
- Phase 1: scaffold created (Vite + React + TS), renderer bootstrap with WebGPU/WebGL2 fallback notice, placeholder spinning box. Verified locally by user.
- Phase 2: 26 rounded cubies, shared TSL sticker material (colors via uniforms, per-cubie `home` attribute decides which faces have stickers), lights, camera framing. Temporary auto-rotate for inspection (removed in Phase 3). Verified locally by user.
- Phase 3: trackball drag/swipe around camera axes (no gimbal lock) with inertia, single-pointer, `touch-action: none`; DPR change watcher; temporary auto-rotate removed; drag hint in demo. Verified locally by user.
- Phase 4: `moves.ts` (parser, formatter, random scramble), `turnAnimator.ts` (queue, pivot, easing, snap), ref handle `applyMoves()`, demo controls. Round 1 feedback: black slab during turns, need slices/wide/x y z, remove move buttons.
- Phase 4 round 2: new move table in `moves.ts` (axis + layers per symbol), animator reads it; core shrunk to 0.9; move buttons removed. Round 2 not yet confirmed.
- Phase 4b: new `cubeInteraction.ts` owns pointer input (layer drag, background free rotation, modifier/two-finger whole-cube turn); `turnAnimator.ts` gets manual turn API + `onMoveEnd`; `dragControls.ts` now only does free rotation. Not yet run locally.
