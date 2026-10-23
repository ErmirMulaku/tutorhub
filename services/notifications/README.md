# notifications (Elixir / Phoenix)

A small **Elixir/Phoenix** service that turns booking events into **lesson reminders**. It is the
one non-TypeScript service in the monorepo — included to exercise the BEAM/OTP toolchain (SPEC §17,
Phase 7).

## How it works

- **Kafka consumer** — `Notifications.BookingEventsPipeline` (Broadway + `broadway_kafka`) joins
  the consumer group `notifications-reminders` on `tutorhub.bookings.v1`. The API publishes there
  through its transactional outbox (see `docs/FRESHA_DEPTH_SPEC.md` Block 4). Each message is a
  booking event:

  ```json
  {
    "eventId": "…",
    "type": "BookingStatusChanged",
    "version": 1,
    "occurredAt": "…",
    "data": {
      "bookingId": "…",
      "status": "CONFIRMED",
      "startTime": "2026-06-22T14:00:00Z",
      "bookingVersion": 1,
      "tutorId": "…",
      "studentId": "…",
      "subjectId": "…",
      "endTime": "…"
    }
  }
  ```

- `Notifications.Reminders` (a `GenServer`, in-memory — no DB for this demo) turns CONFIRMED into
  a reminder **one hour before** the lesson, moves it on a reschedule, and cancels it on
  CANCELLED / COMPLETED / NO_SHOW. Kafka is at-least-once and events can arrive out of order, so
  each reminder keeps the booking's `bookingVersion`: an event that isn't newer is ignored
  (`:stale`). A cancel leaves a tombstone so a late "confirmed" can't bring it back.
- `Notifications.Scheduler` (a `GenServer`) ticks periodically and asks `Reminders` to **deliver**
  any due reminders. Delivery is **mocked** (logged), in the spirit of the project's mocked payments.
  The scheduler is disabled under `MIX_ENV=test`, where delivery is driven explicitly.

The old `POST /api/bookings` webhook is gone: nothing called it, and Kafka replaces it.

## Run

```bash
docker compose up -d redpanda       # from the repo root
mix deps.get                        # broadway_kafka's crc32cer NIF needs cmake (brew install cmake)
mix test                            # ExUnit: reminder rules + the pipeline (Broadway test producer, no Kafka)
KAFKA_BROKERS=localhost:9092 mix phx.server   # http://localhost:4001 (PORT overrides; the API owns 4000)
```

Without `KAFKA_BROKERS` the service starts without the consumer.

## Layout

```
lib/notifications/reminders.ex      GenServer store + scheduling/delivery
lib/notifications/scheduler.ex      periodic delivery loop (off in test)
lib/notifications/booking_events_pipeline.ex   Broadway Kafka consumer
lib/notifications_web/...           Phoenix endpoint (no routes)
test/                               ExUnit suites
```
