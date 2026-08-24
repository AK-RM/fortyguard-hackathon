import { describe, expect, it } from "vitest";

import {
  MAX_TRANSITION_POINTS,
  calculateTransitionExposure,
} from "./transition-exposure";

describe("calculateTransitionExposure", () => {
  it("never exceeds the configured maximum transition modifier", () => {
    const exposure = calculateTransitionExposure({
      transportMode: "walking",
      durationMinutes: 120,
    });

    expect(exposure.points).toBeLessThanOrEqual(MAX_TRANSITION_POINTS);
    expect(MAX_TRANSITION_POINTS).toBe(18);
  });

  it("assigns lower transition exposure to AC private vehicle than walking", () => {
    const acVehicle = calculateTransitionExposure({
      transportMode: "ac_private_vehicle",
      durationMinutes: 45,
    });
    const walking = calculateTransitionExposure({
      transportMode: "walking",
      durationMinutes: 45,
    });

    expect(acVehicle.points).toBeLessThan(walking.points);
  });

  it("increases transition exposure for longer configured durations", () => {
    const shortTrip = calculateTransitionExposure({
      transportMode: "public_bus",
      durationMinutes: 15,
    });
    const longTrip = calculateTransitionExposure({
      transportMode: "public_bus",
      durationMinutes: 60,
    });

    expect(longTrip.points).toBeGreaterThan(shortTrip.points);
  });
});
