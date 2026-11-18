import { useMemo, useRef, useState } from 'react';
import { Box, Cpu, Hand, Info, Pause, Play, RotateCcw, Shuffle, Upload } from 'lucide-react';
import { RubiksCube, type RubiksCubeHandle } from '../RubiksCube';
import type { BackendKind } from '../core/webgpu';
import { formatMove, formatMoves, randomScramble, type Move } from '../core/moves';
import { SOLVED_STATE } from '../core/cubeState';

export function App() {
  const cubeRef = useRef<RubiksCubeHandle>(null);
  const [backend, setBackend] = useState<BackendKind | null>(null);
  const [duration, setDuration] = useState(300);
  const [sequence, setSequence] = useState("R U R' U' F2");
  const [stateInput, setStateInput] = useState('');
  const [currentState, setCurrentState] = useState(SOLVED_STATE);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<string | null>(null);

  // Props demo: open the page with ?state=<54 letters>&moves=R U R' U' to render a state / play moves on load.
  const initial = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return { state: q.get('state') ?? undefined, moves: q.get('moves') ?? undefined };
  }, []);

  const guard = (fn: () => void | Promise<unknown>) => {
    setError(null);
    Promise.resolve()
      .then(fn)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };

  const onMoveEnd = (move: Move, source: 'api' | 'user') =>
    setLastMove(`${formatMove(move)} (${source === 'user' ? 'dragged' : 'played'})`);

  return (
    <div className="app">
      <header className="app-header">
        <Box size={20} />
        <h1>Rubik's Cube</h1>
        {backend && (
          <span className="badge">
            <Cpu size={14} />
            {backend === 'webgpu' ? 'WebGPU' : 'WebGL2 (fallback)'}
          </span>
        )}
      </header>

      {backend === 'webgl2' && (
        <div className="notice" role="status">
          <Info size={16} />
          <span>
            WebGPU is not available in this browser, so the WebGL2 fallback is in use.
            Rendering still works, but WebGPU is recommended for best performance.
          </span>
        </div>
      )}

      <main className="stage">
        <RubiksCube
          ref={cubeRef}
          state={initial.state}
          moves={initial.moves}
          moveDuration={duration}
          onBackendReady={setBackend}
          onMoveEnd={onMoveEnd}
          onStateChange={setCurrentState}
          onError={(e) => setError(e.message)}
        />
        <p className="hint">
          <Hand size={14} />
          Drag background to rotate, drag the cube to turn a layer
        </p>
      </main>

      <section className="controls">
        <div className="row">
          <input
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guard(() => cubeRef.current?.applyMoves(sequence))}
            placeholder="R U R' U' F2 M x"
            aria-label="Move sequence"
          />
          <button className="primary" onClick={() => guard(() => cubeRef.current?.applyMoves(sequence))}>
            <Play size={14} /> Play
          </button>
          <button onClick={() => guard(() => cubeRef.current?.applyMoves(formatMoves(randomScramble(20))))}>
            <Shuffle size={14} /> Scramble
          </button>
        </div>

        <div className="row">
          <input
            className="mono"
            value={stateInput}
            onChange={(e) => setStateInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && guard(() => cubeRef.current?.setState(stateInput))}
            placeholder="54-letter state (U R F D L B order), e.g. paste the current state"
            aria-label="Cube state"
          />
          <button onClick={() => guard(() => cubeRef.current?.setState(stateInput))}>
            <Upload size={14} /> Set state
          </button>
          <button
            onClick={() => {
              setError(null);
              cubeRef.current?.reset();
              setCurrentState(SOLVED_STATE);
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={() => {
              if (paused) cubeRef.current?.resume();
              else cubeRef.current?.pause();
              setPaused(!paused);
            }}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume' : 'Pause'}
          </button>
        </div>

        <label className="row">
          <span>Speed: {duration} ms per move</span>
          <input
            type="range"
            min={80}
            max={1000}
            step={10}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </label>

        <p className="muted">
          Whole-cube turn: hold Shift / Ctrl / Cmd and drag, or drag with two fingers.
          {lastMove && <> Last move: <strong>{lastMove}</strong></>}
        </p>
        <p className="muted mono" title="State after the last finished move">
          State: {currentState}
        </p>

        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
