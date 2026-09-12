/**
 * Dates, clocks and time zones.
 *
 * The network spans three time zones, so every flight time is stored as a UTC
 * instant and rendered in the local time of the airport it happens at. A
 * departure board that shows Cambridge Bay times in Iqaluit's clock is worse
 * than useless to the person reading it.
 *
 * Dates the user picks are plain 'YYYY-MM-DD' strings with no zone attached —
 * a Tuesday flight is on Tuesday wherever you are looking at it from.
 */

const DAY_MS = 86400000;

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' for a Date, read in UTC. */
export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/** Parse 'YYYY-MM-DD' to a Date at UTC midnight. */
export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso, days) {
  return isoDate(new Date(parseDate(iso).getTime() + days * DAY_MS));
}

export function daysBetween(fromIso, toIso) {
  return Math.round((parseDate(toIso) - parseDate(fromIso)) / DAY_MS);
}

/** ISO weekday, Monday 1 through Sunday 7. */
export function weekday(iso) {
  return parseDate(iso).getUTCDay() || 7;
}

/**
 * ISO-8601 week number.
 *
 * The alternating circuits hang off this: North Baffin flies even weeks, East
 * Baffin odd ones. ISO weeks are used rather than "every 14 days from a start
 * date" so the fortnight never drifts and a timetable printed in January still
 * describes December.
 */
export function isoWeek(iso) {
  const date = parseDate(iso);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / DAY_MS + 1) / 7);
}

export const isEvenWeek = (iso) => isoWeek(iso) % 2 === 0;

/**
 * Whether North American daylight time is in effect on a date.
 *
 * Second Sunday in March to the first Sunday in November. Resolution is one
 * day, which is enough: nothing on this network departs at 02:00.
 */
export function isDaylightTime(iso) {
  const date = parseDate(iso);
  const year = date.getUTCFullYear();
  const nthSunday = (month, n) => {
    const first = new Date(Date.UTC(year, month, 1));
    const offset = (7 - first.getUTCDay()) % 7;
    return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
  };
  return date >= nthSunday(2, 2) && date < nthSunday(10, 1);
}

/** An airport's offset from UTC in hours on a given date. */
export function utcOffset(airport, iso) {
  return airport.tz + (airport.noDst ? 0 : isDaylightTime(iso) ? 1 : 0);
}

/** Turn a local clock time at an airport into a UTC instant. */
export function localToUtc(airport, iso, minutes) {
  return parseDate(iso).getTime() + (minutes - utcOffset(airport, iso) * 60) * 60000;
}

/** Render a UTC instant as the local clock at an airport. */
export function localClock(airport, utcMs) {
  const probe = isoDate(new Date(utcMs));
  const shifted = new Date(utcMs + utcOffset(airport, probe) * 3600000);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** The local calendar date at an airport for a UTC instant. */
export function localDate(airport, utcMs) {
  const probe = isoDate(new Date(utcMs));
  return isoDate(new Date(utcMs + utcOffset(airport, probe) * 3600000));
}

/**
 * Days a flight arrives after it departs, in local terms.
 *
 * Shown as the "+1" beside an arrival time. Worth getting right: a westbound
 * jet out of Ottawa can land on the day it left even after four hours in the
 * air, and a circuit that starts on Tuesday finishes on Wednesday.
 */
export function dayOffset(fromAirport, departUtc, toAirport, arriveUtc) {
  return daysBetween(localDate(fromAirport, departUtc), localDate(toAirport, arriveUtc));
}

export const timeZoneLabel = (airport, iso) => {
  const offset = utcOffset(airport, iso);
  const names = { '-4': 'ADT', '-5': 'EST/EDT', '-6': 'CST/CDT', '-7': 'MST/MDT' };
  return names[String(offset)] ?? `UTC${offset >= 0 ? '+' : ''}${offset}`;
};

/* ── Formatting ──────────────────────────────────────────────────────────── */

export function formatDate(iso, style = 'medium') {
  const date = parseDate(iso);
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  const dow = (date.getUTCDay() || 7) - 1;
  if (style === 'short') return `${WEEKDAYS_SHORT[dow]} ${day} ${MONTHS_SHORT[month]}`;
  if (style === 'long') return `${WEEKDAYS[dow]} ${day} ${MONTHS[month]} ${date.getUTCFullYear()}`;
  if (style === 'compact') return `${day} ${MONTHS_SHORT[month]}`;
  return `${WEEKDAYS_SHORT[dow]} ${day} ${MONTHS_SHORT[month]} ${date.getUTCFullYear()}`;
}

/** Minutes as an airline duration: 3h 05m, or 45m under the hour. */
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
}

/** Local clock minutes as 'HH:MM'. */
export function formatClock(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Today, as the app sees it. */
export const today = () => isoDate(new Date());
