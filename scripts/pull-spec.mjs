// Replaces spec/openapi.yaml with a new version of Letterhead's published API description.
//
//   npm run spec:pull                       fetches the published spec
//   npm run spec:pull -- path/to/spec.yaml  copies a local file instead
//
// Then run `npm run generate` and commit both files.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const publishedSpecUrl = 'https://docs.tryletterhead.com/openapi.yaml';
const destination = new URL('../spec/openapi.yaml', import.meta.url);
const source = process.argv[2];

// Never replace the committed spec with something that is not one (an error page, an empty or cut-off body).
const isOpenApiDescription = (text) => {
  try {
    const spec = parse(text);
    return /^3\./.test(String(spec?.openapi)) && Object.keys(spec?.paths ?? {}).length > 0;
  } catch {
    return false;
  }
};

const readSpec = async () => {
  if (source) {
    return { text: await readFile(resolve(source), 'utf8'), from: resolve(source) };
  }
  const response = await fetch(publishedSpecUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    console.error(`Could not fetch ${publishedSpecUrl}: status ${response.status}.`);
    process.exit(1);
  }
  return { text: await response.text(), from: publishedSpecUrl };
};

const { text, from } = await readSpec();
if (!isOpenApiDescription(text)) {
  console.error(`${from} is not an OpenAPI description.`);
  process.exit(1);
}
await writeFile(destination, text);
console.log(`Wrote ${from} to spec/openapi.yaml.`);
