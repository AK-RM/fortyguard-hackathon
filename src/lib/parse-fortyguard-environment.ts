import type { EnvironmentalFailureReasonCode } from "@/lib/environmental-failure";
import {
  EXPANDED_AOI_SIDE_METERS,
  INITIAL_AOI_SIDE_METERS,
} from "@/lib/environmental-query";

export type FortyGuardEnvironmentalSource = {
  statsData: unknown;
  mapData?: unknown;
};

export type ParsedFortyGuardEnvironmentalStatistics = {
  minimumTemperatureC: number;
  maximumTemperatureC: number;
  meanTemperatureC: number;
  standardDeviationC: number;
  cellCount: number;
};

export type ParseFortyGuardEnvironmentalResult =
  | { ok: true; data: ParsedFortyGuardEnvironmentalStatistics }
  | { ok: false; reasonCode: EnvironmentalFailureReasonCode };

type FortyGuardTemperatureStatsBlock = {
  mean?: unknown;
  maximum?: unknown;
  max?: unknown;
  minimum?: unknown;
  min?: unknown;
  average?: unknown;
  avg?: unknown;
  mean_temperature?: unknown;
  maximum_temperature?: unknown;
  max_temperature?: unknown;
  minimum_temperature?: unknown;
  min_temperature?: unknown;
  standard_deviation?: unknown;
};

type FortyGuardStatsPayload = {
  temperature_stats?: FortyGuardTemperatureStatsBlock;
  temperatureStats?: FortyGuardTemperatureStatsBlock;
  overall_temperature_distribution?: unknown;
  mean?: unknown;
  maximum?: unknown;
  max?: unknown;
  minimum?: unknown;
  mean_temperature?: unknown;
  maximum_temperature?: unknown;
  max_temperature?: unknown;
  minimum_temperature?: unknown;
};

type MapFeatureProperties = {
  average_temperature?: unknown;
  min_temperature?: unknown;
  max_temperature?: unknown;
};

export const MIN_PLAUSIBLE_TEMPERATURE_C = -40;
export const MAX_PLAUSIBLE_TEMPERATURE_C = 60;

function roundTemperature(value: number): number {
  return Math.round(value * 100) / 100;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function unwrapPayload(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  return raw;
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function readStatsBlock(
  block: FortyGuardTemperatureStatsBlock | undefined
): {
  mean: number;
  maximum: number;
  minimum: number | null;
  standardDeviation: number | null;
} | null {
  if (!block) {
    return null;
  }

  const mean = toFiniteNumber(
    block.mean ?? block.average ?? block.avg ?? block.mean_temperature
  );
  const maximum = toFiniteNumber(
    block.maximum ?? block.max ?? block.max_temperature ?? block.maximum_temperature
  );
  const minimum = toFiniteNumber(
    block.minimum ?? block.min ?? block.min_temperature ?? block.minimum_temperature
  );
  const standardDeviation = toFiniteNumber(block.standard_deviation);

  if (mean === null || maximum === null) {
    return null;
  }

  return { mean, maximum, minimum, standardDeviation };
}

function readFromTemperatureStats(payload: FortyGuardStatsPayload) {
  return (
    readStatsBlock(payload.temperature_stats) ?? readStatsBlock(payload.temperatureStats)
  );
}

function readFromStatsRoot(payload: FortyGuardStatsPayload) {
  return readStatsBlock({
    mean: payload.mean ?? payload.mean_temperature,
    maximum: payload.maximum ?? payload.max ?? payload.max_temperature,
    minimum: payload.minimum ?? payload.minimum_temperature,
    max: payload.max ?? payload.max_temperature,
    max_temperature: payload.max_temperature,
    maximum_temperature: payload.maximum_temperature,
    minimum_temperature: payload.minimum_temperature,
  });
}

function readFromDistribution(payload: FortyGuardStatsPayload) {
  const distribution = payload.overall_temperature_distribution;

  if (!Array.isArray(distribution) || distribution.length === 0) {
    return null;
  }

  const values = distribution
    .map((value) => toFiniteNumber(value))
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return {
    mean: average(values),
    maximum: Math.max(...values),
    minimum: Math.min(...values),
    standardDeviation: null,
  };
}

function readFromMapData(mapData: unknown) {
  if (typeof mapData !== "object" || mapData === null) {
    return null;
  }

  const features = (mapData as { features?: unknown }).features;

  if (!Array.isArray(features) || features.length === 0) {
    return null;
  }

  const averages: number[] = [];
  const maximums: number[] = [];
  const minimums: number[] = [];

  for (const feature of features) {
    if (typeof feature !== "object" || feature === null) {
      continue;
    }

    const properties = (feature as { properties?: MapFeatureProperties }).properties;

    if (!properties) {
      continue;
    }

    const avg = toFiniteNumber(properties.average_temperature);
    const max = toFiniteNumber(properties.max_temperature);
    const min = toFiniteNumber(properties.min_temperature);

    if (avg !== null) {
      averages.push(avg);
    }

    if (max !== null) {
      maximums.push(max);
    }

    if (min !== null) {
      minimums.push(min);
    }
  }

  if (averages.length === 0 || maximums.length === 0) {
    return null;
  }

  return {
    mean: average(averages),
    maximum: Math.max(...maximums),
    minimum: minimums.length > 0 ? Math.min(...minimums) : null,
    standardDeviation: null,
  };
}

function countMapFeatures(mapData: unknown): number {
  if (typeof mapData !== "object" || mapData === null) {
    return 0;
  }

  const features = (mapData as { features?: unknown }).features;

  return Array.isArray(features) ? features.length : 0;
}

export function validateParsedTemperatureStatistics(
  stats: ParsedFortyGuardEnvironmentalStatistics
): boolean {
  const values = [
    stats.minimumTemperatureC,
    stats.meanTemperatureC,
    stats.maximumTemperatureC,
    stats.standardDeviationC,
  ];

  if (!values.every((value) => Number.isFinite(value))) {
    return false;
  }

  if (
    stats.minimumTemperatureC < MIN_PLAUSIBLE_TEMPERATURE_C ||
    stats.maximumTemperatureC > MAX_PLAUSIBLE_TEMPERATURE_C ||
    stats.meanTemperatureC < MIN_PLAUSIBLE_TEMPERATURE_C ||
    stats.meanTemperatureC > MAX_PLAUSIBLE_TEMPERATURE_C
  ) {
    return false;
  }

  if (stats.minimumTemperatureC > stats.meanTemperatureC) {
    return false;
  }

  if (stats.meanTemperatureC > stats.maximumTemperatureC) {
    return false;
  }

  if (stats.standardDeviationC < 0) {
    return false;
  }

  return true;
}

export function parseFortyGuardEnvironmentalSource(
  source: FortyGuardEnvironmentalSource,
  options?: { aoiSideMeters?: number }
): ParseFortyGuardEnvironmentalResult {
  const aoiSideMeters = options?.aoiSideMeters ?? INITIAL_AOI_SIDE_METERS;
  const emptyReasonCode: EnvironmentalFailureReasonCode =
    aoiSideMeters <= INITIAL_AOI_SIDE_METERS
      ? "empty_initial_aoi"
      : "empty_expanded_aoi";

  const statsPayload = unwrapPayload(source.statsData);

  if (typeof statsPayload !== "object" || statsPayload === null) {
    if (countMapFeatures(source.mapData) === 0) {
      return { ok: false, reasonCode: emptyReasonCode };
    }
  }

  const payload = (typeof statsPayload === "object" && statsPayload !== null
    ? statsPayload
    : {}) as FortyGuardStatsPayload;

  const normalized =
    readFromTemperatureStats(payload) ??
    readFromStatsRoot(payload) ??
    readFromDistribution(payload) ??
    readFromMapData(source.mapData);

  if (!normalized) {
    return { ok: false, reasonCode: emptyReasonCode };
  }

  const cellCount = countMapFeatures(source.mapData);
  const minimumTemperatureC = roundTemperature(
    normalized.minimum ?? normalized.mean
  );
  const maximumTemperatureC = roundTemperature(normalized.maximum);
  const meanTemperatureC = roundTemperature(normalized.mean);
  const standardDeviationC = roundTemperature(normalized.standardDeviation ?? 0);

  const parsed: ParsedFortyGuardEnvironmentalStatistics = {
    minimumTemperatureC,
    maximumTemperatureC,
    meanTemperatureC,
    standardDeviationC,
    cellCount,
  };

  if (!validateParsedTemperatureStatistics(parsed)) {
    return { ok: false, reasonCode: "unusable_temperature_statistics" };
  }

  return { ok: true, data: parsed };
}

export function mapFortyGuardEnvironmentalSourceToRiskInput(
  source: FortyGuardEnvironmentalSource,
  options?: { aoiSideMeters?: number }
) {
  const parsed = parseFortyGuardEnvironmentalSource(source, options);

  if (!parsed.ok) {
    throw new Error(parsed.reasonCode);
  }

  return {
    meanTemperature: parsed.data.meanTemperatureC,
    maximumTemperature: parsed.data.maximumTemperatureC,
  };
}

export function extractMinimumTemperatureFromSource(
  source: FortyGuardEnvironmentalSource,
  options?: { aoiSideMeters?: number }
): number | null {
  const parsed = parseFortyGuardEnvironmentalSource(source, options);

  if (!parsed.ok) {
    return null;
  }

  return parsed.data.minimumTemperatureC;
}

export function isExpandedAoiSideMeters(aoiSideMeters: number): boolean {
  return aoiSideMeters >= EXPANDED_AOI_SIDE_METERS;
}
