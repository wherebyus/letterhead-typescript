/**
 * Shorter names for the most common jobs, mirroring the SDK's hand-written shortcuts. Each is only another name for
 * a generated command, with its own flag aliases, so a shortcut can never drift from the operation it calls.
 */
export interface Shortcut {
  group: string;
  command: string;
  /** The generated command it stands for. */
  target: { group: string; command: string };
  /** Extra flag names that mean an existing flag, e.g. `--tag` for `--tags`. */
  flagAliases: Record<string, string>;
  summary: string;
}

export const shortcuts: Shortcut[] = [
  {
    group: 'contacts',
    command: 'upsert',
    target: { group: 'contacts', command: 'create-or-update-a-contact' },
    flagAliases: { tag: 'tags' },
    summary: 'Add a contact, or update the one with that email, and tag them (--tag, repeatable)',
  },
  {
    group: 'contacts',
    command: 'get',
    target: { group: 'contacts', command: 'get-a-contact' },
    flagAliases: {},
    summary: 'Get a contact by email',
  },
  {
    group: 'tags',
    command: 'list',
    target: { group: 'contacts', command: 'list-tags' },
    flagAliases: {},
    summary: 'List your contact tags',
  },
  {
    group: 'tags',
    command: 'add-to-contacts',
    target: { group: 'contacts', command: 'tag-contacts-by-email' },
    flagAliases: { email: 'emails' },
    summary: 'Add a tag, by name, to contacts by email (--email, repeatable)',
  },
  {
    group: 'tags',
    command: 'remove-from-contacts',
    target: { group: 'contacts', command: 'remove-a-tag-from-contacts-by-email' },
    flagAliases: { email: 'emails' },
    summary: 'Remove a tag, by name, from contacts by email (--email, repeatable)',
  },
];
