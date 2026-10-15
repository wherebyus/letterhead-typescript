// Generates src/generated/schema.ts from spec/openapi.yaml.
//
// The published spec asks every caller to send `api=true` (as a query
// parameter, or as a field in the request body) to say they are using a
// company API key. The SDK always authenticates that way, so it adds the flag
// to every request itself (see src/client.ts). This script removes the flag
// from the spec before generating types, so callers never see or pass it.
//
// It also writes src/generated/methods.ts: one method for every operation in the spec, grouped by the spec's tags
// and named by operationId, so a new endpoint appears in the SDK the next time the spec is pulled and generated.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parse } from 'yaml';
import openapiTS, { astToString } from 'openapi-typescript';

const specPath = new URL('../spec/openapi.yaml', import.meta.url);
const outPath = new URL('../src/generated/schema.ts', import.meta.url);
const methodsPath = new URL('../src/generated/methods.ts', import.meta.url);
const supportedMethods = ['get', 'put', 'post', 'delete', 'patch'];
const httpMethods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'];

const isApiFlagParameter = (parameter) => parameter?.name === 'api' && parameter?.in === 'query';

const withoutApiFlagParameters = (parameters) =>
  Array.isArray(parameters) ? parameters.filter((parameter) => !isApiFlagParameter(parameter)) : parameters;

const stripApiFlagFromSchema = (schema) => {
  if (!schema || typeof schema !== 'object' || !schema.properties?.api) {
    return;
  }
  delete schema.properties.api;
  if (Array.isArray(schema.required)) {
    schema.required = schema.required.filter((name) => name !== 'api');
  }
};

const stripApiFlagFromOperation = (operation) => {
  operation.parameters = withoutApiFlagParameters(operation.parameters);
  for (const media of Object.values(operation.requestBody?.content ?? {})) {
    stripApiFlagFromSchema(media.schema);
    if (media.example && typeof media.example === 'object') {
      delete media.example.api;
    }
  }
};

const spec = parse(await readFile(specPath, 'utf8'));
let strippedOperations = 0;
const generatedOperations = [];
for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
  pathItem.parameters = withoutApiFlagParameters(pathItem.parameters);
  for (const method of httpMethods) {
    if (pathItem[method]) {
      stripApiFlagFromOperation(pathItem[method]);
      strippedOperations += 1;
      if (supportedMethods.includes(method)) {
        generatedOperations.push({ path, method, operation: pathItem[method] });
      }
    }
  }
}

const toCamelCase = (words) =>
  words
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word, index) => (index === 0 ? word[0].toLowerCase() : word[0].toUpperCase()) + word.slice(1))
    .join('');

// A group name the client already uses for something else would be silently replaced, so refuse it here.
const reservedGroups = ['raw', 'tags'];
// The hand-written shortcuts in src/client.ts replace a generated method of the same name in these groups.
const shortcutNames = {
  contacts: ['upsert', 'get', 'update', 'delete'],
  letters: ['list', 'get', 'create', 'update', 'delete'],
};

const successContentTypes = (operation) => {
  const success = Object.entries(operation.responses ?? {}).find(([status]) => /^2\d\d$/.test(status));
  return Object.keys(success?.[1]?.content ?? {});
};

// openapi-fetch reads every answer as JSON unless told otherwise, so name the right reader for the others.
const parseAsFor = (operation) => {
  const types = successContentTypes(operation);
  if (types.length === 0 || types.includes('application/json')) {
    return 'json';
  }
  return types.some((type) => type.startsWith('text/')) ? 'text' : 'blob';
};

const methodLines = (operations) => {
  const groups = new Map();
  const seenIds = new Set();
  for (const { path, method, operation } of operations) {
    const id = operation.operationId;
    const where = `${method.toUpperCase()} ${path}`;
    if (!id || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(id) || seenIds.has(id)) {
      throw new Error(`Every operation needs a unique operationId that is a valid name; fix ${where} in the spec.`);
    }
    seenIds.add(id);
    const group = toCamelCase(operation.tags?.[0] ?? 'other');
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(group) || reservedGroups.includes(group)) {
      throw new Error(`The tag "${operation.tags?.[0]}" on ${where} makes a group name the SDK cannot use.`);
    }
    if (shortcutNames[group]?.includes(id)) {
      throw new Error(`operationId ${id} on ${where} collides with a hand-written shortcut in src/client.ts.`);
    }
    // PHP only reads form fields from a POST, so a form operation on any other verb is sent as JSON.
    const multipart =
      method === 'post' && Object.keys(operation.requestBody?.content ?? {}).includes('multipart/form-data');
    const options = `{ sendsBody: ${Boolean(operation.requestBody)}, multipart: ${multipart}, parseAs: '${parseAsFor(operation)}' }`;
    const line =
      `    ${id}: (...args: OperationArgList<'${id}'>) =>\n` +
      `      call('${method.toUpperCase()}', ${JSON.stringify(path)}, args[0], ${options}) as Promise<OperationResult<'${id}'>>,`;
    groups.set(group, [...(groups.get(group) ?? []), line]);
  }
  return [...groups].map(([group, lines]) => `  ${group}: {\n${lines.join('\n')}\n  },`).join('\n');
};

const ast = await openapiTS(spec);
const header = '// Generated by scripts/generate.mjs from spec/openapi.yaml. Do not edit by hand.\n\n';
await mkdir(new URL('../src/generated/', import.meta.url), { recursive: true });
await writeFile(outPath, header + astToString(ast));
await writeFile(
  methodsPath,
  `// Generated by scripts/generate.mjs from spec/openapi.yaml. Do not edit by hand.

import type { OperationArgList, OperationResult, RequestCaller } from '../operations';

export const createGeneratedMethods = (call: RequestCaller) => ({
${methodLines(generatedOperations)}
});
`,
);
console.log(`Generated types for ${strippedOperations} operations.`);
