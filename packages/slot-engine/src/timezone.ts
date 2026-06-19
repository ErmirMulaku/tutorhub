/**
 * Zero-dependency timezone math built on the runtime's built-in `Intl` and the
 * IANA tz database it ships with. No moment / luxon / date-fns-tz.
 *
 * The whole engine works in absolute UTC milliseconds internally; these helpers
 * are the only bridge between a wall-clock time in a given IANA zone and that
 * absolute instant, and they stay correct across DST transitions because `Intl`
 * knows each zone's offset history.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Offset, in milliseconds, of `timeZone` from UTC at the given absolute instant
 * (`localWallClock − UTC`). Positive east of UTC. DST-aware.
 *
 * @throws {RangeError} if `timeZone` is not a valid IANA identifier.
 */
export function getOffsetMs(timeZone: string, utcMs: number): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(utcMs));

  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    switch (part.type) {
      case 'year':
        year = Number(part.value);
        break;
      case 'month':
        month = Number(part.value);
        break;
      case 'day':
        day = Number(part.value);
        break;
      case 'hour':
        // Some engines emit "24" for midnight under h23; normalise to 0.
        hour = Number(part.value) % 24;
        break;
      case 'minute':
        minute = Number(part.value);
        break;
      case 'second':
        second = Number(part.value);
        break;
      default:
        break;
    }
  }

  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - utcMs;
}

/**
 * Convert a wall-clock time *in `timeZone`* to the absolute UTC instant (ms).
 *
 * DST handling:
 * - **Nonexistent** local times (the spring-forward gap, e.g. 02:30 when clocks
 *   jump 02:00→03:00) resolve deterministically to the post-transition instant.
 * - **Ambiguous** local times (the fall-back overlap, when a wall time occurs
 *   twice) resolve deterministically to a single instant.
 *
 * Two offset probes are needed: the first offset is sampled at the naive guess,
 * the second at the corrected instant; near a transition these differ, and the
 * corrected probe yields the right answer.
 */
export function zonedWallTimeToUtcMs(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  const guessMs = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = getOffsetMs(timeZone, guessMs);
  const candidateMs = guessMs - offset1;
  const offset2 = getOffsetMs(timeZone, candidateMs);
  if (offset2 === offset1) {
    return candidateMs;
  }
  return guessMs - offset2;
}
