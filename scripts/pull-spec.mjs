// Copies the published API spec into spec/openapi.yaml.
//
// The spec's source of truth is openapi.yaml in the help-center repository,
// which publishes the API reference. Pass a path to a local copy, or run this
// from a checkout that sits beside help-center:
//
//   npm run spec:pull                      # reads ../help-center/openapi.yaml
//   npm run spec:pull -- path/to/openapi.yaml
//
// Then run `npm run generate` and commit both files.
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourcePath = resolve(process.argv[2] ?? '../help-center/openapi.yaml');
await copyFile(sourcePath, new URL('../spec/openapi.yaml', import.meta.url));
console.log(`Copied ${sourcePath} to spec/openapi.yaml.`);
