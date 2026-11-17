import { useState } from 'react';
import { Box, Cpu, Info } from 'lucide-react';
import { RubiksCube } from '../RubiksCube';
import type { BackendKind } from '../core/webgpu';

export function App() {
  const [backend, setBackend] = useState<BackendKind | null>(null);

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
        <RubiksCube onBackendReady={setBackend} />
      </main>
    </div>
  );
}
