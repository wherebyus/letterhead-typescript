import { describe, expect, it } from 'vitest';
import { createLetterheadClient, LetterheadError } from '../src/index';

interface CapturedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

const createRecordingClient = (status: number, responseBody: unknown) => {
  const captured: CapturedRequest[] = [];
  const recordingFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    captured.push({
      method: request.method,
      url: new URL(request.url),
      headers: request.headers,
      body: await request.text(),
    });
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const client = createLetterheadClient({
    apiKey: 'test-key',
    baseUrl: 'https://tenant.api.example.test',
    fetch: recordingFetch as typeof fetch,
  });
  return { client, captured };
};

describe('createLetterheadClient', () => {
  it('requires an API key', () => {
    expect(() => createLetterheadClient({ apiKey: '' })).toThrow('A Letterhead API key is required.');
  });

  it('adds a contact with tags, sending the key as a bearer token and the api flag in query and body', async () => {
    const { client, captured } = createRecordingClient(201, { items: { email: 'person@example.org' } });

    const created = await client.contacts.upsert({ email: 'person@example.org', tags: ['vip'] });

    expect(created).toEqual({ items: { email: 'person@example.org' } });
    expect(captured).toHaveLength(1);
    const [request] = captured;
    expect(request?.method).toBe('POST');
    expect(request?.url.origin).toBe('https://tenant.api.example.test');
    expect(request?.url.pathname).toBe('/api/v3/contacts');
    expect(request?.url.searchParams.get('api')).toBe('true');
    expect(request?.headers.get('authorization')).toBe('Bearer test-key');
    expect(JSON.parse(request?.body ?? '')).toEqual({ email: 'person@example.org', tags: ['vip'], api: true });
  });

  it('encodes an email address in the path', async () => {
    const { client, captured } = createRecordingClient(200, { items: {} });

    await client.contacts.get('a+b@example.org');

    expect(captured[0]?.url.pathname).toBe('/api/v3/contacts/a%2Bb%40example.org');
    expect(captured[0]?.url.searchParams.get('api')).toBe('true');
  });

  it('tags contacts by email under the tag name', async () => {
    const { client, captured } = createRecordingClient(200, { items: { matched: 1, updated: 1 } });

    await client.tags.addToContacts('vip', { emails: ['person@example.org'] });

    expect(captured[0]?.url.pathname).toBe('/api/v3/contacts/tags/vip/members');
    expect(JSON.parse(captured[0]?.body ?? '')).toEqual({ emails: ['person@example.org'], api: true });
  });

  it('keeps existing query parameters alongside the api flag', async () => {
    const { client, captured } = createRecordingClient(200, { items: [], total: 0 });

    await client.letters.list({ allChannels: 'true', page: '2' });

    const searchParams = captured[0]?.url.searchParams;
    expect(searchParams?.get('allChannels')).toBe('true');
    expect(searchParams?.get('page')).toBe('2');
    expect(searchParams?.get('api')).toBe('true');
  });

  it('throws a LetterheadError carrying the status and the API message', async () => {
    const { client } = createRecordingClient(422, { message: 'The email field is required.' });

    const failure = client.contacts.upsert({ email: '' });

    await expect(failure).rejects.toBeInstanceOf(LetterheadError);
    await expect(failure).rejects.toMatchObject({
      status: 422,
      message: 'Letterhead API request failed with status 422: The email field is required.',
    });
  });

  it('adds the api flag to a form body', async () => {
    const { client, captured } = createRecordingClient(200, {});
    const form = new FormData();
    form.set('url', 'https://example.org');

    await client.raw.POST('/api/v3/letters/templates/actions/generate-from-url', {
      body: form as never,
    });

    expect(captured[0]?.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
    expect(captured[0]?.body).toContain('name="api"');
  });
});

describe('request bodies', () => {
  it('does not change the FormData the caller passed in', async () => {
    const { client, captured } = createRecordingClient(200, {});
    const form = new FormData();
    form.set('url', 'https://example.org');

    await client.raw.POST('/api/v3/letters/templates/actions/generate-from-url', { body: form as never });

    expect(form.get('api')).toBeNull();
    expect(captured[0]?.body).toContain('name="api"');
  });

  it('URL-encodes a body sent with a form content type, flag included', async () => {
    const { client, captured } = createRecordingClient(200, {});

    await client.raw.POST('/api/v3/contacts', {
      body: { email: 'person@example.org' },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    expect(captured[0]?.body).toBe('email=person%40example.org&api=true');
  });
});

describe('generated methods', () => {
  it('has a method for every operation in the spec', async () => {
    const { parse } = await import('yaml');
    const { readFile } = await import('node:fs/promises');
    const spec = parse(await readFile(new URL('../spec/openapi.yaml', import.meta.url), 'utf8'));
    const operationIds = Object.values<Record<string, { operationId?: string }>>(spec.paths).flatMap((pathItem) =>
      ['get', 'put', 'post', 'delete', 'patch'].flatMap((method) => (pathItem[method] ? [pathItem[method].operationId] : [])),
    );
    const { client } = createRecordingClient(200, {});
    const methodNames = Object.entries(client)
      .filter(([group]) => group !== 'raw')
      .flatMap(([, methods]) => Object.keys(methods));
    expect(operationIds.length).toBeGreaterThan(200);
    expect(operationIds.filter((id) => !methodNames.includes(id as string))).toEqual([]);
  });

  it('sends path, query and the api flag for a read with no body', async () => {
    const { client, captured } = createRecordingClient(200, { items: [] });
    await client.curations.listCurations({ query: { limit: 5 } as never });
    expect(captured[0]?.method).toBe('GET');
    expect(captured[0]?.url.pathname).toBe('/api/v3/curations');
    expect(captured[0]?.url.searchParams.get('api')).toBe('true');
    expect(captured[0]?.url.searchParams.get('limit')).toBe('5');
    expect(captured[0]?.body).toBe('');
  });

  it('sends a form operation as form fields, arrays as repeated fields, with the api flag', async () => {
    const { client, captured } = createRecordingClient(200, {});
    await client.curations.discoverContent({ body: { query: 'cats', 'channels[]': ['a', 'b'] } as never });
    expect(captured[0]?.method).toBe('POST');
    expect(captured[0]?.headers.get('content-type')).toContain('multipart/form-data');
    expect(captured[0]?.body).toContain('name="channels[]"');
    expect(captured[0]?.body).toContain('name="api"');
  });

  it('sends a form operation on PUT as JSON, and form booleans as 1 or 0', async () => {
    const { client, captured } = createRecordingClient(200, {});
    await client.automations.updateAnAutomationEmailPreference({
      body: { channelId: 1, eventSlug: 'x', enabled: false } as never,
    });
    expect(captured[0]?.method).toBe('PUT');
    expect(captured[0]?.headers.get('content-type')).toContain('application/json');
    expect(JSON.parse(captured[0]?.body ?? '')).toMatchObject({ enabled: false });
    await client.curations.discoverContent({ body: { query: 'x', flag: true } as never });
    expect(captured[1]?.body).toMatch(/name="flag"\r\n\r\n1\r\n/);
  });

  it('leaves out an argument the operation does not need, and an empty required body', async () => {
    const { client, captured } = createRecordingClient(200, {});
    await client.curations.listCurations();
    await client.contacts.deleteAContact({ path: { email: 'a@example.org' } });
    expect(captured[1]?.method).toBe('DELETE');
    expect(captured[1]?.url.pathname).toBe('/api/v3/contacts/a%40example.org');
    expect(JSON.parse(captured[1]?.body ?? '')).toEqual({ api: true });
  });

  it('returns a download as text instead of failing to read it as JSON', async () => {
    const recordingFetch = async () => new Response('a,b\n1,2\n', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    const client = createLetterheadClient({ apiKey: 'k', fetch: recordingFetch as unknown as typeof fetch });
    const csv = await client.promotions.downloadPromotionMetrics({ path: { promotionCollateralUid: 'abc' } });
    expect(csv).toBe('a,b\n1,2\n');
  });

  it('throws LetterheadError on an error status', async () => {
    const { client } = createRecordingClient(404, { message: 'Not found' });
    await expect(client.curations.listCurations()).rejects.toBeInstanceOf(LetterheadError);
  });
});
