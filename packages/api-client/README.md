# @ermulaku/api-client

A small, typed client for the TutorHub API, shared by `apps/mobile`. Reads and booking go over
**GraphQL**; `devLogin` uses **REST** and stores the JWT for subsequent authenticated calls. It
reuses the domain enums from [`@ermulaku/types`](../types) and is isomorphic (Node 18+, React Native,
browsers) via the global `fetch`.

```ts
import { TutorHubClient } from '@ermulaku/api-client';

const api = new TutorHubClient({ baseUrl: 'http://localhost:4000' });

const { items } = await api.listTutors({ subject: 'math' });
const slots = await api.getAvailability(items[0].id, '2026-06-22');

await api.devLogin('sara@example.com');
await api.bookLesson({
  tutorId: items[0].id,
  subjectId: items[0].subjects[0].id,
  startTime: slots[0].start,
});
```

## Scripts

```bash
npm run build -w @ermulaku/api-client      # tsc → dist (ESM + .d.ts)
npm test      -w @ermulaku/api-client      # Jest (mocked fetch)
```
