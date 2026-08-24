import type { EnvironmentalQuery } from "./environmental-query";
import { buildEnvironmentalQueryKey, canonicalizeCoordinate } from "./environmental-query";
import type { EnvironmentalResult } from "./environmental-result";

export const VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID =
  "c2307681-94c3-40ff-b2ac-952d47d1fb9f";

export const VERIFIED_CENTRAL_PHOENIX_QUERY: EnvironmentalQuery = {
  destinationLabel: "Central Phoenix, Arizona",
  latitude: canonicalizeCoordinate(33.4484),
  longitude: canonicalizeCoordinate(-112.074),
  timeZone: "America/Phoenix",
  startDate: "2026-08-18",
  startTime: "14:00",
  aoiSideMeters: 400,
  granularity: 100,
};

export const VERIFIED_CENTRAL_PHOENIX_QUERY_KEY = buildEnvironmentalQueryKey(
  VERIFIED_CENTRAL_PHOENIX_QUERY
);

export const VERIFIED_CENTRAL_PHOENIX_RESULT: EnvironmentalResult = {
  source: "FortyGuard",
  activityId: VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID,
  query: VERIFIED_CENTRAL_PHOENIX_QUERY,
  minimumTemperatureC: 41.5432,
  maximumTemperatureC: 41.5619,
  meanTemperatureC: 41.55235,
  standardDeviation: 0.00659282438210968,
  cellCount: 16,
  provenance: "verified_historical",
  provenanceNote:
    "Verified historical FortyGuard result captured during hackathon development for Central Phoenix Single Hour 2026-08-18 14:00–15:00 local.",
  status: "completed",
};

export function lookupVerifiedEnvironmentalResult(
  query: EnvironmentalQuery
): EnvironmentalResult | null {
  if (buildEnvironmentalQueryKey(query) === VERIFIED_CENTRAL_PHOENIX_QUERY_KEY) {
    return VERIFIED_CENTRAL_PHOENIX_RESULT;
  }

  return null;
}
