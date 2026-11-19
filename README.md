# Rubik's Cube for React (Three.js TSL, WebGPU)

An interactive 3x3 Rubik's Cube React component rendered with Three.js `WebGPURenderer` and Three Shading Language (TSL). It uses WebGPU and falls back to WebGL2 automatically.

- Drag or swipe to inspect the cube from every angle
- Drag the cube to turn a layer by hand
- Smooth, eased turns, never a snap
- Full move notation (faces, wide, slices, whole-cube rotations)
- Render any cube state, animate any move sequence
- Custom sticker colors and a logo on the white center

## Install

```bash
pnpm add em-rubiks-cube three
```

Peer dependencies: `react >= 18`, `three >= 0.180.0`. Your bundler must support `three/webgpu` and `three/tsl` (any recent Vite, webpack 5 or Next.js setup does). The component renders in the browser only (use a client component / dynamic import with SSR frameworks).

## Quick start

```tsx
import { useRef } from 'react';
import { RubiksCube, type RubiksCubeHandle } from 'em-rubiks-cube';

export function Demo() {
  const cube = useRef<RubiksCubeHandle>(null);

  return (
    // The cube fills its parent, so give the parent a size.
    <div style={{ width: 480, height: 480 }}>
      <RubiksCube
        ref={cube}
        moves="R U R' U' F2"
        moveDuration={250}
        logo="/logo.png"
        colors={{ U: '#ffffff', F: '#009b48' }}
        onStateChange={(state) => console.log(state)}
      />
    </div>
  );
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `state` | `string` | solved | 54-character facelet string (see below). Changing it shows that state instantly. Invalid states call `onError`. |
| `moves` | `string \| Move[]` | none | Moves to animate from the current state. Plays whenever the sequence changes (if `autoPlay`). A new sequence replaces anything still queued. |
| `autoPlay` | `boolean` | `true` | Play `moves` automatically. Otherwise call `ref.play()`. |
| `moveDuration` | `number` | `300` | Milliseconds per move. |
| `colors` | `Partial<Record<'U'\|'R'\|'F'\|'D'\|'L'\|'B', string>>` | white, red, green, yellow, orange, blue | Sticker color per face. Any CSS color. Missing faces keep the default. |
| `logo` | `string \| { src; scale?; rotation? } \| null` | none | Logo on the center sticker of the white (U) face. `scale` is the fraction of the sticker (default `0.75`), `rotation` is in degrees, clockwise as seen from the white face. Aspect ratio is kept. |
| `onMoveStart` | `(move) => void` | | A queued move started turning. |
| `onMoveEnd` | `(move, source) => void` | | A move finished. `source` is `'api'` (from `moves` / `applyMoves`) or `'user'` (dragged). Dragged turns are reported in standard notation. |
| `onSequenceEnd` | `() => void` | | A `moves` / `play()` / `applyMoves()` sequence finished (not called if cancelled). |
| `onStateChange` | `(state) => void` | | Facelet string after every finished move. |
| `onBackendReady` | `(backend) => void` | | `'webgpu'` or `'webgl2'` (fallback). Use it to show a notice when WebGPU is unavailable. |
| `onError` | `(error) => void` | `console.error` | Invalid `state` / `moves`, or a logo that failed to load. |
| `className` | `string` | | Class for the wrapper `div`. |

## Ref handle

| Method | Description |
| --- | --- |
| `applyMoves(moves, { duration? })` | Queue moves. Resolves `true` when done, `false` if cancelled. Rejects on invalid notation. `duration` is ms per move (`0` = instant). |
| `play()` | Play the current `moves` prop again. |
| `pause()` / `resume()` | Freeze / continue playback. |
| `stop()` | Drop queued moves that have not started. |
| `setState(state)` | Show a state instantly. Throws if invalid. |
| `reset()` | Back to solved, instantly. |
| `getState()` | Facelet string after the last finished move. |

## Move notation

| Kind | Symbols | Notes |
| --- | --- | --- |
| Faces | `U D L R F B` | Clockwise as seen from outside that face |
| Wide | `u d l r f b` or `Uw Dw Lw Rw Fw Bw` | Face plus the adjacent middle slice |
| Slices | `M E S` | `M` follows `L`, `E` follows `D`, `S` follows `F` |
| Whole cube | `x y z` | `x` follows `R`, `y` follows `U`, `z` follows `F` |

Add `'` for the inverse and `2` for a half turn: `R'`, `U2`, `M'`. Moves act on the cube's current orientation, as in standard notation.

## State format

54 characters, faces in the order `U R F D L B`, nine stickers per face, read row by row as seen from outside the face. Each character is the face whose color that sticker has.

```
U face: 9 chars (back row first)   R face: 9   F face: 9   D face: 9 (front row first)   L face: 9   B face: 9
solved: UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB
```

States are validated: length, letters, color counts, impossible pieces, and solvability (twisted corner, flipped edge, swapped pieces). `getState()` and `onStateChange` ignore whole-cube rotations, so their output can always be passed back as `state`. The helpers `validateState`, `parseMoves`, `formatMoves`, `randomScramble` and `SOLVED_STATE` are exported too.

## Interaction

| Input | Result |
| --- | --- |
| Drag the background | Rotate the whole cube freely (with inertia) |
| Drag on the cube | Turn the grabbed layer; releases to the nearest quarter turn |
| Shift / Ctrl / Cmd + drag | Whole-cube turn locked to one axis (x, y or z) |
| Two-finger drag (touch) | Whole-cube turn locked to one axis |

Dragging on the cube is ignored while moves are playing.

## Browser support

WebGPU is used where available (recent Chrome, Edge, Safari, Firefox). Elsewhere the component falls back to WebGL2; `onBackendReady` tells you which one is active.

## Development

```bash
pnpm install
pnpm dev          # demo app
pnpm test         # unit tests (moves, facelet model, validation)
pnpm build        # demo app build
pnpm build:lib    # library build + type declarations in dist/
```

## Package setup

Merge these fields into `package.json` (and move `react`, `react-dom`, `three` and `lucide-react` from `dependencies` to `devDependencies`, add `vitest` as a dev dependency):

```json
{
  "name": "em-rubiks-cube",
  "private": false,
  "version": "0.1.0",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist", "README.md"],
  "peerDependencies": { "react": ">=18", "three": ">=0.180.0" },
  "scripts": {
    "test": "vitest run",
    "build:lib": "vite build --config vite.config.lib.ts && tsc -p tsconfig.lib.json",
    "prepublishOnly": "pnpm test && pnpm build:lib"
  }
}
```

## Publishing

1. Add `repository`, `keywords` and `author` to `package.json` (name and license are already set).
2. `pnpm test && pnpm build:lib`
3. `pnpm pack` and install the tarball in a scratch project to try it.
4. `pnpm publish --access public` (scoped packages need `--access public`).

## License

MIT. See [LICENSE](./LICENSE).
