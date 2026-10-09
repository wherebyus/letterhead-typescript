# @tryletterhead/sdk

The official TypeScript SDK for the [Letterhead API](https://help.tryletterhead.com). Every request and
response is typed, generated from the same API description that publishes the API reference, so the SDK
can't drift from the API.

## Install

```sh
npm install @tryletterhead/sdk
```

Requires Node 18 or later (or any runtime with a global `fetch`).

## Quick start

```ts
import { createLetterheadClient } from '@tryletterhead/sdk';

const letterhead = createLetterheadClient({ apiKey: process.env.LETTERHEAD_API_KEY! });

// Add a contact (or update the one with that email) and tag them.
await letterhead.contacts.upsert({ email: 'person@example.org', firstName: 'Pat', tags: ['vip'] });

// Tag a list of existing contacts.
await letterhead.tags.addToContacts('webinar-attendee', { emails: ['person@example.org'] });
```

Create an API key in your company's settings in Letterhead. If your company is on its own Letterhead
tenant, pass that tenant's API URL as `baseUrl`:

```ts
createLetterheadClient({ apiKey, baseUrl: 'https://<tenant>.api.tryletterhead.com' });
```

## Keep your API key on a server

A company API key can read and change your whole audience. **Never ship it to a browser** — anything in a
front-end bundle is public. Use this SDK in your server, a serverless function, or a backend your React or
other front-end app calls; don't call Letterhead directly from the browser with your key.

## What's included

| Resource | Methods |
| --- | --- |
| `contacts` | `upsert`, `get`, `update`, `delete` |
| `tags` | `create`, `list`, `get`, `update`, `delete`, `addToContacts`, `removeFromContacts` |
| `letters` (newsletters) | `list`, `get`, `create`, `update`, `delete` |

These methods return the response body and throw a `LetterheadError` (with `status` and `body`) when the API
answers with an error.

Every other endpoint in the published API is available, typed, through `letterhead.raw`, an
[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) client. It returns `{ data, error, response }` and
does not throw on an error status:

```ts
const { data, error } = await letterhead.raw.GET('/api/v3/contacts/segments');
```

You never pass the `api=true` flag the API reference mentions — the SDK adds it to every request.

## Development

```sh
npm ci
npm run spec:pull   # copy ../help-center/openapi.yaml into spec/ (or pass a path)
npm run generate    # regenerate src/generated/schema.ts from spec/openapi.yaml
npm run typecheck && npm test && npm run build
```

`spec/openapi.yaml` is a copy of the published API description, whose source of truth is the help center
repository. Commit it together with the regenerated `src/generated/schema.ts`; CI fails if they disagree.

To release, bump `version` in `package.json`, merge, and push a matching tag (`v0.1.0`). The Publish
workflow publishes to npm through Trusted Publishing, so no token is needed.

## License

MIT
