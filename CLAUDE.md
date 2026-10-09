# CLAUDE.md — letterhead-typescript

The official TypeScript SDK for the Letterhead API, published to npm as `@letterhead/sdk`. Planned and
tracked in `the-red-book` as the `api-sdks` project (`projects/api-sdks.md`).

- **A thin, typed wrapper, nothing more.** Types are generated from `spec/openapi.yaml` (a copy of
  `help-center/openapi.yaml`, the published API description) by `scripts/generate.mjs` into
  `src/generated/schema.ts`. Never hand-edit the generated file; never hand-write a type the spec already
  describes. A wrong type is fixed in the help-center spec, then pulled and regenerated here.
- **The `api=true` flag is the SDK's job.** The generator strips it from the types and `src/client.ts` adds
  it to every request. Keep both halves in step.
- **Resource methods** (`contacts`, `tags`, `letters`) are a small curated layer over `raw`: one line each,
  typed from the generated `operations`, throwing `LetterheadError` on an error status. Anything not wrapped is
  still reachable through `raw`.
- **One runtime dependency** (`openapi-fetch`). Adding another is a decision to raise, not a default.
- **Browser safety.** A company API key must never reach a browser bundle; the README says so and new docs
  must keep saying so.
- **Checks:** `npm run check:generated`, `npm run typecheck`, `npm test`, `npm run build`. CI runs them on
  push to `main` and on non-draft PRs.
- **Commits:** Conventional Commits. Releases: bump `package.json`, then push a `vX.Y.Z` tag.
