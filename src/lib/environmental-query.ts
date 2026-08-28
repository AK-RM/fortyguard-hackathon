import type { DischargeJourney, DischargeLocation } from "@/types/discharge-workflow";

import {
  addDurationToLocalDateTime,
  floorLocalDateTimeToHour,
} from "./discharge-timezone";

export const DEFAULT_AOI_SIDE_METERS = 400;
export const INITIAL_AOI_SIDE_METERS = 400;
export const EXPANDED_AOI_SIDE_METERS = 1600;
export const DEFAULT_GRANULARITY = 100;

export type EnvironmentalQuery = {
  destinationLabel: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  startDate: string;
  startTime: string;
  aoiSideMeters: number;
  granularity: number;
};

export function canonicalizeCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function buildEnvironmentalQueryKey(query: EnvironmentalQuery): string {
  return JSON.stringify({
    lat: canonicalizeCoordinate(query.latitude),
    lon: canonicalizeCoordinate(query.longitude),
    tz: query.timeZone,
    date: query.startDate,
    time: query.startTime,
    aoi: query.aoiSideMeters,
    gran: query.granularity,
  });
}

export function buildEnvironmentalQueryFromDischarge(
  destination: DischargeLocation,
  journey: DischargeJourney,
  options?: { aoiSideMeters?: number; granularity?: number }
): EnvironmentalQuery {
  const arrivalDateTime = addDurationToLocalDateTime(
    { date: journey.date, time: journey.time },
    journey.durationMinutes
  );
  const queryHour = floorLocalDateTimeToHour(arrivalDateTime);

  return {
    destinationLabel: destination.label,
    latitude: canonicalizeCoordinate(destination.latitude),
    longitude: canonicalizeCoordinate(destination.longitude),
    timeZone: journey.timeZone,
    startDate: queryHour.date,
    startTime: queryHour.time,
    aoiSideMeters: options?.aoiSideMeters ?? DEFAULT_AOI_SIDE_METERS,
    granularity: options?.granularity ?? DEFAULT_GRANULARITY,
  };
}

export function buildExpandedEnvironmentalQuery(
  query: EnvironmentalQuery
): EnvironmentalQuery {
  return {
    ...query,
    aoiSideMeters: EXPANDED_AOI_SIDE_METERS,
  };
}

export function isInitialAoiQuery(query: EnvironmentalQuery): boolean {
  return query.aoiSideMeters === INITIAL_AOI_SIDE_METERS;
}

export function environmentalQueriesMatch(
  left: EnvironmentalQuery,
  right: EnvironmentalQuery
): boolean {
  return buildEnvironmentalQueryKey(left) === buildEnvironmentalQueryKey(right);
}
