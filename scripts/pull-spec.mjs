// Copies a new version of Letterhead's published API description into spec/openapi.yaml.
//
//   npm run spec:pull -- path/to/openapi.yaml
//
// Then run `npm run generate` and commit both files.
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('Usage: npm run spec:pull -- path/to/openapi.yaml');
  process.exit(1);
}
const sourcePath = resolve(source);
await copyFile(sourcePath, new URL('../spec/openapi.yaml', import.meta.url));
console.log(`Copied ${sourcePath} to spec/openapi.yaml.`);
