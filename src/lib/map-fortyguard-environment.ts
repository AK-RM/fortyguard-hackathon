import type { EnvironmentalInput } from "./heat-discharge-risk";

type FortyGuardTemperatureStatsPayload = {
  temperature_stats?: {
    mean?: number;
    maximum?: number;
    minimum?: number;
  };
};

export class FortyGuardMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FortyGuardMappingError";
  }
}

function roundTemperature(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Converts FortyGuard heatmap stats_data into the environmental input
 * expected by the heat discharge risk engine.
 */
export function mapFortyGuardStatsToEnvironmental(
  temperatureStats: unknown
): EnvironmentalInput {
  if (typeof temperatureStats !== "object" || temperatureStats === null) {
    throw new FortyGuardMappingError(
      "FortyGuard did not return usable temperature statistics."
    );
  }

  const stats = (temperatureStats as FortyGuardTemperatureStatsPayload)
    .temperature_stats;

  if (
    !stats ||
    typeof stats.mean !== "number" ||
    !Number.isFinite(stats.mean) ||
    typeof stats.maximum !== "number" ||
    !Number.isFinite(stats.maximum)
  ) {
    throw new FortyGuardMappingError(
      "FortyGuard temperature statistics are missing mean or maximum values."
    );
  }

  return {
    meanTemperature: roundTemperature(stats.mean),
    maximumTemperature: roundTemperature(stats.maximum),
  };
}

export function extractFortyGuardMinimumTemperature(
  temperatureStats: unknown
): number | null {
  if (typeof temperatureStats !== "object" || temperatureStats === null) {
    return null;
  }

  const minimum = (temperatureStats as FortyGuardTemperatureStatsPayload)
    .temperature_stats?.minimum;

  return typeof minimum === "number" && Number.isFinite(minimum)
    ? roundTemperature(minimum)
    : null;
}
