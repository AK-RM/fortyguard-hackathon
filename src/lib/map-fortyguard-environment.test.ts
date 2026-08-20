import { describe, expect, it } from "vitest";

import {
  FortyGuardMappingError,
  mapFortyGuardStatsToEnvironmental,
} from "./map-fortyguard-environment";

describe("mapFortyGuardStatsToEnvironmental", () => {
  it("maps FortyGuard temperature_stats mean and maximum into environmental input", () => {
    const result = mapFortyGuardStatsToEnvironmental({
      temperature_stats: {
        minimum: 41.5432,
        maximum: 41.5619,
        mean: 41.55235,
      },
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
  });
});
