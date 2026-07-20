import { Temporal } from '@js-temporal/polyfill';

/**
 * "Today" means today *in the parish's timezone* — not the server's.
 *
 * Railway containers run in UTC, so `new Date().setHours(0,0,0,0)` produced a
 * UTC midnight window. For a parish on WIB (UTC+7) that window is wrong for
 * seven hours of every day: at 02:00 WIB the server is still on the previous
 * UTC date, so the Monitor Display showed an empty schedule while five
 * approved bookings existed for the day the staff were actually looking at.
 *
 * Uses Temporal, which models a zoned date-time directly instead of inferring
 * the offset by formatting through Intl and diffing the result. `startOfDay()`
 * is also DST-correct by construction — on a day where local midnight does not
 * exist it returns the first instant that does.
 *
 * Temporal is still a Stage 3 proposal: Node 22 (the runtime in our Dockerfile)
 * does not expose it, and Node 24 only does behind --harmony-temporal. Hence
 * the official polyfill. When the runtime ships it natively this import is the
 * only line that needs to change.
 */
export function parishTimeZone(): string {
  return process.env.PARISH_TIMEZONE ?? 'Asia/Jakarta';
}

/**
 * Half-open range `[start, end)` covering a calendar day in the parish
 * timezone, as UTC instants.
 *
 * The upper bound is *exclusive* — callers must query with `lt`, not `lte`.
 * That avoids the classic "23:59:59.999" fudge, which silently drops anything
 * landing in the final millisecond.
 */
export function parishDayRange(reference: Date = new Date()): { start: Date; end: Date } {
  const zoned = Temporal.Instant.fromEpochMilliseconds(reference.getTime()).toZonedDateTimeISO(
    parishTimeZone(),
  );

  const start = zoned.startOfDay();
  const end = start.add({ days: 1 });

  return {
    start: new Date(start.epochMilliseconds),
    end: new Date(end.epochMilliseconds),
  };
}

/**
 * Half-open range `[start, end)` covering the Monday–Sunday week containing
 * `reference`, in the parish timezone.
 */
export function parishWeekRange(reference: Date = new Date()): { start: Date; end: Date } {
  const zoned = Temporal.Instant.fromEpochMilliseconds(reference.getTime()).toZonedDateTimeISO(
    parishTimeZone(),
  );

  // Temporal's dayOfWeek is ISO-numbered: 1 = Monday … 7 = Sunday.
  const start = zoned.subtract({ days: zoned.dayOfWeek - 1 }).startOfDay();
  const end = start.add({ weeks: 1 });

  return {
    start: new Date(start.epochMilliseconds),
    end: new Date(end.epochMilliseconds),
  };
}
