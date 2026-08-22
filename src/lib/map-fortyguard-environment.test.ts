import { describe, expect, it } from "vitest";

import {
  FortyGuardMappingError,
  mapFortyGuardEnvironmentalData,
  mapFortyGuardStatsToEnvironmental,
} from "./map-fortyguard-environment";

/** Captured from a successful live FortyGuard heatmap status response. */
const LIVE_FORTYGUARD_STATS_DATA = {
  temperature_stats: {
    minimum: 41.5432,
    maximum: 41.5619,
    mean: 41.55235,
    standard_deviation: 0.00659282438210968,
  },
  overall_temperature_distribution: [
    41.5432, 41.547875, 41.55265, 41.5573, 41.5619,
  ],
  normal_temperature_distribution: {
    x_axis: [41.532571526853665, 41.552150217442964],
    y_axis: [0.672223034479621, 60.483812436414674],
  },
  temperature_frequency: {
    x_axis: [42],
    y_axis: [16],
  },
};

const LIVE_FORTYGUARD_MAP_DATA = {
  type: "FeatureCollection",
  features: [
    {
      id: "0",
      type: "Feature",
      properties: {
        tile_id: 0,
        average_temperature: 41.5608,
        min_temperature: 41.5608,
        max_temperature: 41.5608,
      },
      geometry: { type: "Polygon", coordinates: [] },
    },
    {
      id: "1",
      type: "Feature",
      properties: {
        tile_id: 1,
        average_temperature: 41.5432,
        min_temperature: 41.5432,
        max_temperature: 41.5432,
      },
      geometry: { type: "Polygon", coordinates: [] },
    },
  ],
};

describe("mapFortyGuardStatsToEnvironmental", () => {
  it("maps the actual live FortyGuard stats_data shape", () => {
    const result = mapFortyGuardStatsToEnvironmental(LIVE_FORTYGUARD_STATS_DATA);

    expect(result).toEqual({
      meanTemperature: 41.55,
      maximumTemperature: 41.56,
    });
  });

  it("coerces numeric strings returned by FortyGuard", () => {
    const result = mapFortyGuardEnvironmentalData({
      statsData: {
        temperature_stats: {
          minimum: "41.5432",
          maximum: "41.5619",
          mean: "41.55235",
        },
      },
    });

    expect(result).toEqual({
      meanTemperature: 41.55,
      maximumTemperature: 41.56,
    });
  });

  it("falls back to overall_temperature_distribution when temperature_stats is absent", () => {
    const result = mapFortyGuardEnvironmentalData({
      statsData: {
        overall_temperature_distribution: [41.5432, 41.5619, 41.5500],
      },
    });

    expect(result.meanTemperature).toBe(41.55);
    expect(result.maximumTemperature).toBe(41.56);
  });

  it("falls back to map_data tile temperatures when stats_data lacks summary values", () => {
    const result = mapFortyGuardEnvironmentalData({
      statsData: {},
      mapData: LIVE_FORTYGUARD_MAP_DATA,
    });

    expect(result).toEqual({
      meanTemperature: 41.55,
      maximumTemperature: 41.56,
    });
  });

  it("throws when FortyGuard stats are missing required values", () => {
    expect(() => mapFortyGuardStatsToEnvironmental({})).toThrow(
      FortyGuardMappingError
    );
    expect(() =>
      mapFortyGuardEnvironmentalData({
        statsData: { temperature_stats: { mean: "not-a-number" } },
      })
    ).toThrow(FortyGuardMappingError);
  });
});
