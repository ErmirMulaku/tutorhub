# notifications (Elixir / Phoenix)

A small **Elixir/Phoenix** service that turns booking events into **lesson reminders**. It is the
one non-TypeScript service in the monorepo — included to exercise the BEAM/OTP toolchain (SPEC §17,
Phase 7).

## How it works

- **Webhook** `POST /api/bookings` receives a booking event (the API posts here when a lesson is
  booked, or one could subscribe to the API's gRPC `WatchBookings` stream instead):

  ```json
  { "id": "…", "subject": "Maths", "tutorName": "Ben Carter", "startTime": "2026-06-22T14:00:00Z" }
  ```

- `Notifications.Reminders` (a `GenServer`, in-memory — no DB for this demo) schedules a reminder
  for **one hour before** the lesson and de-duplicates by booking id.
- `Notifications.Scheduler` (a `GenServer`) ticks periodically and asks `Reminders` to **deliver**
  any due reminders. Delivery is **mocked** (logged), in the spirit of the project's mocked payments.
  The scheduler is disabled under `MIX_ENV=test`, where delivery is driven explicitly.

## Run

```bash
mix deps.get
mix test                 # ExUnit: scheduling, idempotent delivery, the webhook
mix phx.server           # http://localhost:4001  (PORT overrides; the API owns 4000)
```

```bash
curl -X POST http://localhost:4001/api/bookings -H 'content-type: application/json' \
  -d '{"id":"b1","subject":"Maths","tutorName":"Ben Carter","startTime":"2026-06-22T14:00:00Z"}'
# → 202 { "scheduled": true, "remindAt": "2026-06-22T13:00:00Z" }
```

## Layout

```
lib/notifications/reminders.ex      GenServer store + scheduling/delivery
lib/notifications/scheduler.ex      periodic delivery loop (off in test)
lib/notifications_web/...           Phoenix endpoint + booking webhook
test/                               ExUnit suites
```
