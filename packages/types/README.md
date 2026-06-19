# @ermulaku/types

Shared TypeScript domain types for the **TutorHub** monorepo (SPEC §3 / §8).

These are the single source of truth for the domain shapes used across the apps
and services — the consumer marketplace, the tutor dashboard, and the API that
exposes the domain over REST, GraphQL, and gRPC.

## What's here

| Export                                                        | Kind       | Notes                                                      |
| ------------------------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `Level`                                                       | enum-like  | `BEGINNER` · `INTERMEDIATE` · `ADVANCED`                   |
| `BookingStatus`                                               | enum-like  | `PENDING → CONFIRMED → COMPLETED`, `CANCELLED` / `NO_SHOW` |
| `PaymentStatus`                                               | enum-like  | `PENDING` · `PAID` · `REFUNDED`                            |
| `Tutor`, `Subject`, `Student`, `Booking`, `Review`, `Payment` | interfaces | scalar + foreign-key row shapes                            |
| `WorkingHours`                                                | interface  | weekly availability window (`day`, `start`, `end`)         |

Enums are modelled as `as const` objects with a derived union type, so each is
usable as **both a value and a type** without TypeScript `enum` runtime quirks:

```ts
import { BookingStatus } from '@ermulaku/types';

function isOpen(status: BookingStatus): boolean {
  return status === BookingStatus.Pending || status === BookingStatus.Confirmed;
}
```

## Conventions

- **Timestamps** are ISO-8601 UTC strings (e.g. `"2025-03-30T08:00:00.000Z"`),
  matching `@ermulaku/slot-engine`.
- Entities carry **foreign-key ids** (`tutorId`, `studentId`, …); resolved
  relation graphs are composed per-query at the API layer, not baked in here.

## Scripts

```bash
npm run build      # tsc → dist (ESM + .d.ts)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint src
```
