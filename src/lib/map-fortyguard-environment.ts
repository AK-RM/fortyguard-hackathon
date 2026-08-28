import type { EnvironmentalProvenance, EnvironmentalResult } from "@/lib/environmental-result";
import {
  parseFortyGuardEnvironmentalSource,
  mapFortyGuardEnvironmentalSourceToRiskInput,
  extractMinimumTemperatureFromSource,
  type FortyGuardEnvironmentalSource,
} from "@/lib/parse-fortyguard-environment";

export type { FortyGuardEnvironmentalSource } from "@/lib/parse-fortyguard-environment";

export class FortyGuardMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FortyGuardMappingError";
  }
}

export function mapFortyGuardEnvironmentalData(
  source: FortyGuardEnvironmentalSource
) {
  try {
    return mapFortyGuardEnvironmentalSourceToRiskInput(source);
  } catch (error) {
    throw new FortyGuardMappingError(
      error instanceof Error ? error.message : "Unable to parse FortyGuard environmental data."
    );
  }
}

export function mapFortyGuardStatsToEnvironmental(temperatureStats: unknown) {
  return mapFortyGuardEnvironmentalData({ statsData: temperatureStats });
}

export function extractFortyGuardMinimumTemperature(
  source: FortyGuardEnvironmentalSource | unknown
): number | null {
  const normalizedSource: FortyGuardEnvironmentalSource =
    typeof source === "object" && source !== null && "statsData" in source
      ? (source as FortyGuardEnvironmentalSource)
      : { statsData: source };

  return extractMinimumTemperatureFromSource(normalizedSource);
}

export { parseFortyGuardEnvironmentalSource, validateParsedTemperatureStatistics } from "@/lib/parse-fortyguard-environment";

export function buildEnvironmentalResultFromFortyGuard(params: {
  activityId: string;
  query: EnvironmentalResult["query"];
  statsData: unknown;
  mapData: unknown;
  provenance: EnvironmentalProvenance;
  provenanceNote?: string;
}): EnvironmentalResult | null {
  const parsed = parseFortyGuardEnvironmentalSource(
    {
      statsData: params.statsData,
      mapData: params.mapData,
    },
    { aoiSideMeters: params.query.aoiSideMeters }
  );

  if (!parsed.ok) {
    return null;
  }

  return {
    source: "FortyGuard",
    activityId: params.activityId,
    query: params.query,
    minimumTemperatureC: parsed.data.minimumTemperatureC,
    maximumTemperatureC: parsed.data.maximumTemperatureC,
    meanTemperatureC: parsed.data.meanTemperatureC,
    standardDeviation: parsed.data.standardDeviationC,
    cellCount: parsed.data.cellCount,
    provenance: params.provenance,
    provenanceNote: params.provenanceNote,
    aoiSideMetersUsed: params.query.aoiSideMeters,
    aoiFallbackUsed: params.query.aoiSideMeters > 400,
    granularityUsed: params.query.granularity,
    status: "completed",
  };
}
