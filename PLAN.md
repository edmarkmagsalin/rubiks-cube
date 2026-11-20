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
- [x] Verify Phase 4 (round 2): no black slab, slices and x y z turn correctly, long scrambles stay aligned - confirmed

### Phase 4b - Manual layer turning by drag
- [x] Raycast to find the grabbed cubie, face and point
- [x] Drag direction on the grabbed face picks the axis and layer (works for outer layers and middle slices)
- [x] Layer follows the finger/mouse; on release it settles to the nearest quarter turn (a flick can carry to the next one)
- [x] Background drag = free 360 rotation with inertia (kept)
- [x] Whole-cube turn locked to x / y / z: Shift/Ctrl/Cmd + drag (desktop), two-finger drag (touch)
- [x] Animator manual-turn API; programmatic moves wait while the user is turning, user drags are ignored while moves play
- [x] `onMoveEnd(move, source)` callback ('api' or 'user'); dragged turns are reported in standard notation
- [x] Demo shows the last move and the gesture hints
- [x] Verify Phase 4b: layer drag, slices, whole-cube lock, two-finger turn - confirmed (feels natural)

### Phase 5 - State and sequences
- [x] `state` prop (54-char facelet string, URFDLB) with validation: length, letters, 9 of each color, impossible pieces, mirrored corners, and solvability (twist, flip, parity)
- [x] `moves` prop (+ `autoPlay`, default true) plays from the current state when the sequence changes; `moveDuration` = ms per move
- [x] Imperative handle: applyMoves, play, pause, resume, stop, setState, reset, getState
- [x] Callbacks: onMoveStart, onMoveEnd, onSequenceEnd, onStateChange, onError
- [x] Solved default; state shown before the first frame (no solved flash)
- [x] Pure cube model tested outside the browser (random scrambles round-trip, known R facelet string, invalid states rejected)
- [x] Demo: set state, reset, pause/resume, live state read-out, `?state=...&moves=...` URL to try the props
- [x] Verify Phase 5 locally (set state, reset, pause/resume, URL props, state read-out) - confirmed

### Phase 6 - Customization
- [x] `colors` prop: partial map per face (U R F D L B), any CSS color, missing faces use the defaults; uniform update, no shader rebuild
- [x] `logo` prop on the white (U) center sticker only: URL string or `{ src, scale, rotation }`; TSL texture node, aspect ratio kept (contain), clipped to the sticker, rotates with the center piece
- [x] Default = no logo; removing the prop clears it
- [x] Changing size/rotation is a cheap uniform update (image is not reloaded); load failures go to `onError`
- [x] Demo: six color pickers + default colors, logo upload, sample logo, remove, size and rotation sliders
- [x] Verify Phase 6 locally (custom colors, logo upload/remove, size/rotation, logo stays on the white center) - confirmed

### Phase 7 - Polish
- [x] Cleanup / dispose on unmount reviewed (renderer, animator, interaction listeners, geometries, materials, placeholder and logo textures, observers)
- [x] Unit tests (Vitest): move parser/formatter/scramble, facelet model (known R and U strings, equivalences like M = R L' x', round trips), validation (twist, flip, swap, counts). 24 tests; also run once outside the project with a stand-in runner
- [x] README: install, quick start, props, ref handle, notation, state format, interaction, browser support, package setup, publishing
- [x] Library build: `src/index.ts` public API, `vite.config.lib.ts` (ES module, react/three external), `tsconfig.lib.json` (type declarations), exports map and peer dependencies (snippet in README)
- [x] Verify Phase 7 locally: `pnpm test`, `pnpm build:lib`, `pnpm pack`, tarball in a scratch project - confirmed (all passed)

## Decisions (resolved)
1. TypeScript
2. Vanilla Three.js inside React hooks (no react-three-fiber)
3. WebGL2 fallback when WebGPU is unavailable, with an info notice shown
4. Logo on the white center sticker only
5. Speed prop in ms per move
6. App component first, then library packaging (library build requested now, in Phase 7)
7. Manual layer turning by drag: yes. Drag on the cube turns that layer; drag on the background rotates the whole cube freely.
8. Whole-cube turn gesture: two-finger drag on touch; on desktop, holding Shift or Ctrl while dragging locks the drag to a whole-cube x/y/z turn.
9. `state` format: 54-character facelet string in URFDLB order (confirmed).
10. `getState()` / `onStateChange` ignore whole-cube rotations (x y z): the string always has standard centers, so it can be fed back into `state` (accepted with Phase 5).
11. `moves` prop replays only when the sequence text changes (use `ref.play()` to replay the same one); a new sequence replaces anything still queued (accepted with Phase 5).
12. Invalid `state` / `moves` props do not throw: they call `onError` (or log) and the cube is left as is (accepted with Phase 5).
13. Logo shape: `logo` is a URL string or `{ src, scale (default 0.75 of the sticker), rotation (degrees, clockwise seen from the white face, default 0) }` (accepted with Phase 6).
14. The logo is clipped to the white center sticker (accepted with Phase 6).
15. `colors` takes any CSS color string; a missing face keeps its default (accepted with Phase 6).
16. Publishable library build now: ES module only (three/webgpu is ESM-only), react and three as peer dependencies, no bundled three.
17. Package name: `@edmarkmagsalin/rubiks-cube` (the `em` npm org is taken; this uses the author's personal scope, replacing the earlier `em-rubiks-cube`). Publish with `--access public`.
18. License: MIT (`LICENSE` file added, `license` field in the package.json snippet).
19. Peer ranges: `three >=0.180.0`, `react >=18` (confirmed).

## Pending Decisions
None open. Waiting only for your Phase 7 verification (see Phase 7).

## Progress Log
- Planning: plan drafted, decisions resolved
- Phase 1: scaffold created (Vite + React + TS), renderer bootstrap with WebGPU/WebGL2 fallback notice, placeholder spinning box. Verified locally by user.
- Phase 2: 26 rounded cubies, shared TSL sticker material (colors via uniforms, per-cubie `home` attribute decides which faces have stickers), lights, camera framing. Temporary auto-rotate for inspection (removed in Phase 3). Verified locally by user.
- Phase 3: trackball drag/swipe around camera axes (no gimbal lock) with inertia, single-pointer, `touch-action: none`; DPR change watcher; temporary auto-rotate removed; drag hint in demo. Verified locally by user.
- Phase 4: `moves.ts` (parser, formatter, random scramble), `turnAnimator.ts` (queue, pivot, easing, snap), ref handle `applyMoves()`, demo controls. Round 1 feedback: black slab during turns, need slices/wide/x y z, remove move buttons.
- Phase 4 round 2: new move table in `moves.ts` (axis + layers per symbol), animator reads it; core shrunk to 0.9; move buttons removed. Round 2 not yet confirmed.
- Phase 4b: new `cubeInteraction.ts` owns pointer input (layer drag, background free rotation, modifier/two-finger whole-cube turn); `turnAnimator.ts` gets manual turn API + `onMoveEnd`; `dragControls.ts` now only does free rotation. Verified locally by user (feels natural).
- Phase 5: pure `cubeState.ts` (facelet <-> pieces, validation, solvability), `sceneState.ts` bridge, props/handle/callbacks in `RubiksCube.tsx`, animator gets cancel/clearQueue/pause. Model logic tested with scripts; the browser side not yet run.
- Phase 5 build fix: `pnpm build` failed with TS1294 (project tsconfig has `erasableSyntaxOnly`). Removed constructor parameter properties in `cubeInteraction.ts`, `dragControls.ts`, `turnAnimator.ts`. Rule from now on: no parameter properties, enums or namespaces. Phase 5 verified by user.
- Phase 6: `colors` and `logo` props; `stickerMaterial.ts` gets a logo texture node (placeholder + uniforms for on/off, size, rotation) so no shader rebuild; `constants.ts` gets `resolveColors`; demo gets color pickers and logo controls. Verified locally by user.
- Phase 7: `src/index.ts` public API, `vite.config.lib.ts`, `tsconfig.lib.json`, Vitest tests (`moves.test.ts`, `cubeState.test.ts`), README with package.json snippet. Tests pass outside the project; library build not yet run.
- Phase 7 follow-up: package name set to `em-rubiks-cube`, MIT license (`LICENSE` added, README updated).
- Phase 7 verified by user: tests, library build, pack and scratch-project install all pass. `pnpm build` (demo app) only shows the Vite chunk-size warning (~1 MB, because the demo bundles three.js); the library build keeps three external, so the warning does not apply to the package. All phases done.
- Package renamed to `@edmarkmagsalin/rubiks-cube` (README install, import and package.json snippet updated).
