# tutorhub-slot-engine

[![npm version](https://img.shields.io/npm/v/tutorhub-slot-engine.svg)](https://www.npmjs.com/package/tutorhub-slot-engine)
[![license](https://img.shields.io/npm/l/tutorhub-slot-engine.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/tutorhub-slot-engine.svg)](./dist/index.d.ts)

A **zero-dependency**, timezone- and DST-aware availability engine. Given a
tutor's weekly working hours, existing bookings, and a target day, it computes
the bookable lesson slots — correctly, deterministically, and without pulling in
moment / luxon / date-fns.

It powers the `availability` query in the TutorHub API, and ships as a
standalone package so it can be used anywhere.

## Why it exists

Availability looks trivial until you hit the real cases: timezones, daylight-
saving transitions, buffers between lessons, minimum booking notice, breaks,
overlapping bookings, and windows that run past midnight. This engine handles
all of them by reasoning entirely in absolute UTC, using the runtime's built-in
`Intl` (and the IANA tz database it ships with) for zone math.

## Install

```bash
npm install tutorhub-slot-engine
```

## Usage

```ts
import { getAvailableSlots } from 'tutorhub-slot-engine';

const slots = getAvailableSlots({
  workingHours: [
    { day: 1, start: '09:00', end: '17:00' }, // Monday, tutor-local time
  ],
  existingBookings: [{ start: '2025-06-02T10:00:00.000Z', end: '2025-06-02T11:00:00.000Z' }],
  slotMinutes: 60,
  date: '2025-06-02', // interpreted in options.timezone
  options: {
    timezone: 'Europe/Belgrade',
    bufferMinutes: 15, // keep 15 min around each booking
    leadMinutes: 120, // no slots starting within 2 hours of `now`
    breaks: [{ day: 1, start: '12:00', end: '13:00' }], // lunch
    now: '2025-06-02T06:00:00.000Z', // inject for deterministic output
  },
});
// → [{ start: '2025-06-02T07:00:00.000Z', end: '2025-06-02T08:00:00.000Z' }, ...]
```

## API

### `getAvailableSlots(params): Slot[]`

| Field                   | Type                | Notes                                                                           |
| ----------------------- | ------------------- | ------------------------------------------------------------------------------- |
| `workingHours`          | `WorkingWindow[]`   | `{ day, start, end }`; `day` is `0`=Sun…`6`=Sat, times are `"HH:mm"` wall-clock |
| `existingBookings`      | `BookingInterval[]` | `{ start, end }` as ISO-8601 UTC strings                                        |
| `slotMinutes`           | `number`            | slot length, must be `> 0`                                                      |
| `date`                  | `string`            | `"YYYY-MM-DD"`, interpreted in `options.timezone`                               |
| `options.timezone`      | `string`            | IANA zone, e.g. `"Europe/Belgrade"`                                             |
| `options.bufferMinutes` | `number?`           | gap kept around each booking (default `0`)                                      |
| `options.leadMinutes`   | `number?`           | minimum notice from `now` (default `0`)                                         |
| `options.breaks`        | `WorkingWindow[]?`  | non-bookable windows (default `[]`)                                             |
| `options.now`           | `string?`           | injected ISO instant for determinism (default `new Date()`)                     |

Returns slots sorted ascending by `start`; each is `{ start, end }` as ISO-8601
UTC. Returns `[]` when nothing is available. Throws `RangeError` on a
non-positive `slotMinutes`, malformed date/time/ISO input, or an invalid
timezone.

## Behaviour & guarantees

- **Timezone & DST.** All math is in absolute UTC. A window spanning a DST
  transition has its real duration adjusted automatically: the spring-forward
  lost hour removes a slot, the fall-back repeated hour adds one.
- **Fixed grid.** Slots step by `slotMinutes` from each window's start, so slot
  times stay predictable; a booking (± buffer) or break blocks the slots it
  overlaps.
- **Midnight crossing.** A window whose `end <= start` runs into the next day;
  all its slots are attributed to the day it starts on.
- **Deterministic.** Inject `options.now` and identical inputs always yield
  identical output.
- **Edge cases.** Ambiguous fall-back wall times and nonexistent spring-forward
  wall times resolve to a single, stable instant.

## Scripts

```bash
npm run build      # tsc → dist (ESM + .d.ts)
npm run typecheck  # tsc --noEmit (includes tests)
npm run lint       # eslint src
npm test           # jest (timezone, behaviour, and DST suites)
```
