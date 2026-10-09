// Loads the built package through both entry points (import and require) and makes one request with each,
// so a packaging break in either build fails CI before it can be published.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);

const exerciseBuild = async (label, sdk) => {
  let requestedUrl;
  const stubFetch = async (request) => {
    requestedUrl = new URL(request.url);
    return new Response(JSON.stringify({ items: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const client = sdk.createLetterheadClient({ apiKey: 'smoke', baseUrl: 'https://smoke.example.test', fetch: stubFetch });
  await client.contacts.get('person@example.org');
  assert.equal(requestedUrl?.searchParams.get('api'), 'true', `${label}: api flag missing`);
  console.log(`${label} build: ok`);
};

await exerciseBuild('ESM', await import('../dist/index.js'));
await exerciseBuild('CommonJS', require('../dist/index.cjs'));
