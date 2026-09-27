/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const umd = (p: string) => fileURLToPath(new URL(`./node_modules/${p}`, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // React's UMD builds are inlined into generated-project previews (they are not in React's exports map).
    alias: [
      { find: /^@react-umd(\?.*)?$/, replacement: `${umd('react/umd/react.production.min.js')}$1` },
      { find: /^@react-dom-umd(\?.*)?$/, replacement: `${umd('react-dom/umd/react-dom.production.min.js')}$1` },
    ],
  },
  // Template projects under src/llm/mock/templates contain their own index.html files; don't crawl them.
  optimizeDeps: { entries: ['index.html'], exclude: ['esbuild-wasm'] },
  test: {
    environment: 'node',
    // Template projects import .css files with ?raw; keep their contents in tests.
    css: { include: [/.+/] },
  },
});
