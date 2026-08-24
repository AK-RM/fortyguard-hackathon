const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type WallDateTime = {
  date: string;
  time: string;
};

export type DateTimeMetadata = WallDateTime & {
  display: string;
};

export class TimezoneConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimezoneConversionError";
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

function getTimeZoneOffsetMs(timeZone: string, utcMs: number): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(utcMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const localizedAsUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return localizedAsUtcMs - utcMs;
}

function formatUtcDateTime(utcMs: number): WallDateTime {
  const date = new Date(utcMs);

  return {
    date: `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`,
    time: `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`,
  };
}

/**
 * Converts a wall-clock date/time in an IANA time zone to UTC.
 */
export function convertLocalDateTimeToUtc(
  local: WallDateTime,
  timeZone: string
): WallDateTime {
  if (!isValidIanaTimeZone(timeZone)) {
    throw new TimezoneConversionError(`Invalid IANA time zone: ${timeZone}`);
  }

  const [year, month, day] = local.date.split("-").map(Number);
  const [hour, minute] = local.time.split(":").map(Number);

  let utcMs = Date.UTC(year, month - 1, day, hour, minute);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const offsetMs = getTimeZoneOffsetMs(timeZone, utcMs);
    utcMs = Date.UTC(year, month - 1, day, hour, minute) - offsetMs;
  }

  return formatUtcDateTime(utcMs);
}

export function formatLocalDateTimeDisplay(
  local: WallDateTime,
  timeZone: string
): string {
  const [year, month, day] = local.date.split("-").map(Number);
  const [hour24, minute] = local.time.split(":").map(Number);
  const hour12 = hour24 % 12 || 12;
  const ampm = hour24 < 12 ? "AM" : "PM";

  return `${day} ${MONTH_NAMES[month - 1]} ${year}, ${hour12}:${pad2(minute)} ${ampm} ${timeZone}`;
}

export function formatUtcDateTimeDisplay(utc: WallDateTime): string {
  const [year, month, day] = utc.date.split("-").map(Number);
  const [hour, minute] = utc.time.split(":").map(Number);

  return `${day} ${MONTH_NAMES[month - 1]} ${year}, ${pad2(hour)}:${pad2(minute)} UTC`;
}

export function buildLocalDateTimeMetadata(
  local: WallDateTime,
  timeZone: string
): DateTimeMetadata {
  return {
    ...local,
    display: formatLocalDateTimeDisplay(local, timeZone),
  };
}

export function buildUtcDateTimeMetadata(utc: WallDateTime): DateTimeMetadata {
  return {
    ...utc,
    display: formatUtcDateTimeDisplay(utc),
  };
}

function toLocalDateParts(local: WallDateTime) {
  const [year, month, day] = local.date.split("-").map(Number);
  const [hour, minute] = local.time.split(":").map(Number);

  return { year, month, day, hour, minute };
}

/**
 * Adds configured journey duration to a wall-clock local date/time.
 * Handles calendar rollover in local wall-clock terms (not IANA DST edge cases).
 */
export function addDurationToLocalDateTime(
  local: WallDateTime,
  durationMinutes: number
): WallDateTime {
  const { year, month, day, hour, minute } = toLocalDateParts(local);
  const start = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const arrival = new Date(start.getTime() + durationMinutes * 60_000);

  return {
    date: `${arrival.getUTCFullYear()}-${pad2(arrival.getUTCMonth() + 1)}-${pad2(arrival.getUTCDate())}`,
    time: `${pad2(arrival.getUTCHours())}:${pad2(arrival.getUTCMinutes())}`,
  };
}

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const FORTYGUARD_SINGLE_HOUR_NOTE =
  "FortyGuard Single Hour data is queried for the local hourly window containing the estimated arrival time.";

/**
 * Maps a local wall-clock datetime to the containing whole-hour bucket by
 * flooring minutes to :00. FortyGuard filter_type=1 expects a Single Hour window.
 */
export function floorLocalDateTimeToHour(local: WallDateTime): WallDateTime {
  const { year, month, day, hour } = toLocalDateParts(local);

  return {
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    time: `${pad2(hour)}:00`,
  };
}

export function formatLocalDateTimeCompactLocal(local: WallDateTime): string {
  const [year, month, day] = local.date.split("-").map(Number);
  const [hour, minute] = local.time.split(":").map(Number);

  return `${day} ${SHORT_MONTH_NAMES[month - 1]} ${year}, ${pad2(hour)}:${pad2(minute)} local`;
}

export function formatFortyGuardQueryWindowLocal(
  queryHour: WallDateTime,
  timeZone: string
): string {
  const windowEnd = addDurationToLocalDateTime(queryHour, 60);

  return `${queryHour.date} ${queryHour.time}–${windowEnd.time} ${timeZone}`;
}

export function formatFortyGuardQueryWindowDisplay(
  queryHour: WallDateTime
): string {
  const windowEnd = addDurationToLocalDateTime(queryHour, 60);

  return `${queryHour.time}–${windowEnd.time} local`;
}
