import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// One self-contained file: the SDK source and its one dependency are bundled in, so the published CLI has no
// dependencies and always matches the spec it was built from.
export default defineConfig({
  entry: { letterhead: 'cli/src/main.ts' },
  outDir: 'cli/dist',
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  noExternal: [/.*/],
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  define: { __CLI_VERSION__: JSON.stringify(version) },
});
