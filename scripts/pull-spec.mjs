// Replaces spec/openapi.yaml with a new version of Letterhead's published API description.
//
//   npm run spec:pull                       fetches the published spec
//   npm run spec:pull -- path/to/spec.yaml  copies a local file instead
//
// Then run `npm run generate` and commit both files.
import { copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const publishedSpecUrl = 'https://docs.tryletterhead.com/openapi.yaml';
const destination = new URL('../spec/openapi.yaml', import.meta.url);
const source = process.argv[2];

if (source) {
  const sourcePath = resolve(source);
  await copyFile(sourcePath, destination);
  console.log(`Copied ${sourcePath} to spec/openapi.yaml.`);
} else {
  const response = await fetch(publishedSpecUrl);
  if (!response.ok) {
    console.error(`Could not fetch ${publishedSpecUrl}: status ${response.status}.`);
    process.exit(1);
  }
  const spec = await response.text();
  // Never replace the committed spec with something that is not one (an error page, an empty body).
  if (!/^openapi:\s*['"]?3\./m.test(spec) || !/^paths:/m.test(spec)) {
    console.error(`${publishedSpecUrl} did not return an OpenAPI description.`);
    process.exit(1);
  }
  await writeFile(destination, spec);
  console.log(`Fetched ${publishedSpecUrl} into spec/openapi.yaml.`);
}
