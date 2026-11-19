// Public API of the package.
export { RubiksCube } from './RubiksCube';
export type { RubiksCubeProps, RubiksCubeHandle, LogoOptions } from './RubiksCube';

export { parseMoves, formatMove, formatMoves, randomScramble } from './core/moves';
export type { Move, MoveSymbol } from './core/moves';

export { SOLVED_STATE, validateState } from './core/cubeState';
export type { StateValidation } from './core/cubeState';

export { DEFAULT_COLORS, FACES } from './core/constants';
export type { Face, FaceColors } from './core/constants';

export { isWebGPUAvailable } from './core/webgpu';
export type { BackendKind } from './core/webgpu';

export type { MoveSource } from './core/turnAnimator';
