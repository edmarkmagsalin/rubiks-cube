# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-11-25

### Changed

- The turn sound is now a recorded sample (embedded in the package, no files to host) instead of a synthesized click. It decodes instantly, so hits stay in time with very fast turns, and rapid turns overlap cleanly.

## [0.2.0] - 2026-11-25

### Added

- `sound` and `volume` props: an optional click when a move finishes, played or dragged (off by default; synthesized with the Web Audio API, no audio files).

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

[Unreleased]: https://github.com/edmarkmagsalin/rubiks-cube/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/edmarkmagsalin/rubiks-cube/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/edmarkmagsalin/rubiks-cube/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/edmarkmagsalin/rubiks-cube/releases/tag/v0.1.0
