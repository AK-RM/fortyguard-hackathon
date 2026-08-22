import { describe, expect, it } from "vitest";

import {
  convertLocalDateTimeToUtc,
  formatLocalDateTimeDisplay,
  formatUtcDateTimeDisplay,
} from "./discharge-timezone";

describe("convertLocalDateTimeToUtc", () => {
  it("converts 2026-08-18 14:00 America/Phoenix to 2026-08-18 21:00 UTC", () => {
    expect(
      convertLocalDateTimeToUtc(
        { date: "2026-08-18", time: "14:00" },
        "America/Phoenix"
      )
    ).toEqual({
      date: "2026-08-18",
      time: "21:00",
    });
  });

  it("converts 2026-08-18 23:30 America/Phoenix to 2026-08-19 06:30 UTC", () => {
    expect(
      convertLocalDateTimeToUtc(
        { date: "2026-08-18", time: "23:30" },
        "America/Phoenix"
      )
    ).toEqual({
      date: "2026-08-19",
      time: "06:30",
    });
  });
});

describe("date/time display formatting", () => {
  it("formats local Phoenix discharge time for the UI", () => {
    expect(
      formatLocalDateTimeDisplay(
        { date: "2026-08-18", time: "14:00" },
        "America/Phoenix"
      )
    ).toBe("18 August 2026, 2:00 PM America/Phoenix");
  });

  it("formats UTC FortyGuard request time for the UI", () => {
    expect(
      formatUtcDateTimeDisplay({ date: "2026-08-18", time: "21:00" })
    ).toBe("18 August 2026, 21:00 UTC");
  });
});
