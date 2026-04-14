import { defineConfig } from 'tsdown';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  entry: ['src/bunwright.ts'],
  outDir: 'dist',
  format: ['esm'],
  dts: false,
  clean: true,
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  banner: {
    js: '#!/usr/bin/env bun',
  },
});
