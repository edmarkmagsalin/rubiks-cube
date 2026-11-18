import { useRef, useState } from 'react';
import { Box, Cpu, Hand, Info, Play, Shuffle } from 'lucide-react';
import { RubiksCube, type RubiksCubeHandle } from '../RubiksCube';
import type { BackendKind } from '../core/webgpu';
import { formatMove, formatMoves, randomScramble, type Move } from '../core/moves';

export function App() {
  const cubeRef = useRef<RubiksCubeHandle>(null);
  const [backend, setBackend] = useState<BackendKind | null>(null);
  const [duration, setDuration] = useState(300);
  const [sequence, setSequence] = useState("R U R' U' F2");
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<string | null>(null);

  const onMoveEnd = (move: Move, source: 'api' | 'user') =>
    setLastMove(`${formatMove(move)} (${source === 'user' ? 'dragged' : 'played'})`);

  const run = async (moves: string) => {
    setError(null);
    try {
      await cubeRef.current?.applyMoves(moves);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

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
        <RubiksCube ref={cubeRef} onBackendReady={setBackend} moveDuration={duration} onMoveEnd={onMoveEnd} />
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
            onKeyDown={(e) => e.key === 'Enter' && run(sequence)}
            placeholder="R U R' U' F2 M x"
            aria-label="Move sequence"
          />
          <button className="primary" onClick={() => run(sequence)}>
            <Play size={14} /> Play
          </button>
          <button onClick={() => run(formatMoves(randomScramble(20)))}>
            <Shuffle size={14} /> Scramble
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

        {error && <p className="error">{error}</p>}
      </section>
    </div>
  );
}
