/**
 * "Today" means today *in the parish's timezone* — not the server's.
 *
 * Railway containers run in UTC, so `new Date().setHours(0,0,0,0)` produced a
 * UTC midnight window. For a parish on WIB (UTC+7) that window is wrong for
 * seven hours of every day: at 02:00 WIB the server is still on the previous
 * UTC date, so the Monitor Display showed an empty schedule while five
 * approved bookings existed for the day the staff were actually looking at.
 */
export function parishTimeZone(): string {
  return process.env.PARISH_TIMEZONE ?? 'Asia/Jakarta';
}

/**
 * Offset (ms) to add to a UTC instant to get the wall-clock time in `timeZone`.
 * Derived from Intl rather than hardcoded so it stays correct if the parish
 * timezone is ever changed to one that observes DST.
 */
function offsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(instant).map((x) => [x.type, x.value]));
  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  // Intl only resolves to whole seconds, so compare against a second-truncated
  // instant. Otherwise the offset absorbs the millisecond remainder and the
  // computed day boundary lands a fraction of a second late — enough to exclude
  // a booking starting exactly at local midnight.
  const truncatedToSecond = Math.floor(instant.getTime() / 1000) * 1000;
  return asIfUtc - truncatedToSecond;
}

/**
 * The UTC instants bounding a calendar day in the parish timezone.
 * Pass `reference` to get the range for the day containing that instant.
 */
export function parishDayRange(reference: Date = new Date()): { start: Date; end: Date } {
  const tz = parishTimeZone();
  const offset = offsetMs(reference, tz);

  // Shift into "wall clock as UTC" space so date arithmetic is trivial.
  const wall = new Date(reference.getTime() + offset);
  const startWall = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate(), 0, 0, 0, 0);
  const endWall = startWall + 24 * 60 * 60 * 1000 - 1;

  return { start: new Date(startWall - offset), end: new Date(endWall - offset) };
}

/** Monday 00:00 → next Monday 00:00, in the parish timezone. */
export function parishWeekRange(reference: Date = new Date()): { start: Date; end: Date } {
  const tz = parishTimeZone();
  const offset = offsetMs(reference, tz);
  const wall = new Date(reference.getTime() + offset);

  const dayIndex = (wall.getUTCDay() + 6) % 7; // 0 = Monday
  const startWall = Date.UTC(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate() - dayIndex,
    0,
    0,
    0,
    0,
  );
  const endWall = startWall + 7 * 24 * 60 * 60 * 1000;

  return { start: new Date(startWall - offset), end: new Date(endWall - offset) };
}
