# Query performance at scale

Measured for `docs/FRESHA_DEPTH_SPEC.md` Block 6 on a local load database, **`tutorhub_load`**
(never the dev or production database).

- **Data** (`services/api/scripts/seed-load.ts`, all generated with `generate_series` in about 4.5
  minutes):
  - 20,000 tutors and 200,000 students.
  - **2,045,000 bookings** over two years: 100 per tutor, plus one student with 25,000 bookings
    and one busy tutor with 20,000.
  - The `Booking` table is 456 MB, or 1.2 GB with indexes.
- **How to measure:** `npx tsx scripts/explain-load.ts` runs `EXPLAIN (ANALYZE, BUFFERS)` 3× per
  query and reports the median. Warm cache, Postgres 17 in Docker on an 8-core Mac.
- **Noise:** run-to-run noise at this scale is about ±50% (the same OFFSET query measured 34 ms
  and 21 ms). So compare **variants measured in the same run**, and look at **buffers** (8 kB
  pages touched) and **rows**: those don't vary between runs.

**Summary**

| #   | Query                                  | Before                                           | After                            | Change                                                |
| --- | -------------------------------------- | ------------------------------------------------ | -------------------------------- | ----------------------------------------------------- |
| 1   | Tutor dashboard list (pending / past)  | 0.12 / 0.12 ms                                   | unchanged                        | none needed — keyset + existing indexes               |
| 2   | Availability: bookings for one day     | 322 rows sent to the app                         | **32 rows**                      | code: only load bookings near the day                 |
| 3   | `myBookingsConnection` page 1,000      | OFFSET: **21 ms**, 2,566 buffers, 5 MB disk sort | keyset: **0.032 ms**, 12 buffers | keyset (Block 5) + index `(studentId, startTime, id)` |
| 4   | Analytics `lessonsOverTime` (8 months) | **10.7 ms**, 16,696 rows to the app              | **0.53 ms**, 2,416 rows          | code: only fetch the 8-month window                   |

Index changes: one replaced — `(studentId, startTime)` → `(studentId, startTime, id)`, built with
`CREATE INDEX CONCURRENTLY`. None removed as unused: `pg_stat_user_indexes` shows every
`Booking` index being scanned by the app's real queries.

---

## 1. Tutor dashboard list — `tutorBookingsConnection(status: …)`

```sql
SELECT * FROM "Booking" WHERE "tutorId" = $1 AND status = 'PENDING'
ORDER BY "startTime", id LIMIT 21;
```

The busy tutor (20,000 bookings), **pending** requests:

```
Limit (actual time=0.060..0.063 rows=21)            Buffers: shared hit=20
  -> Sort  Sort Key: "startTime", id                (top-N heapsort of 71 rows)
     -> Bitmap Heap Scan on "Booking"  rows=71
        -> Bitmap Index Scan on "Booking_tutorId_status_createdAt_idx"
             Index Cond: ("tutorId" = … AND status = 'PENDING')
Execution Time: 0.115 ms
```

**Past** lessons (`status = 'COMPLETED'`, 16,696 rows):

```
Limit (rows=21)                                     Buffers: shared hit=7
  -> Incremental Sort  Sort Key: "startTime", id
     -> Index Scan using "Booking_tutorId_startTime_idx"  rows=22
          Index Cond: ("tutorId" = …)   Filter: (status = 'COMPLETED')  Rows Removed by Filter: 4
Execution Time: 0.117 ms
```

**No change, and why.**

- **Pending requests:** a small set (only future, unanswered requests), so sorting 71 rows costs
  nothing.
- **Past lessons:** the planner walks `(tutorId, startTime)` in time order, skips the few
  non-completed rows, and **stops after 21** because there's a `LIMIT`. With keyset pagination
  every page is like this.

An index on `(tutorId, status, startTime, id)` would remove the small sort, but it would cost
about 200 MB of index and extra write work on every booking, to save microseconds. Not worth it.

## 2. Availability — the bookings a day's slots must avoid

**Before:** `getSlots` loaded **every active booking the tutor ever had**:

```sql
SELECT "startTime", "endTime" FROM "Booking"
WHERE "tutorId" = $1 AND status IN ('PENDING', 'CONFIRMED');
```

```
Bitmap Heap Scan on "Booking"  rows=322             Buffers: shared hit=44
  -> Bitmap Index Scan on "Booking_tutorId_status_createdAt_idx"  rows=322
Execution Time: 0.114 ms
```

**After** (code change in `AvailabilityService.getSlots`): only bookings overlapping
[day − 1, day + 2), which covers any tutor timezone and buffers:

```sql
… AND "startTime" < $dayPlus2 AND "endTime" > $dayMinus1
```

```
Bitmap Heap Scan on "Booking"  rows=32  (Rows Removed by Filter: 290)   Buffers: shared hit=44
Execution Time: 0.101 ms
```

**Why:**

- **It's about the rows sent, not database time.** The database time hardly moves, but the app
  receives **32 rows instead of 322**, and the slot engine checks 32 intervals instead of 322.
- **It grows without the window.** Lessons nobody marks complete stay `CONFIRMED` forever, so
  without the window this list grows with the tutor's whole history.

**Option not taken:** the same window written as a range overlap is answered **entirely by
Block 2's EXCLUDE-constraint index**. That index is a partial GiST on `(tutorId, tsrange)` that
holds only active rows, so the constraint's index doubles as an availability index:

```sql
… AND tsrange("startTime", "endTime", '[)') && tsrange($dayMinus1, $dayPlus2, '[)')
```

```
Index Scan using booking_no_tutor_overlap  rows=32                      Buffers: shared hit=17
  Index Cond: ("tutorId" = … AND tsrange("startTime","endTime",'[)') && '["2026-11-01","2026-11-04")')
Execution Time: 0.128 ms
```

It touches fewer pages (17 vs 44), but Prisma can't express `tsrange`, so it would need
`$queryRaw`. At 32 rows the plain Prisma filter is good enough. This is the next step if a tutor
ever has thousands of active bookings.

## 3. `myBookingsConnection` — page 1,000 for a student with 25,000 bookings

**OFFSET** (what `skip: 19980, take: 21` would do):

```sql
SELECT * FROM "Booking" WHERE "studentId" = $1 ORDER BY "startTime", id OFFSET 19980 LIMIT 21;
```

```
Limit (actual time=20.699..20.703 rows=21)          Buffers: shared hit=2566, temp read=622 written=645
  -> Sort  Sort Key: "startTime", id   Sort Method: external merge  Disk: 5152kB   rows=20001
     -> Bitmap Heap Scan on "Booking"  rows=25000
        -> Bitmap Index Scan on "Booking_studentId_startTime_id_idx"
Execution Time: 21.218 ms
```

What OFFSET does here:

- Reads **all 25,000** of the student's rows.
- Sorts them. On the post-backfill table that sort **spilled 5 MB to disk** because it no longer
  fit in `work_mem`.
- Throws away 19,980 of them to return 21.

The cost grows with the page number.

**Keyset** (Block 5's cursor), on the new index:

```sql
SELECT * FROM "Booking" WHERE "studentId" = $1 AND ("startTime", id) > ($cursorTime, $cursorId)
ORDER BY "startTime", id LIMIT 21;
```

```
Limit (actual time=0.013..0.022 rows=21)            Buffers: shared hit=12
  -> Index Scan using "Booking_studentId_startTime_id_idx"
       Index Cond: ("studentId" = … AND ROW("startTime", id) > ROW('2023-07-25 20:00:00', '499a…'))
Execution Time: 0.032 ms
```

**About 650× faster, 200× fewer pages, and the same cost on page 1 and page 1,000.**

**The index change.** Before, the index was `(studentId, startTime)`:

```
Limit                                               Buffers: shared hit=6
  -> Incremental Sort  Sort Key: "startTime", id   Presorted Key: "startTime"
     -> Index Scan using "Booking_studentId_startTime_idx"
          Index Cond: ("studentId" = … AND "startTime" >= '2023-07-25 20:00:00')
          Filter: (ROW("startTime", id) > ROW(…))   Rows Removed by Filter: 1
Execution Time: 0.058 ms
```

The index didn't contain `id`, so Postgres:

- had to **sort** each page again by the tie-breaker (an Incremental Sort);
- could only use `startTime >= …` to seek, then **filter** the rest.

With `(studentId, startTime, id)`, the index order **is** the query's `ORDER BY`. The plan becomes
one Index Scan, and the whole cursor condition `ROW(startTime, id) > ROW(…)` is an `Index Cond`.
That's a precise seek, with no sort and no filter.

At 21 rows per page the time difference is within noise. The plan is simpler and holds up with
many ties (lessons at the same time) and larger pages.

- **Cost:** the index is 221 MB vs 170 MB, because it also stores `id`.
- **Column order:** the equality column (`studentId`) first, then the sort columns in `ORDER BY`
  order. Put `startTime` first and the index can't jump to one student.

## 4. Analytics — `lessonsOverTime` (completed lessons per month, last 8 months)

**Before:** `analytics.service.ts` loaded **every** completed lesson the tutor ever had, joined to
its subject, and counted them into 8 buckets in Node:

```sql
SELECT b."studentId", b."startTime", s.name FROM "Booking" b JOIN "Subject" s ON s.id = b."subjectId"
WHERE b."tutorId" = $1 AND b.status = 'COMPLETED';
```

```
Hash Join  rows=16696                               Buffers: shared hit=2201
  -> Bitmap Heap Scan on "Booking" b  rows=16696
     -> Bitmap Index Scan on "Booking_tutorId_status_createdAt_idx"
  -> Hash -> Seq Scan on "Subject" s  rows=20001    ← the whole Subject table, for a column unused here
Execution Time: 10.723 ms
```

**After** (code change): only the 8 months the chart shows, and only the column it needs:

```sql
SELECT "startTime" FROM "Booking"
WHERE "tutorId" = $1 AND status = 'COMPLETED' AND "startTime" >= $firstDayOfWindow;
```

```
Bitmap Heap Scan on "Booking"  rows=2416  (Rows Removed by Filter: 784)  Buffers: shared hit=368
  -> Bitmap Index Scan on "Booking_tutorId_startTime_idx"
       Index Cond: ("tutorId" = … AND "startTime" >= '2026-03-01')
Execution Time: 0.531 ms
```

**About 20× faster, 6× fewer pages, and 7× fewer rows shipped to Node.** Results are identical:
rows older than the window always fell outside the 8 buckets.

**Option not taken:** count in SQL (`GROUP BY date_trunc('month', "startTime")`) returns 8 rows
instead of 2,416. Measured at 0.87 ms: the same pages read, plus the aggregation. The catch is
**which month a lesson belongs to**:

- the current code buckets by the server's local time;
- `date_trunc` on a `timestamp` column buckets by UTC;
- the correct answer is probably the **tutor's** timezone.

Changing that changes the numbers tutors see near midnight on month boundaries. It's a product
decision, so I didn't slip it into a performance change.

---

## Things to know before running this at Fresha's scale

- **Keyset vs OFFSET:**
  - **OFFSET** costs O(page × size) and moves under concurrent inserts.
  - **Keyset** costs O(size) at any depth and is stable.
  - Keyset can't jump to page N or give a total count for free.
- **Composite index order:** equality columns first, then range or sort columns, with the
  tie-breaker last. The index's order must match the `ORDER BY` for the plan to skip the sort.
- **Partial indexes:** only rows that match a `WHERE` are stored.
  - The EXCLUDE constraint indexes hold active bookings only: 13–14 MB vs about 200 MB for a full
    index on the same columns.
  - The planner uses a partial index whenever the query's `WHERE` implies the index's `WHERE`.
- **Read replicas:** analytics and long lists can read from a replica, but replicas lag.
  - Right after a booking, the student's "my bookings" must read from the **primary** (or wait
    until the replica has replayed past the write's LSN). Otherwise the booking seems to vanish.
    That's read-your-writes.
- **When to partition `Booking` by month:** not at 2M rows, since the indexes do the work. Partition
  when either of these becomes true:
  - **Retention:** you need to drop or archive old data cheaply. Dropping a partition is instant;
    `DELETE` of 100M rows is not.
  - **Size:** a single index no longer fits in memory, or VACUUM on one huge table falls behind.

  Costs:
  - The partition key must be part of every unique or exclusion constraint. Our overlap constraints
    are per tutor, so they'd have to include the month.
  - Queries without the partition key fan out to every partition.
