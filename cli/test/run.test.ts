import { describe, expect, it } from 'vitest';
import { run, type CliIo } from '../src/run';

interface Captured {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const createIo = (options: { status?: number; response?: unknown; stdin?: string; confirm?: boolean } = {}) => {
  const captured: Captured[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = {
    stdout: (chunk) => out.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)),
    stderr: (text) => err.push(text),
    readStdin: async () => options.stdin ?? '',
    readFile: async () => {
      throw new Error('no files in tests');
    },
    confirm: () => (options.confirm === undefined ? undefined : Promise.resolve(options.confirm)),
    env: { LETTERHEAD_API_KEY: 'test-key', LETTERHEAD_BASE_URL: 'https://tenant.api.example.test' },
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      captured.push({
        method: request.method,
        url: new URL(request.url),
        headers: request.headers,
        body: await request.text(),
      });
      return new Response(JSON.stringify(options.response ?? { items: {} }), {
        status: options.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
    version: '9.9.9',
  };
  return { io, captured, stdout: () => out.join(''), stderr: () => err.join('') };
};

describe('letterhead CLI', () => {
  it('upserts a contact through the shortcut, repeating --tag into a list', async () => {
    const { io, captured, stdout } = createIo({ status: 201, response: { items: { email: 'a@example.org' } } });

    const code = await run(['contacts', 'upsert', '--email', 'a@example.org', '--tag', 'vip', '--tag', 'webinar'], io);

    expect(code).toBe(0);
    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.url.pathname).toBe('/api/v3/contacts');
    expect(captured[0]?.url.searchParams.get('api')).toBe('true');
    expect(captured[0]?.headers.get('authorization')).toBe('Bearer test-key');
    expect(JSON.parse(captured[0]?.body ?? '')).toEqual({ email: 'a@example.org', tags: ['vip', 'webinar'], api: true });
    expect(JSON.parse(stdout())).toEqual({ items: { email: 'a@example.org' } });
  });

  it('puts path flags in the path and typed query flags in the query string', async () => {
    const { io, captured } = createIo();

    await run(['contacts', 'list-tags', '--limit', '5', '--search', 'vip'], io);
    await run(['contacts', 'get-a-contact', '--email', 'a+b@example.org'], io);

    expect(captured[0]?.url.searchParams.get('limit')).toBe('5');
    expect(captured[0]?.url.searchParams.get('search')).toBe('vip');
    expect(captured[1]?.url.pathname).toBe('/api/v3/contacts/a%2Bb%40example.org');
  });

  it('merges --body with body flags, the flag winning', async () => {
    const { io, captured } = createIo({ stdin: '{"email":"old@example.org","customFields":{"plan":"pro"}}' });

    const code = await run(['contacts', 'upsert', '--body', '-', '--email', 'new@example.org'], io);

    expect(code).toBe(0);
    expect(JSON.parse(captured[0]?.body ?? '')).toEqual({
      email: 'new@example.org',
      customFields: { plan: 'pro' },
      api: true,
    });
  });

  it('accepts a required body field from --body alone', async () => {
    const { io, captured } = createIo({ stdin: '{"email":"a@example.org"}' });

    expect(await run(['contacts', 'upsert', '--body', '-'], io)).toBe(0);
    expect(captured).toHaveLength(1);
  });

  it('refuses a delete without --yes when nobody can confirm, and sends nothing', async () => {
    const { io, captured, stderr } = createIo();

    const code = await run(['contacts', 'delete-a-contact', '--email', 'a@example.org'], io);

    expect(code).toBe(2);
    expect(captured).toHaveLength(0);
    expect(stderr()).toContain('needs --yes');
  });

  it('reads --yes=no as not confirmed', async () => {
    const { io, captured } = createIo();

    expect(await run(['contacts', 'delete-a-contact', '--email', 'a@example.org', '--yes=no'], io)).toBe(2);
    expect(captured).toHaveLength(0);
  });

  it('deletes with --yes, or when a person confirms', async () => {
    const withFlag = createIo();
    expect(await run(['contacts', 'delete-a-contact', '--email', 'a@example.org', '--yes'], withFlag.io)).toBe(0);
    expect(withFlag.captured[0]?.method).toBe('DELETE');

    const confirmed = createIo({ confirm: true });
    expect(await run(['contacts', 'delete-a-contact', '--email', 'a@example.org'], confirmed.io)).toBe(0);
    expect(confirmed.captured).toHaveLength(1);

    const declined = createIo({ confirm: false });
    expect(await run(['contacts', 'delete-a-contact', '--email', 'a@example.org'], declined.io)).toBe(2);
    expect(declined.captured).toHaveLength(0);
  });

  it('exits 2 on usage mistakes without calling the API', async () => {
    const cases = [
      ['contacts', 'upsert'],
      ['contacts', 'list-tags', '--limit', 'many'],
      ['contacts', 'list-tags', '--colour', 'red'],
      ['contacts', 'no-such-command'],
      ['no-such-group', 'x'],
      ['contacts', 'list-tags', '--body', '{}'],
      ['contacts', 'get', '--email'],
      ['contacts', 'delete-a-contact', '--email', '--yes'],
      ['contacts', 'upsert', '--body', '@missing.json'],
    ];
    for (const argv of cases) {
      const { io, captured } = createIo();
      expect(await run(argv, io), argv.join(' ')).toBe(2);
      expect(captured).toHaveLength(0);
    }
  });

  it('exits 2 when there is no API key', async () => {
    const { io, stderr } = createIo();
    io.env = {};

    expect(await run(['contacts', 'list-tags'], io)).toBe(2);
    expect(stderr()).toContain('LETTERHEAD_API_KEY');
  });

  it('reports an API error as JSON on stderr and exits 1', async () => {
    const { io, stderr, stdout } = createIo({ status: 404, response: { message: 'Contact not found.' } });

    const code = await run(['contacts', 'get', '--email', 'nobody@example.org'], io);

    expect(code).toBe(1);
    expect(stdout()).toBe('');
    expect(JSON.parse(stderr())).toMatchObject({ status: 404, body: { message: 'Contact not found.' } });
  });

  it('prints help and the version without an API key', async () => {
    const top = createIo();
    top.io.env = {};
    expect(await run(['--help'], top.io)).toBe(0);
    expect(top.stdout()).toContain('letterhead <group> <command>');

    const command = createIo();
    expect(await run(['tags', 'add-to-contacts', '--help'], command.io)).toBe(0);
    expect(command.stdout()).toContain('POST /api/v3/contacts/tags/{tag}/members');
    expect(command.stdout()).toContain('--emails (also --email)');

    const version = createIo();
    expect(await run(['--version'], version.io)).toBe(0);
    expect(version.stdout()).toBe('9.9.9\n');
  });

  it('takes global flags before the command words', async () => {
    const { io, captured } = createIo();

    expect(await run(['--compact', '--base-url', 'https://other.example.test', 'contacts', 'list-tags'], io)).toBe(0);
    expect(captured[0]?.url.origin).toBe('https://other.example.test');
  });
});
