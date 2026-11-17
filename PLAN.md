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
- [ ] Verify Phase 1 locally (`npm install && npm run dev`) - needs your confirmation

### Phase 2 - Static cube
- [ ] Cubie geometry (rounded box) x 26
- [ ] TSL sticker material (rounded sticker mask, black plastic body)
- [ ] Default colors via uniforms
- [ ] Lighting + camera framing

### Phase 3 - Interaction
- [ ] Drag / swipe 360 degree rotation (mouse + touch)
- [ ] Inertia / damping
- [ ] Resize + DPR handling

### Phase 4 - Turning
- [ ] Move parser (U D L R F B, ', 2)
- [ ] Layer selection + pivot group
- [ ] Eased animation (quaternion slerp, visible progress)
- [ ] Move queue
- [ ] Commit rotation back to cubies (no drift)

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

## Pending Decisions
1. Drag behavior: dragging anywhere rotates the whole cube, no manual layer turning for now (assumed unless you say otherwise)

## Progress Log
- Planning: plan drafted, decisions resolved
- Phase 1: scaffold created (Vite + React + TS), renderer bootstrap with WebGPU/WebGL2 fallback notice, placeholder spinning box (replaced in Phase 2). Not yet run locally.
