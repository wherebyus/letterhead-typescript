import { createLetterheadClient, LetterheadError } from '../../src/client';
import type { CommandEntry, CommandFlag } from '../../src/catalog-types';
import { commandCatalog } from '../../src/generated/catalog';
import { globalBooleanFlags, globalValueFlags, parseArgs, UsageError, valueFor } from './args';
import { commandHelp, groupHelp, topHelp } from './help';
import { shortcuts } from './shortcuts';

/** Everything the CLI touches outside itself, so it can be run against fakes in tests. */
export interface CliIo {
  stdout: (chunk: string | Uint8Array) => void;
  stderr: (text: string) => void;
  readStdin: () => Promise<string>;
  readFile: (path: string) => Promise<string>;
  /** Ask a yes/no question in a terminal; `undefined` when nobody is at one to answer. */
  confirm: (question: string) => Promise<boolean> | undefined;
  env: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  version: string;
}

interface Resolved {
  entry: CommandEntry;
  invokedAs: string;
  flagAliases: Record<string, string>;
}

const resolveCommand = (group: string, command: string): Resolved | undefined => {
  const shortcut = shortcuts.find((s) => s.group === group && s.command === command);
  if (shortcut) {
    const entry = commandCatalog.find(
      (e) => e.group === shortcut.target.group && e.command === shortcut.target.command,
    );
    return entry ? { entry, invokedAs: `${group} ${command}`, flagAliases: shortcut.flagAliases } : undefined;
  }
  const entry = commandCatalog.find((e) => e.group === group && e.command === command);
  return entry ? { entry, invokedAs: `${group} ${command}`, flagAliases: {} } : undefined;
};

// A switch is on only when given bare or as true, 1 or yes; anything else (`--yes=no`) leaves it off.
const isOn = (flags: Map<string, string[]>, name: string) => {
  const value = flags.get(name)?.at(-1);
  return value !== undefined && ['true', '1', 'yes'].includes(value);
};

const lastValue = (flags: Map<string, string[]>, name: string) => flags.get(name)?.at(-1);

const readBody = async (source: string, io: CliIo): Promise<Record<string, unknown>> => {
  let text = source;
  if (source === '-') {
    text = await io.readStdin();
  } else if (source.startsWith('@')) {
    try {
      text = await io.readFile(source.slice(1));
    } catch {
      throw new UsageError(`--body could not read ${source.slice(1)}.`);
    }
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new UsageError('--body is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new UsageError('--body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
};

const buildArgs = async (resolved: Resolved, flags: Map<string, string[]>, io: CliIo) => {
  const { entry, flagAliases } = resolved;
  const given = new Map<CommandFlag, string[]>();
  for (const [name, values] of flags) {
    if (globalBooleanFlags.includes(name) || globalValueFlags.includes(name)) {
      continue;
    }
    const canonical = flagAliases[name] ?? name;
    const definition = entry.flags.find((flag) => flag.flag === canonical);
    if (!definition) {
      throw new UsageError(`"${resolved.invokedAs}" has no --${name} flag.`);
    }
    given.set(definition, [...(given.get(definition) ?? []), ...values]);
  }

  const bodySource = lastValue(flags, 'body');
  if (bodySource !== undefined && !entry.takesBody) {
    throw new UsageError(`"${resolved.invokedAs}" takes no request body.`);
  }
  const body: Record<string, unknown> = bodySource !== undefined ? await readBody(bodySource, io) : {};
  const path: Record<string, unknown> = {};
  const query: Record<string, unknown> = {};
  for (const [definition, values] of given) {
    const target = definition.in === 'path' ? path : definition.in === 'query' ? query : body;
    target[definition.name] = valueFor(definition, values);
  }

  const missing = entry.flags.filter((flag) => {
    if (!flag.required) return false;
    if (flag.in === 'body') return !(flag.name in body);
    return !given.has(flag);
  });
  if (missing.length > 0) {
    throw new UsageError(`Missing ${missing.map((flag) => `--${flag.flag}`).join(', ')}.`);
  }

  const sendBody = entry.takesBody && (Object.keys(body).length > 0 || entry.bodyRequired);
  return {
    ...(Object.keys(path).length > 0 ? { path } : {}),
    ...(Object.keys(query).length > 0 ? { query } : {}),
    ...(sendBody ? { body } : {}),
  };
};

const confirmDelete = async (resolved: Resolved, flags: Map<string, string[]>, args: { path?: object }, io: CliIo) => {
  if (resolved.entry.method !== 'DELETE' || isOn(flags, 'yes')) {
    return;
  }
  const target = Object.entries(args.path ?? {})
    .map(([name, value]) => `${name} ${String(value)}`)
    .join(', ') || resolved.entry.path;
  const answer = io.confirm(`This deletes: ${resolved.entry.summary} (${target}). Continue? Type "yes": `);
  if (answer === undefined) {
    throw new UsageError(`"${resolved.invokedAs}" deletes, so it needs --yes when not run in a terminal.`);
  }
  if (!(await answer)) {
    throw new UsageError('Not confirmed, so nothing was deleted.');
  }
};

const printResult = async (result: unknown, compact: boolean, io: CliIo) => {
  if (result === undefined) {
    return;
  }
  if (typeof result === 'string') {
    io.stdout(result.endsWith('\n') ? result : `${result}\n`);
    return;
  }
  if (result instanceof Blob) {
    io.stdout(new Uint8Array(await result.arrayBuffer()));
    return;
  }
  io.stdout(`${JSON.stringify(result, null, compact ? undefined : 2)}\n`);
};

const runCommand = async (argv: string[], io: CliIo): Promise<number> => {
  const first = parseArgs(argv, (flag) => globalBooleanFlags.includes(flag), true);
  const help = isOn(first.flags, 'help');
  if (isOn(first.flags, 'version')) {
    io.stdout(`${io.version}\n`);
    return 0;
  }
  const [group, command] = first.words;
  if (group === undefined) {
    io.stdout(topHelp(commandCatalog, shortcuts));
    return 0;
  }
  const groupEntries = commandCatalog.filter((entry) => entry.group === group);
  const groupShortcuts = shortcuts.filter((shortcut) => shortcut.group === group);
  if (groupEntries.length === 0 && groupShortcuts.length === 0) {
    throw new UsageError(`Unknown group "${group}".`);
  }
  if (command === undefined) {
    const text = groupHelp(group, groupEntries, groupShortcuts);
    if (help) {
      io.stdout(text);
      return 0;
    }
    io.stderr(`letterhead: choose a command.\n\n${text}`);
    return 2;
  }
  const resolved = resolveCommand(group, command);
  if (!resolved) {
    throw new UsageError(`Unknown command "${group} ${command}". Run "letterhead ${group} --help" to list them.`);
  }
  if (help) {
    io.stdout(commandHelp(resolved.entry, resolved.invokedAs, resolved.flagAliases));
    return 0;
  }

  const isBooleanFlag = (flag: string) => {
    const canonical = resolved.flagAliases[flag] ?? flag;
    return resolved.entry.flags.some((definition) => definition.flag === canonical && definition.type === 'boolean');
  };
  const { flags } = parseArgs(argv, (flag) => globalBooleanFlags.includes(flag) || isBooleanFlag(flag));
  const args = await buildArgs(resolved, flags, io);
  const apiKey = lastValue(flags, 'api-key') ?? io.env.LETTERHEAD_API_KEY;
  if (!apiKey) {
    throw new UsageError('No API key. Set LETTERHEAD_API_KEY or pass --api-key.');
  }
  await confirmDelete(resolved, flags, args, io);
  const baseUrl = lastValue(flags, 'base-url') ?? io.env.LETTERHEAD_BASE_URL;
  const client = createLetterheadClient({
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    ...(io.fetch ? { fetch: io.fetch } : {}),
  }) as unknown as Record<string, Record<string, (args: unknown) => Promise<unknown>>>;
  const method = client[resolved.entry.sdkGroup]?.[resolved.entry.operationId];
  if (!method) {
    throw new Error(`The SDK has no method for ${resolved.entry.operationId}.`);
  }
  await printResult(await method(args), isOn(flags, 'compact'), io);
  return 0;
};

/** Runs one CLI invocation and returns its exit code: 0 done, 1 the API or network failed, 2 a usage mistake. */
export const run = async (argv: string[], io: CliIo): Promise<number> => {
  try {
    return await runCommand(argv, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`letterhead: ${error.message}\nRun "letterhead --help" for usage.\n`);
      return 2;
    }
    if (error instanceof LetterheadError) {
      io.stderr(`${JSON.stringify({ error: error.message, status: error.status, body: error.body })}\n`);
      return 1;
    }
    io.stderr(`${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}\n`);
    return 1;
  }
};
