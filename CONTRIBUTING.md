# Contributing

```sh
npm ci
npm run generate    # regenerate src/generated/schema.ts from spec/openapi.yaml
npm run typecheck && npm test && npm run build
```

`spec/openapi.yaml` is a copy of Letterhead's published API description, which Letterhead maintains outside
this repository. A daily workflow (Spec sync) fetches the published spec and opens a pull request with the
regenerated types and methods when it changed. To do the same by hand, run `npm run spec:pull` (or
`npm run spec:pull -- <path>` to copy a file), then `npm run generate`, and commit both together; CI fails if
they disagree.

The sync workflow keeps one pull request, on the `spec-sync` branch, up to date, and closes it if the spec
returns to matching `main`. It needs "Allow GitHub Actions to create and approve pull requests" turned on in the
repository's Actions settings. A pull request a workflow opens does not start CI on its own: close and reopen it
to run CI before merging. GitHub pauses scheduled workflows in a repository with no activity for 60 days, so
re-enable it under Actions if it stops.

To release, bump `version` in `package.json`, merge, and push a matching tag (`v1.2.3`). The Publish workflow
publishes to npm through Trusted Publishing, so no token is needed.

The CLI in `cli/` is published separately as `@tryletterhead/cli`. Build and check it with `npm run build:cli` and
`npm run test:cli-dist`. To release it, bump `version` in `cli/package.json`, merge, and push a matching
`cli-vX.Y.Z` tag; the Publish CLI workflow publishes it. After a spec-sync pull request merges, release the CLI as
well as the SDK so its commands pick up the change.
