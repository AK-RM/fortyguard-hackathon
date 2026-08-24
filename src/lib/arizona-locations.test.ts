import { describe, expect, it } from "vitest";

import { isPointInArizona } from "./arizona-boundary";

describe("Arizona polygon validation", () => {
  it("accepts Phoenix coordinates", () => {
    expect(isPointInArizona(33.4484, -112.074)).toBe(true);
  });

  it("accepts Tucson coordinates", () => {
    expect(isPointInArizona(32.2411, -110.9462)).toBe(true);
  });

  it("rejects coordinates outside Arizona", () => {
    expect(isPointInArizona(34.0522, -118.2437)).toBe(false);
  });

  it("rejects a point inside the old rectangular bounds but outside Arizona", () => {
    expect(isPointInArizona(36.5, -115)).toBe(false);
  });
});
