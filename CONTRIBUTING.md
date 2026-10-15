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

To release, bump `version` in `package.json`, merge, and push a matching tag (`v1.2.3`). The Publish workflow
publishes to npm through Trusted Publishing, so no token is needed.
