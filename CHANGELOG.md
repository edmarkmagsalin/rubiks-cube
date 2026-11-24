# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-25

First public release.

### Added

- `RubiksCube` React component rendered with Three.js TSL, using WebGPU with an automatic WebGL2 fallback (`onBackendReady` reports which one is active).
- Interaction: drag the background to rotate the cube freely (mouse or touch, with inertia), drag the cube to turn a layer by hand, Shift / Ctrl / Cmd + drag or a two-finger drag for a whole-cube x / y / z turn.
- Smooth, eased turns with a move queue and snap-to-grid commits (no drift).
- Move notation: faces (`U D L R F B`), wide (`u d l r f b` or `Rw`), slices (`M E S`) and whole-cube rotations (`x y z`), with `'` and `2` suffixes.
- `state` prop: 54-character facelet string (URFDLB order) with validation, including solvability checks (twisted corner, flipped edge, swapped pieces).
- `moves` prop with `autoPlay`, and `moveDuration` (milliseconds per move).
- Ref handle: `applyMoves`, `play`, `pause`, `resume`, `stop`, `setState`, `reset`, `getState`.
- Callbacks: `onMoveStart`, `onMoveEnd`, `onSequenceEnd`, `onStateChange`, `onError`.
- `colors` prop (any CSS color per face) and `logo` prop (image on the white center sticker, with `scale` and `rotation`).
- Helpers: `parseMoves`, `formatMove`, `formatMoves`, `randomScramble`, `validateState`, `isWebGPUAvailable`, `SOLVED_STATE`, `DEFAULT_COLORS`, `FACES`.
- ES module build with TypeScript declarations. Peer dependencies: `react >= 18`, `three >= 0.180.0`.

[Unreleased]: https://github.com/edmarkmagsalin/rubiks-cube/commits/main
[0.1.0]: https://github.com/edmarkmagsalin/rubiks-cube/releases/tag/v0.1.0
