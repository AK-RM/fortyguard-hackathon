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

export const VERIFIED_TUCSON_ACTIVITY_ID =
  "c33a57a2-bb79-4946-b800-90624da8c700";

export const VERIFIED_TUCSON_QUERY: EnvironmentalQuery = {
  destinationLabel: "Tucson Medical Center area, Arizona",
  latitude: canonicalizeCoordinate(32.2411),
  longitude: canonicalizeCoordinate(-110.9462),
  timeZone: "America/Phoenix",
  startDate: "2026-08-18",
  startTime: "14:00",
  aoiSideMeters: 400,
  granularity: 100,
};

export const VERIFIED_TUCSON_QUERY_KEY = buildEnvironmentalQueryKey(
  VERIFIED_TUCSON_QUERY
);

export const VERIFIED_TUCSON_RESULT: EnvironmentalResult = {
  source: "FortyGuard",
  activityId: VERIFIED_TUCSON_ACTIVITY_ID,
  query: VERIFIED_TUCSON_QUERY,
  minimumTemperatureC: 39.67,
  maximumTemperatureC: 39.7909,
  meanTemperatureC: 39.71535,
  standardDeviation: 0.05113288011222598,
  cellCount: 8,
  provenance: "verified_historical",
  provenanceNote:
    "Verified FortyGuard result captured during hackathon product verification for Tucson Single Hour 2026-08-18 14:00–15:00 local.",
  status: "completed",
};

export const VERIFIED_CENTRAL_PHOENIX_EARLY_ACTIVITY_ID =
  "20258c9e-f533-4c58-ba4d-5903ddf29984";

export const VERIFIED_CENTRAL_PHOENIX_EARLY_QUERY: EnvironmentalQuery = {
  destinationLabel: "Central Phoenix, Arizona",
  latitude: canonicalizeCoordinate(33.4484),
  longitude: canonicalizeCoordinate(-112.074),
  timeZone: "America/Phoenix",
  startDate: "2026-08-18",
  startTime: "06:00",
  aoiSideMeters: 400,
  granularity: 100,
};

export const VERIFIED_CENTRAL_PHOENIX_EARLY_QUERY_KEY = buildEnvironmentalQueryKey(
  VERIFIED_CENTRAL_PHOENIX_EARLY_QUERY
);

export const VERIFIED_CENTRAL_PHOENIX_EARLY_RESULT: EnvironmentalResult = {
  source: "FortyGuard",
  activityId: VERIFIED_CENTRAL_PHOENIX_EARLY_ACTIVITY_ID,
  query: VERIFIED_CENTRAL_PHOENIX_EARLY_QUERY,
  minimumTemperatureC: 34.2125,
  maximumTemperatureC: 34.2476,
  meanTemperatureC: 34.2316125,
  standardDeviation: 0.010505292317049999,
  cellCount: 16,
  provenance: "verified_historical",
  provenanceNote:
    "Verified FortyGuard result captured during hackathon product verification for Central Phoenix Single Hour 2026-08-18 06:00–07:00 local.",
  status: "completed",
};

export type VerifiedEnvironmentalScenario = {
  id: string;
  label: string;
  query: EnvironmentalQuery;
  result: EnvironmentalResult;
};

export const VERIFIED_ENVIRONMENTAL_SCENARIOS: VerifiedEnvironmentalScenario[] = [
  {
    id: "central-phoenix-1400",
    label: "Central Phoenix · 14:00–15:00 local",
    query: VERIFIED_CENTRAL_PHOENIX_QUERY,
    result: VERIFIED_CENTRAL_PHOENIX_RESULT,
  },
  {
    id: "central-phoenix-0600",
    label: "Central Phoenix · 06:00–07:00 local",
    query: VERIFIED_CENTRAL_PHOENIX_EARLY_QUERY,
    result: VERIFIED_CENTRAL_PHOENIX_EARLY_RESULT,
  },
  {
    id: "tucson-1400",
    label: "Tucson · 14:00–15:00 local",
    query: VERIFIED_TUCSON_QUERY,
    result: VERIFIED_TUCSON_RESULT,
  },
];

const VERIFIED_RESULTS_BY_KEY = new Map<string, EnvironmentalResult>([
  [VERIFIED_CENTRAL_PHOENIX_QUERY_KEY, VERIFIED_CENTRAL_PHOENIX_RESULT],
  [VERIFIED_CENTRAL_PHOENIX_EARLY_QUERY_KEY, VERIFIED_CENTRAL_PHOENIX_EARLY_RESULT],
  [VERIFIED_TUCSON_QUERY_KEY, VERIFIED_TUCSON_RESULT],
]);

export function lookupVerifiedEnvironmentalResult(
  query: EnvironmentalQuery
): EnvironmentalResult | null {
  return VERIFIED_RESULTS_BY_KEY.get(buildEnvironmentalQueryKey(query)) ?? null;
}

export function getVerifiedScenarioById(
  id: string
): VerifiedEnvironmentalScenario | null {
  return VERIFIED_ENVIRONMENTAL_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

export function isVerifiedEnvironmentalResult(result: EnvironmentalResult): boolean {
  return VERIFIED_ENVIRONMENTAL_SCENARIOS.some(
    (scenario) => scenario.result.activityId === result.activityId
  );
}
