import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { run } from './run';

// Set from cli/package.json at build time (see cli/tsup.config.ts).
declare const __CLI_VERSION__: string;

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
};

// Only a person at a terminal can answer; anything else (a script, an agent, a pipe) gets `undefined`.
const confirm = (question: string): Promise<boolean> | undefined => {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    return undefined;
  }
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  return prompt
    .question(question)
    .then((answer) => answer.trim().toLowerCase() === 'yes')
    .finally(() => prompt.close());
};

const exitCode = await run(process.argv.slice(2), {
  stdout: (chunk) => process.stdout.write(chunk),
  stderr: (text) => process.stderr.write(text),
  readStdin,
  readFile: (path) => readFile(path, 'utf8'),
  confirm,
  env: process.env,
  version: __CLI_VERSION__,
});
process.exitCode = exitCode;
