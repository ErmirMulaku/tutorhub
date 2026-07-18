# TutorHub API

The `services/api` service exposes the **same domain over three protocols**, all
sharing one service layer (`BookingService` is the single source of truth for
booking rules):

- **REST** + Swagger UI at `/docs`
- **GraphQL** (code-first Apollo) at `/graphql` — SDL in [`schema.graphql`](./schema.graphql)
- **gRPC** (`tutorhub.v1`) from [`proto/booking.proto`](../proto/booking.proto)

Base URL (local): `http://localhost:4000` · gRPC: `localhost:50051`.

## Authentication

Guarded GraphQL operations require a JWT. Mint one for a seeded student (dev-only;
real password auth is mocked):

```bash
curl -X POST localhost:4000/auth/dev-login -H 'content-type: application/json' \
  -d '{"email":"sara@example.com"}'
# → { "accessToken": "eyJ..." }
```

Send it as `Authorization: Bearer <token>`.

---

## REST

| Method & path                                                  | Purpose                          | Errors       |
| -------------------------------------------------------------- | -------------------------------- | ------------ |
| `GET /health`                                                  | Liveness probe                   | —            |
| `GET /ready`                                                   | Readiness probe (checks DB)      | `503`        |
| `GET /metrics`                                                 | Prometheus metrics               | —            |
| `GET /status`                                                  | HTML status page                 | —            |
| `POST /assistant/chat`                                         | OpenAI booking assistant (§12B)  | `400`, `503` |
| `POST /tutors` · `GET /tutors`                                 | Create / list tutors             | `400`        |
| `GET·PATCH·DELETE /tutors/:id`                                 | Read / update / delete a tutor   | `404`        |
| `POST /subjects` · `GET /subjects?tutorId=`                    | Create / list subjects           | `400`, `404` |
| `GET·PATCH·DELETE /subjects/:id`                               | Read / update / delete a subject | `404`        |
| `POST /bookings` · `GET /bookings?status=&tutorId=&studentId=` | Create / list bookings           | `400`, `404` |
| `GET /bookings/:id`                                            | Read a booking                   | `404`        |
| `PATCH /bookings/:id/status`                                   | Change status (state machine)    | `404`, `409` |
| `POST /auth/dev-login`                                         | Mint a dev JWT                   | `404`        |

Example — create a booking:

```bash
curl -X POST localhost:4000/bookings -H 'content-type: application/json' -d '{
  "tutorId":"…","studentId":"…","subjectId":"…",
  "startTime":"2025-06-02T09:00:00.000Z","endTime":"2025-06-02T10:00:00.000Z"
}'
# → 201 { "id":"…", "status":"PENDING", ... }
```

All input is validated (`class-validator`). Errors: **400** validation,
**404** not found, **409** illegal status transition.

### AI booking assistant

`POST /assistant/chat` runs an OpenAI function-calling loop. The model may call `searchTutors`,
`getAvailability`, and `bookLesson`; the **server** executes each against the service layer. Requires
`OPENAI_API_KEY` server-side (else `503`).

```bash
curl -X POST localhost:4000/assistant/chat -H 'content-type: application/json' -d '{
  "messages": [{ "role": "user", "content": "Find a maths tutor and book Monday at 10:00." }]
}'
# → 201 { "reply": "I've booked …", "toolsUsed": ["searchTutors","getAvailability","bookLesson"] }
```

---

## GraphQL

Endpoint `POST /graphql`; full SDL in [`schema.graphql`](./schema.graphql).

### Queries

| Operation                                                | Auth    | Notes                       |
| -------------------------------------------------------- | ------- | --------------------------- |
| `tutors(subject, level, limit=20, offset=0): TutorPage!` | public  | pagination + filters        |
| `tutor(id: ID!): Tutor`                                  | public  | `null` if missing           |
| `availability(tutorId: ID!, date: String!): [Slot!]!`    | public  | uses `tutorhub-slot-engine` |
| `me: Student!`                                           | **JWT** | current student             |
| `myBookings(status: BookingStatus): [Booking!]!`         | **JWT** | current student's bookings  |

### Mutations

| Operation                                                             | Auth    | Notes                                  |
| --------------------------------------------------------------------- | ------- | -------------------------------------- |
| `bookLesson(input: BookInput!): Booking!`                             | **JWT** | derives a 60-min end; status `PENDING` |
| `cancelBooking(id: ID!, reason: String): Booking!`                    | **JWT** | owner only → `CANCELLED`               |
| `leaveReview(bookingId: ID!, rating: Int!, comment: String): Review!` | **JWT** | completed + owned booking              |

Example — paginated tutors with nested fields:

```graphql
{
  tutors(limit: 2) {
    total
    hasMore
    items {
      name
      rating
      subjects {
        name
        level
      }
    }
  }
}
```

```json
{
  "data": {
    "tutors": {
      "total": 3,
      "hasMore": true,
      "items": [
        {
          "name": "Ana Marković",
          "rating": null,
          "subjects": [{ "name": "Guitar", "level": "BEGINNER" }]
        }
      ]
    }
  }
}
```

Example — book a lesson (guarded):

```graphql
mutation {
  bookLesson(input: { tutorId: "…", subjectId: "…", startTime: "2025-07-07T09:00:00.000Z" }) {
    id
    status
    student {
      id
    }
  }
}
```

**Typed errors** surface in `errors[].extensions.code`: `NOT_FOUND` (missing
entity), `BAD_USER_INPUT` (illegal transition / business-rule violation), and
`UNAUTHENTICATED` for missing/invalid tokens.

---

## gRPC

Package `tutorhub.v1`, service `BookingService` (see
[`proto/booking.proto`](../proto/booking.proto)). Default address `localhost:50051`.

| RPC                                        | Type             | Purpose                           |
| ------------------------------------------ | ---------------- | --------------------------------- |
| `GetBooking(GetReq) → Booking`             | unary            | fetch by id                       |
| `BookLesson(BookReq) → Booking`            | unary            | create a `PENDING` booking        |
| `UpdateStatus(UpdateReq) → Booking`        | unary            | advance the lifecycle             |
| `WatchBookings(WatchReq) → stream Booking` | server-streaming | emits on every change for a tutor |

`WatchBookings` is backed by an in-process RxJS event bus (`BookingEvents`):
each create / status change pushes the booking to subscribers for that tutor.

**Status-code mapping:**

| Domain error                     | gRPC status               |
| -------------------------------- | ------------------------- |
| entity not found                 | `NOT_FOUND` (5)           |
| illegal status transition        | `FAILED_PRECONDITION` (9) |
| invalid argument / business rule | `INVALID_ARGUMENT` (3)    |

Example (grpcurl):

```bash
grpcurl -plaintext -d '{"id":"…"}' localhost:50051 tutorhub.v1.BookingService/GetBooking
```
