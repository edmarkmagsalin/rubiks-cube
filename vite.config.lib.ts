import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Library build: `pnpm build:lib` (type declarations are emitted by tsconfig.lib.json afterwards).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'], // three/webgpu is ESM-only, so a CommonJS build would not work anyway
      fileName: () => 'index.js',
    },
    rollupOptions: {
      // Peer dependencies stay outside the bundle (react, react/jsx-runtime, three, three/webgpu, three/tsl, three/addons/*)
      external: [/^react($|\/)/, /^three($|\/)/],
    },
  },
});
