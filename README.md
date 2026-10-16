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

Every operation in the published API has a method, grouped by area and named for what it does, so new endpoints
show up in the SDK as they are added to the API. Each takes one argument with `path`, `query` and `body` where
the operation has them, and returns the response body. A method throws a `LetterheadError` (with `status` and
`body`) when the API answers with an error.

```ts
const { items } = await letterhead.segments.listSegments({ query: { limit: 10 } });
```

The areas are `contacts`, `segments`, `letters`, `curations`, `promotions`, `channels`, `metrics`, `automations`,
`transactionalEmail`, `teams`, `agents` and `links`. Your editor lists every method on each.

Three areas also keep shorter methods for the most common jobs:

| Resource | Shortcuts |
| --- | --- |
| `contacts` | `upsert`, `get`, `update`, `delete` |
| `tags` | `create`, `list`, `get`, `update`, `delete`, `addToContacts`, `removeFromContacts` |
| `letters` (newsletters) | `list`, `get`, `create`, `update`, `delete` |

For anything you would rather call by URL, `letterhead.raw` is an
[`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) client over the same typed paths. It returns
`{ data, error, response }` and does not throw on an error status. It sends bodies as JSON, so for the few endpoints that take form uploads use
the methods above, which send them as forms:

```ts
const { data, error } = await letterhead.raw.GET('/api/v3/contacts/segments');
```

You never pass the `api=true` flag the API reference mentions — the SDK adds it to every request.

## Command line

[`@tryletterhead/cli`](https://github.com/wherebyus/letterhead-typescript/tree/main/cli#readme) puts every API
operation behind a `letterhead` command, generated from the same API description:

```sh
npx @tryletterhead/cli contacts upsert --email person@example.org --tag vip
```

## Contributing

See [CONTRIBUTING.md](https://github.com/wherebyus/letterhead-typescript/blob/main/CONTRIBUTING.md).

## License

MIT
