import type { CommandEntry } from '../../src/catalog-types';
import type { Shortcut } from './shortcuts';

const GLOBAL_OPTIONS = `Options for every command:
  --api-key <key>    A company API key (or set LETTERHEAD_API_KEY). Keep it out of shared shells and scripts.
  --base-url <url>   Your tenant's API, e.g. https://<tenant>.api.tryletterhead.com (or set LETTERHEAD_BASE_URL)
  --body <json>      The request body as JSON; @file.json reads a file, - reads standard input
  --yes              Confirm a delete without being asked (required when not run in a terminal)
  --compact          Print JSON on one line
  --help             Show help for the group or command
  --version          Show the CLI version`;

const pad = (text: string, width: number) => text + ' '.repeat(Math.max(1, width - text.length));

export const topHelp = (catalog: CommandEntry[], shortcuts: Shortcut[]): string => {
  const groups = new Map<string, number>();
  for (const entry of catalog) groups.set(entry.group, (groups.get(entry.group) ?? 0) + 1);
  for (const shortcut of shortcuts) if (!groups.has(shortcut.group)) groups.set(shortcut.group, 0);
  const width = Math.max(...[...groups.keys()].map((group) => group.length)) + 3;
  const groupLines = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, count]) => `  ${pad(group, width)}${count > 0 ? `${count} command${count === 1 ? '' : 's'}` : 'shortcuts'}`);
  const shortcutLines = shortcuts.map((s) => `  letterhead ${s.group} ${s.command}`.padEnd(42) + s.summary);
  return `letterhead: the Letterhead API from your terminal

Usage: letterhead <group> <command> [--flags]

Every command is one API operation; its flags are the operation's parameters and top-level body fields.
Output is JSON on standard output. An API error goes to standard error as JSON and the exit code is 1;
a mistake in the command itself exits 2.

Groups:
${groupLines.join('\n')}

Shortcuts:
${shortcutLines.join('\n')}

${GLOBAL_OPTIONS}

Run "letterhead <group> --help" to list a group's commands. The full API is described at
https://docs.tryletterhead.com/openapi.yaml.
`;
};

export const groupHelp = (group: string, entries: CommandEntry[], shortcuts: Shortcut[]): string => {
  const names = [...entries.map((e) => e.command), ...shortcuts.map((s) => s.command)];
  const width = Math.max(...names.map((name) => name.length)) + 3;
  const lines = entries.map((entry) => `  ${pad(entry.command, width)}${entry.summary}`);
  const shortcutLines = shortcuts.map((s) => `  ${pad(s.command, width)}${s.summary}`);
  return `Usage: letterhead ${group} <command> [--flags]

${entries.length > 0 ? `Commands:\n${lines.join('\n')}\n` : ''}${shortcutLines.length > 0 ? `\nShortcuts:\n${shortcutLines.join('\n')}\n` : ''}
Run "letterhead ${group} <command> --help" for a command's flags.
`;
};

const flagLine = (flag: CommandEntry['flags'][number], aliases: string[]): string => {
  const type = flag.type === 'array' ? `${flag.itemType ?? 'string'}, repeatable` : flag.type;
  const alias = aliases.length > 0 ? ` (also --${aliases.join(', --')})` : '';
  const required = flag.required ? ' required.' : '';
  return `  --${flag.flag}${alias}  <${type}>${required}${flag.description ? ` ${flag.description}` : ''}`;
};

export const commandHelp = (entry: CommandEntry, invokedAs: string, flagAliases: Record<string, string>): string => {
  const aliasesFor = (flag: string) => Object.keys(flagAliases).filter((alias) => flagAliases[alias] === flag);
  const section = (title: string, where: 'path' | 'query' | 'body') => {
    const flags = entry.flags.filter((flag) => flag.in === where);
    return flags.length > 0 ? `${title}:\n${flags.map((flag) => flagLine(flag, aliasesFor(flag.flag))).join('\n')}\n\n` : '';
  };
  const body = entry.takesBody
    ? `Request body${entry.bodyRequired ? ' (required)' : ''}: the body flags above, and anything else as JSON in --body.` +
      ` Flags win over the same field in --body.${entry.multipart ? ' Sent as a form; file uploads are not supported.' : ''}\n\n`
    : '';
  const guard = entry.method === 'DELETE' ? 'This deletes. Pass --yes, or confirm when asked in a terminal.\n\n' : '';
  return `Usage: letterhead ${invokedAs} [--flags]

${entry.summary}

${entry.method} ${entry.path}

${section('Path', 'path')}${section('Query', 'query')}${section('Body fields', 'body')}${body}${guard}${entry.description ? `${entry.description}\n` : ''}`;
};

export { GLOBAL_OPTIONS };
