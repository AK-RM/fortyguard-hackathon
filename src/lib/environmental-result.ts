import type { EnvironmentalQuery } from "./environmental-query";

export type EnvironmentalProvenance = "verified_historical" | "live_completed";

export type EnvironmentalResultStatus = "completed";

export type EnvironmentalResult = {
  source: "FortyGuard";
  activityId: string;
  query: EnvironmentalQuery;
  minimumTemperatureC: number;
  maximumTemperatureC: number;
  meanTemperatureC: number;
  standardDeviation: number;
  cellCount: number;
  provenance: EnvironmentalProvenance;
  provenanceNote?: string;
  status: EnvironmentalResultStatus;
};

export type FortyGuardStatsPayload = {
  temperature_stats?: {
    minimum?: number;
    maximum?: number;
    mean?: number;
    standard_deviation?: number;
  };
};

export type FortyGuardMapPayload = {
  features?: unknown[];
};

export function buildEnvironmentalResultFromFortyGuard(params: {
  activityId: string;
  query: EnvironmentalQuery;
  statsData: unknown;
  mapData: unknown;
  provenance: EnvironmentalProvenance;
  provenanceNote?: string;
}): EnvironmentalResult | null {
  const stats = params.statsData as FortyGuardStatsPayload | null;
  const temperatureStats = stats?.temperature_stats;

  if (
    !temperatureStats ||
    typeof temperatureStats.minimum !== "number" ||
    typeof temperatureStats.maximum !== "number" ||
    typeof temperatureStats.mean !== "number" ||
    typeof temperatureStats.standard_deviation !== "number"
  ) {
    return null;
  }

  const map = params.mapData as FortyGuardMapPayload | null;
  const cellCount = Array.isArray(map?.features) ? map.features.length : 0;

  return {
    source: "FortyGuard",
    activityId: params.activityId,
    query: params.query,
    minimumTemperatureC: temperatureStats.minimum,
    maximumTemperatureC: temperatureStats.maximum,
    meanTemperatureC: temperatureStats.mean,
    standardDeviation: temperatureStats.standard_deviation,
    cellCount,
    provenance: params.provenance,
    provenanceNote: params.provenanceNote,
    status: "completed",
  };
}
