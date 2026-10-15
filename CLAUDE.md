# CLAUDE.md — letterhead-typescript

The official TypeScript SDK for the Letterhead API, published to npm as `@tryletterhead/sdk`. This repository
is public: never name or link a private Letterhead repository, project, or internal tool in it.

- **A thin, typed wrapper, nothing more.** Types are generated from `spec/openapi.yaml` (a copy of
  Letterhead's published API description, maintained outside this repository) by `scripts/generate.mjs` into
  `src/generated/schema.ts`. Never hand-edit the generated file; never hand-write a type the spec already
  describes. A wrong type is fixed in the published spec, then copied in and regenerated here.
- **The `api=true` flag is the SDK's job.** The generator strips it from the types and `src/client.ts` adds
  it to every request. Keep both halves in step.
- **Every operation gets a method, generated from the spec.** `scripts/generate.mjs` writes
  `src/generated/methods.ts`: one method per operation, grouped by the spec's first tag and named by
  `operationId`, taking `{ path, query, body }` and throwing `LetterheadError` on an error status. A new endpoint
  in the spec is a new method the next time the spec is pulled and generated; never hand-write one for an
  operation the spec has. A missing or duplicate `operationId` fails generation, so fix it in the spec.
- **A few hand-written shortcuts remain** (`contacts`, `tags`, `letters`): one line each over `raw`, kept for
  their shorter names, merged over the generated groups. Anything not shortcut is reachable through the
  generated methods or `raw`.
- **The CLI lives in `cli/` and is published separately**, as `@tryletterhead/cli` (a `letterhead` command).
  Its commands come from `src/generated/catalog.ts`, which `scripts/generate.mjs` writes from the spec alongside
  the methods, so a new endpoint is also a new command. The CLI is bundled with the SDK source into one file with
  no dependencies (`npm run build:cli`), so it always matches the spec it was built from. It reads the API key from
  `LETTERHEAD_API_KEY` or `--api-key` only and never stores it, and a DELETE needs `--yes` unless a person confirms
  at a terminal. Its few shortcuts are aliases of generated commands (`cli/src/shortcuts.ts`), never separate code.
- **One runtime dependency** (`openapi-fetch`). Adding another is a decision to raise, not a default.
- **Browser safety.** A company API key must never reach a browser bundle; the README says so and new docs
  must keep saying so.
- **Checks:** `npm run check:generated`, `npm run typecheck`, `npm test`, `npm run build`, `npm run build:cli`,
  `npm run test:cli-dist`. CI runs them on
  push to `main` and on non-draft PRs.
- **Commits:** Conventional Commits. Releases: bump `package.json`, then push a `vX.Y.Z` tag. The CLI releases on
  its own: bump `cli/package.json`, then push a `cli-vX.Y.Z` tag.
