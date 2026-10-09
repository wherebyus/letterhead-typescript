# Contributing

```sh
npm ci
npm run generate    # regenerate src/generated/schema.ts from spec/openapi.yaml
npm run typecheck && npm test && npm run build
```

`spec/openapi.yaml` is a copy of Letterhead's published API description, which Letterhead maintains outside
this repository. To pick up an API change, replace it with the new version (`npm run spec:pull <path>`
copies a file into place), run `npm run generate`, and commit both files together; CI fails if they disagree.

To release, bump `version` in `package.json`, merge, and push a matching tag (`v1.2.3`). The Publish workflow
publishes to npm through Trusted Publishing, so no token is needed.
