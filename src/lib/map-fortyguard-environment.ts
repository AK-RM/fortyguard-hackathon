import type { EnvironmentalInput } from "./heat-discharge-risk";

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

export class FortyGuardMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FortyGuardMappingError";
  }
}

export type FortyGuardEnvironmentalSource = {
  statsData: unknown;
  mapData?: unknown;
};

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
): { mean: number; maximum: number; minimum: number | null } | null {
  if (!block) {
    return null;
  }

  const mean = toFiniteNumber(
    block.mean ??
      block.average ??
      block.avg ??
      block.mean_temperature
  );
  const maximum = toFiniteNumber(
    block.maximum ??
      block.max ??
      block.max_temperature ??
      block.maximum_temperature
  );
  const minimum = toFiniteNumber(
    block.minimum ??
      block.min ??
      block.min_temperature ??
      block.minimum_temperature
  );

  if (mean === null || maximum === null) {
    return null;
  }

  return { mean, maximum, minimum };
}

function readFromStatsRoot(
  payload: FortyGuardStatsPayload
): { mean: number; maximum: number; minimum: number | null } | null {
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

function readFromTemperatureStats(
  payload: FortyGuardStatsPayload
): { mean: number; maximum: number; minimum: number | null } | null {
  return (
    readStatsBlock(payload.temperature_stats) ??
    readStatsBlock(payload.temperatureStats)
  );
}

function readFromDistribution(
  payload: FortyGuardStatsPayload
): { mean: number; maximum: number; minimum: number | null } | null {
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
  };
}

function readFromMapData(
  mapData: unknown
): { mean: number; maximum: number; minimum: number | null } | null {
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
  };
}

function normalizeStatsPayload(
  source: FortyGuardEnvironmentalSource
): { mean: number; maximum: number; minimum: number | null } {
  const statsPayload = unwrapPayload(source.statsData);

  if (typeof statsPayload !== "object" || statsPayload === null) {
    throw new FortyGuardMappingError(
      "FortyGuard did not return usable temperature statistics."
    );
  }

  const payload = statsPayload as FortyGuardStatsPayload;

  const normalized =
    readFromTemperatureStats(payload) ??
    readFromStatsRoot(payload) ??
    readFromDistribution(payload) ??
    readFromMapData(source.mapData);

  if (!normalized) {
    throw new FortyGuardMappingError(
      "FortyGuard temperature statistics are missing mean or maximum values."
    );
  }

  return normalized;
}

/**
 * Converts FortyGuard heatmap stats_data (and optional map_data fallback)
 * into the environmental input expected by the heat discharge risk engine.
 */
export function mapFortyGuardEnvironmentalData(
  source: FortyGuardEnvironmentalSource
): EnvironmentalInput {
  const normalized = normalizeStatsPayload(source);

  return {
    meanTemperature: roundTemperature(normalized.mean),
    maximumTemperature: roundTemperature(normalized.maximum),
  };
}

/**
 * Backward-compatible helper when only stats_data is available.
 */
export function mapFortyGuardStatsToEnvironmental(
  temperatureStats: unknown
): EnvironmentalInput {
  return mapFortyGuardEnvironmentalData({ statsData: temperatureStats });
}

export function extractFortyGuardMinimumTemperature(
  source: FortyGuardEnvironmentalSource | unknown
): number | null {
  try {
    const normalizedSource: FortyGuardEnvironmentalSource =
      typeof source === "object" &&
      source !== null &&
      "statsData" in source
        ? (source as FortyGuardEnvironmentalSource)
        : { statsData: source };

    const normalized = normalizeStatsPayload(normalizedSource);

    return normalized.minimum === null
      ? null
      : roundTemperature(normalized.minimum);
  } catch {
    return null;
  }
}
