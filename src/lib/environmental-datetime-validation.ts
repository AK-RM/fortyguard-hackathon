import type { DischargeJourney } from "@/types/discharge-workflow";

import {
  addDurationToLocalDateTime,
  convertLocalDateTimeToUtc,
  floorLocalDateTimeToHour,
  isValidIanaTimeZone,
  type WallDateTime,
} from "./discharge-timezone";

export const ENVIRONMENTAL_HISTORICAL_EARLIEST: WallDateTime = {
  date: "2021-01-01",
  time: "00:00",
};

export const ENVIRONMENTAL_FORECAST_HORIZON_MS = 12 * 60 * 60 * 1000;

export const ENVIRONMENTAL_HISTORICAL_EARLIEST_MESSAGE =
  "FortyGuard historical temperature data is available from 1 January 2021.";

export const ENVIRONMENTAL_FORECAST_HORIZON_MESSAGE =
  "FortyGuard forecast data is available up to 12 hours ahead. Choose an earlier arrival time.";

export type EnvironmentalTemporalReasonCode =
  | "date_before_historical_range"
  | "date_beyond_forecast_horizon"
  | "invalid_environmental_datetime";

export type EnvironmentalDatetimeValidationResult =
  | {
      ok: true;
      arrivalDateTime: WallDateTime;
      queryHour: WallDateTime;
    }
  | {
      ok: false;
      reasonCode: EnvironmentalTemporalReasonCode;
      message: string;
    };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidCalendarDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function localDateTimeToUtcMs(
  local: WallDateTime,
  timeZone: string
): number | null {
  if (!DATE_PATTERN.test(local.date) || !TIME_PATTERN.test(local.time)) {
    return null;
  }

  if (!isValidIanaTimeZone(timeZone)) {
    return null;
  }

  try {
    const utc = convertLocalDateTimeToUtc(local, timeZone);
    const [year, month, day] = utc.date.split("-").map(Number);
    const [hour, minute] = utc.time.split(":").map(Number);

    return Date.UTC(year, month - 1, day, hour, minute);
  } catch {
    return null;
  }
}

export function resolveEnvironmentalArrivalDateTime(
  journey: Pick<DischargeJourney, "date" | "time" | "durationMinutes">
): WallDateTime | null {
  if (
    !isValidCalendarDate(journey.date) ||
    !TIME_PATTERN.test(journey.time) ||
    !Number.isFinite(journey.durationMinutes)
  ) {
    return null;
  }

  return addDurationToLocalDateTime(
    { date: journey.date, time: journey.time },
    journey.durationMinutes
  );
}

export function validateEnvironmentalQueryDatetime(params: {
  journey: Pick<DischargeJourney, "date" | "time" | "timeZone" | "durationMinutes">;
  now?: Date;
}): EnvironmentalDatetimeValidationResult {
  const { journey } = params;
  const now = params.now ?? new Date();

  if (
    !isValidCalendarDate(journey.date) ||
    !TIME_PATTERN.test(journey.time) ||
    !isValidIanaTimeZone(journey.timeZone) ||
    !Number.isFinite(journey.durationMinutes) ||
    journey.durationMinutes <= 0
  ) {
    return {
      ok: false,
      reasonCode: "invalid_environmental_datetime",
      message: "Enter a valid departure date and time for the destination timezone.",
    };
  }

  const arrivalDateTime = resolveEnvironmentalArrivalDateTime(journey);

  if (!arrivalDateTime) {
    return {
      ok: false,
      reasonCode: "invalid_environmental_datetime",
      message: "Enter a valid departure date and time for the destination timezone.",
    };
  }

  const queryHour = floorLocalDateTimeToHour(arrivalDateTime);
  const arrivalUtcMs = localDateTimeToUtcMs(arrivalDateTime, journey.timeZone);
  const earliestUtcMs = localDateTimeToUtcMs(
    ENVIRONMENTAL_HISTORICAL_EARLIEST,
    journey.timeZone
  );

  if (arrivalUtcMs === null || earliestUtcMs === null) {
    return {
      ok: false,
      reasonCode: "invalid_environmental_datetime",
      message: "Enter a valid departure date and time for the destination timezone.",
    };
  }

  if (arrivalUtcMs < earliestUtcMs) {
    return {
      ok: false,
      reasonCode: "date_before_historical_range",
      message: ENVIRONMENTAL_HISTORICAL_EARLIEST_MESSAGE,
    };
  }

  const forecastLimitUtcMs = now.getTime() + ENVIRONMENTAL_FORECAST_HORIZON_MS;

  if (arrivalUtcMs > forecastLimitUtcMs) {
    return {
      ok: false,
      reasonCode: "date_beyond_forecast_horizon",
      message: ENVIRONMENTAL_FORECAST_HORIZON_MESSAGE,
    };
  }

  return {
    ok: true,
    arrivalDateTime,
    queryHour,
  };
}

export function getEnvironmentalTemporalValidationMessage(
  reasonCode: EnvironmentalTemporalReasonCode
): string {
  switch (reasonCode) {
    case "date_before_historical_range":
      return ENVIRONMENTAL_HISTORICAL_EARLIEST_MESSAGE;
    case "date_beyond_forecast_horizon":
      return ENVIRONMENTAL_FORECAST_HORIZON_MESSAGE;
    case "invalid_environmental_datetime":
      return "Enter a valid departure date and time for the destination timezone.";
    default:
      return "Enter a valid departure date and time for the destination timezone.";
  }
}
