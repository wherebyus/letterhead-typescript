import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { operations, paths } from './generated/schema';

/** The production Letterhead API. Customers on their own tenant pass that tenant's API URL instead. */
export const DEFAULT_BASE_URL = 'https://api.tryletterhead.com';

export interface LetterheadOptions {
  /** A company-level API key, generated in your company's settings. Keep it on your server. */
  apiKey: string;
  /** Override the API URL, for example `https://<tenant>.api.tryletterhead.com`. */
  baseUrl?: string;
  /** A `fetch` implementation, for runtimes without a global one or for testing. */
  fetch?: typeof globalThis.fetch;
}

/** Thrown by the resource methods when the API answers with an error status. */
export class LetterheadError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(LetterheadError.messageFor(status, body));
    this.name = 'LetterheadError';
    this.status = status;
    this.body = body;
  }

  private static messageFor(status: number, body: unknown): string {
    const detail =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? `: ${body.message}`
        : '';
    return `Letterhead API request failed with status ${status}${detail}`;
  }
}

type JsonBody<Operation extends keyof operations> = operations[Operation] extends {
  requestBody?: { content: { 'application/json': infer Body } };
}
  ? Body
  : never;

type Query<Operation extends keyof operations> = operations[Operation] extends {
  parameters: { query?: infer QueryParameters };
}
  ? NonNullable<QueryParameters>
  : never;

/**
 * The published API asks every API-key caller to send `api=true`. The SDK only ever authenticates with an API
 * key, so it adds the flag to every request: to the query string always, and to a JSON or form body when the
 * request has one. The generated types leave the flag out (see scripts/generate.mjs).
 */
const apiFlagMiddleware: Middleware = {
  onRequest({ request }) {
    const url = new URL(request.url);
    url.searchParams.set('api', 'true');
    return new Request(url, request);
  },
};

const serializeBodyWithApiFlag = (body: unknown): BodyInit => {
  if (body instanceof FormData) {
    body.set('api', 'true');
    return body;
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return JSON.stringify({ ...body, api: true });
  }
  return JSON.stringify(body);
};

const unwrap = <Data>(result: { data?: Data; error?: unknown; response: Response }): Data => {
  if (result.error !== undefined || !result.response.ok) {
    throw new LetterheadError(result.response.status, result.error);
  }
  return result.data as Data;
};

/** Every v3 endpoint in the published API, typed. Returns `{ data, error, response }` and never throws on a status. */
export type LetterheadRawClient = Client<paths>;

export const createLetterheadClient = (options: LetterheadOptions) => {
  if (!options.apiKey) {
    throw new Error('A Letterhead API key is required.');
  }

  const raw: LetterheadRawClient = createClient<paths>({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    headers: { Authorization: `Bearer ${options.apiKey}` },
    bodySerializer: serializeBodyWithApiFlag,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  raw.use(apiFlagMiddleware);

  const contacts = {
    /** Create a contact, or update the one with the same email. Pass `tags` to tag them in the same call. */
    upsert: async (contact: JsonBody<'createOrUpdateAContact'>) =>
      unwrap(await raw.POST('/api/v3/contacts', { body: contact })),
    get: async (email: string, query?: Query<'getAContact'>) =>
      unwrap(await raw.GET('/api/v3/contacts/{email}', { params: { path: { email }, query } })),
    update: async (email: string, changes: JsonBody<'updateAContact'>) =>
      unwrap(await raw.PUT('/api/v3/contacts/{email}', { params: { path: { email } }, body: changes })),
    delete: async (email: string) =>
      unwrap(await raw.DELETE('/api/v3/contacts/{email}', { params: { path: { email } }, body: {} })),
  };

  const tags = {
    create: async (tag: JsonBody<'createATag'>) => unwrap(await raw.POST('/api/v3/contacts/tags', { body: tag })),
    list: async (query?: Query<'listTags'>) => unwrap(await raw.GET('/api/v3/contacts/tags', { params: { query } })),
    get: async (tagId: number) =>
      unwrap(await raw.GET('/api/v3/contacts/tags/{tagId}', { params: { path: { tagId } } })),
    update: async (tagId: number, changes: JsonBody<'updateATag'>) =>
      unwrap(await raw.PUT('/api/v3/contacts/tags/{tagId}', { params: { path: { tagId } }, body: changes })),
    delete: async (tagId: number) =>
      unwrap(await raw.DELETE('/api/v3/contacts/tags/{tagId}', { params: { path: { tagId } } })),
    /** Add a tag, by name, to a list of contacts by email. */
    addToContacts: async (tag: string, body: JsonBody<'tagContactsByEmail'>) =>
      unwrap(await raw.POST('/api/v3/contacts/tags/{tag}/members', { params: { path: { tag } }, body })),
    /** Remove a tag, by name, from a list of contacts by email. */
    removeFromContacts: async (tag: string, body: JsonBody<'removeATagFromContactsByEmail'>) =>
      unwrap(await raw.DELETE('/api/v3/contacts/tags/{tag}/members', { params: { path: { tag } }, body })),
  };

  const letters = {
    list: async (query?: Query<'listAllLetters'>) => unwrap(await raw.GET('/api/v3/letters', { params: { query } })),
    get: async (letterUuid: string) =>
      unwrap(await raw.GET('/api/v3/letters/{letterUuid}', { params: { path: { letterUuid } } })),
    create: async (letter: JsonBody<'createALetter'>) => unwrap(await raw.POST('/api/v3/letters', { body: letter })),
    update: async (letterUuid: string, changes: JsonBody<'updateALetter'>) =>
      unwrap(await raw.POST('/api/v3/letters/{letterUuid}', { params: { path: { letterUuid } }, body: changes })),
    delete: async (letterUuid: string) =>
      unwrap(await raw.DELETE('/api/v3/letters/{letterUuid}', { params: { path: { letterUuid } } })),
  };

  return { contacts, tags, letters, raw };
};

export type LetterheadClient = ReturnType<typeof createLetterheadClient>;
