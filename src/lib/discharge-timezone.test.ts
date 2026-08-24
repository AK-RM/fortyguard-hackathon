import { describe, expect, it } from "vitest";

import {
  addDurationToLocalDateTime,
  convertLocalDateTimeToUtc,
  floorLocalDateTimeToHour,
  formatFortyGuardQueryWindowLocal,
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

describe("addDurationToLocalDateTime", () => {
  it("adds 45 minutes to 14:00 on the same day", () => {
    expect(
      addDurationToLocalDateTime({ date: "2026-08-18", time: "14:00" }, 45)
    ).toEqual({
      date: "2026-08-18",
      time: "14:45",
    });
  });

  it("rolls over to the next calendar day for late departures", () => {
    expect(
      addDurationToLocalDateTime({ date: "2026-08-18", time: "23:30" }, 90)
    ).toEqual({
      date: "2026-08-19",
      time: "01:00",
    });
  });
});

describe("floorLocalDateTimeToHour", () => {
  it("maps arrival 14:45 to FortyGuard query hour 14:00", () => {
    expect(
      floorLocalDateTimeToHour({ date: "2026-08-18", time: "14:45" })
    ).toEqual({
      date: "2026-08-18",
      time: "14:00",
    });
  });

  it("maps arrival 14:00 to FortyGuard query hour 14:00", () => {
    expect(
      floorLocalDateTimeToHour({ date: "2026-08-18", time: "14:00" })
    ).toEqual({
      date: "2026-08-18",
      time: "14:00",
    });
  });

  it("maps arrival 14:59 to FortyGuard query hour 14:00", () => {
    expect(
      floorLocalDateTimeToHour({ date: "2026-08-18", time: "14:59" })
    ).toEqual({
      date: "2026-08-18",
      time: "14:00",
    });
  });

  it("maps arrival 15:00 to FortyGuard query hour 15:00", () => {
    expect(
      floorLocalDateTimeToHour({ date: "2026-08-18", time: "15:00" })
    ).toEqual({
      date: "2026-08-18",
      time: "15:00",
    });
  });

  it("maps arrival 00:10 to FortyGuard query hour 00:00", () => {
    expect(
      floorLocalDateTimeToHour({ date: "2026-08-19", time: "00:10" })
    ).toEqual({
      date: "2026-08-19",
      time: "00:00",
    });
  });
});

describe("FortyGuard query timing for Case A", () => {
  it("uses local query hour 14:00 from 14:00 departure + 45 min arrival, not UTC 21:45", () => {
    const arrival = addDurationToLocalDateTime(
      { date: "2026-08-18", time: "14:00" },
      45
    );
    const queryHour = floorLocalDateTimeToHour(arrival);

    expect(arrival).toEqual({ date: "2026-08-18", time: "14:45" });
    expect(queryHour).toEqual({ date: "2026-08-18", time: "14:00" });
    expect(queryHour.time).not.toBe("21:45");

    const utcArrival = convertLocalDateTimeToUtc(arrival, "America/Phoenix");
    expect(utcArrival.time).toBe("21:45");
  });

  it("handles next-day arrival and next-day local query hour after long late journey", () => {
    const arrival = addDurationToLocalDateTime(
      { date: "2026-08-18", time: "23:30" },
      90
    );
    const queryHour = floorLocalDateTimeToHour(arrival);

    expect(arrival).toEqual({ date: "2026-08-19", time: "01:00" });
    expect(queryHour).toEqual({ date: "2026-08-19", time: "01:00" });
    expect(formatFortyGuardQueryWindowLocal(queryHour, "America/Phoenix")).toBe(
      "2026-08-19 01:00–02:00 America/Phoenix"
    );
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

  it("formats UTC date/time display helper", () => {
    expect(
      formatUtcDateTimeDisplay({ date: "2026-08-18", time: "21:00" })
    ).toBe("18 August 2026, 21:00 UTC");
  });
});
