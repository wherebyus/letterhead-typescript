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
