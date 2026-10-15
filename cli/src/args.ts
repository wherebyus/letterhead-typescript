import type { CommandFlag } from '../../src/catalog-types';

/** A mistake in how the command was called. The CLI prints it with a pointer to --help and exits 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Flags every command takes, which never consume the next word. */
export const globalBooleanFlags = ['yes', 'help', 'version', 'compact'];
/** Flags every command takes, which take a value. */
export const globalValueFlags = ['api-key', 'base-url', 'body'];

export interface ParsedArgs {
  /** The words that are not flags or flag values: the group and the command. */
  words: string[];
  /** Every flag given, by name, with each value in the order given. A boolean flag given bare is `"true"`. */
  flags: Map<string, string[]>;
}

const splitFlag = (token: string): [string, string | undefined] => {
  const body = token.slice(2);
  const equals = body.indexOf('=');
  return equals === -1 ? [body, undefined] : [body.slice(0, equals), body.slice(equals + 1)];
};

/**
 * Reads `letterhead <group> <command> --flag value --flag=value --switch`. Which flags are switches (never taking
 * the next word) is passed in, since it depends on the command: a boolean parameter is a switch too.
 */
export const parseArgs = (argv: string[], isSwitch: (flag: string) => boolean): ParsedArgs => {
  const words: string[] = [];
  const flags = new Map<string, string[]>();
  const add = (name: string, value: string) => flags.set(name, [...(flags.get(name) ?? []), value]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] as string;
    if (token === '--') {
      throw new UsageError('A bare "--" is not supported; pass values with --flag value.');
    }
    if (!token.startsWith('--')) {
      // The group and command may come before or after global flags; anything past them belongs to a flag.
      if (words.length >= 2) {
        throw new UsageError(`Unexpected "${token}". Values go after a flag, e.g. --email ${token}.`);
      }
      words.push(token);
      continue;
    }
    const [name, inlineValue] = splitFlag(token);
    if (name === '') {
      throw new UsageError(`"${token}" is not a flag.`);
    }
    if (inlineValue !== undefined) {
      add(name, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (isSwitch(name) || next === undefined || next.startsWith('--')) {
      add(name, 'true');
      continue;
    }
    add(name, next);
    index += 1;
  }
  return { words, flags };
};

const scalar = (value: string, type: string, flag: string): unknown => {
  if (type === 'integer' || type === 'number') {
    const parsed = Number(value);
    if (value.trim() === '' || Number.isNaN(parsed) || (type === 'integer' && !Number.isInteger(parsed))) {
      throw new UsageError(`--${flag} takes ${type === 'integer' ? 'a whole number' : 'a number'}, not "${value}".`);
    }
    return parsed;
  }
  if (type === 'boolean') {
    if (['true', '1', 'yes'].includes(value)) return true;
    if (['false', '0', 'no'].includes(value)) return false;
    throw new UsageError(`--${flag} takes true or false, not "${value}".`);
  }
  return value;
};

/** Turns the strings given for one flag into the value the API expects, using the type the spec declares. */
export const valueFor = (definition: CommandFlag, values: string[]): unknown => {
  if (definition.type === 'array') {
    return values.map((value) => scalar(value, definition.itemType ?? 'string', definition.flag));
  }
  if (values.length > 1) {
    throw new UsageError(`--${definition.flag} was given more than once; it takes one value.`);
  }
  return scalar(values[0] as string, definition.type, definition.flag);
};
