// Run on a server, with your company API key in the environment:
//   LETTERHEAD_API_KEY=... npx tsx examples/add-contact-and-tag.ts
import { createLetterheadClient } from '@tryletterhead/sdk';

const letterhead = createLetterheadClient({ apiKey: process.env.LETTERHEAD_API_KEY ?? '' });

await letterhead.contacts.upsert({ email: 'person@example.org', firstName: 'Pat', tags: ['vip'] });
await letterhead.tags.addToContacts('webinar-attendee', { emails: ['person@example.org'] });
