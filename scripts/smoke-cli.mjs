// Runs the built CLI the way a person or agent would, so a packaging break (a missing shebang, a dependency left
// out of the bundle) fails CI before it can be published. The behaviour itself is covered by cli/test.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Run as an executable, as npm installs it, so the shebang and file mode are part of what is checked.
const bin = fileURLToPath(new URL('../cli/dist/letterhead.js', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../cli/package.json', import.meta.url), 'utf8'));

assert.equal(execFileSync(bin, ['--version'], { encoding: 'utf8' }).trim(), version, 'version');
assert.match(execFileSync(bin, ['contacts', '--help'], { encoding: 'utf8' }), /create-or-update-a-contact/, 'help');
const refused = spawnSync(bin, ['contacts', 'delete-a-contact', '--email', 'a@example.org'], {
  encoding: 'utf8',
  env: { ...process.env, LETTERHEAD_API_KEY: 'smoke' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
assert.equal(refused.status, 2, 'a delete without --yes exits 2');
console.log('CLI build: ok');
