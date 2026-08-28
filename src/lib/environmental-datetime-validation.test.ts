import { describe, expect, it, vi } from "vitest";

import {
  ENVIRONMENTAL_FORECAST_HORIZON_MESSAGE,
  ENVIRONMENTAL_HISTORICAL_EARLIEST_MESSAGE,
  validateEnvironmentalQueryDatetime,
} from "@/lib/environmental-datetime-validation";
import { DEMO_CASE_A } from "@/lib/demo-cases";
import { buildEnvironmentalQueryFromDischarge } from "@/lib/environmental-query";
import { lookupVerifiedEnvironmentalResult } from "@/lib/verified-environmental-seed";

/** Fixed reference clock: 28 Aug 2026 14:00 America/Phoenix (21:00 UTC). */
const REFERENCE_NOW = new Date("2026-08-28T21:00:00.000Z");

const PHOENIX_JOURNEY = {
  timeZone: "America/Phoenix" as const,
  transportMode: "ac_private_vehicle" as const,
  durationMinutes: 20,
};

function validateAt(params: {
  date: string;
  time: string;
  durationMinutes?: number;
  now?: Date;
}) {
  return validateEnvironmentalQueryDatetime({
    journey: {
      ...PHOENIX_JOURNEY,
      date: params.date,
      time: params.time,
      durationMinutes: params.durationMinutes ?? PHOENIX_JOURNEY.durationMinutes,
    },
    now: params.now ?? REFERENCE_NOW,
  });
}

describe("validateEnvironmentalQueryDatetime", () => {
  it("rejects arrival one minute before 2021-01-01", () => {
    const result = validateAt({
      date: "2020-12-31",
      time: "23:39",
      durationMinutes: 20,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe("date_before_historical_range");
      expect(result.message).toBe(ENVIRONMENTAL_HISTORICAL_EARLIEST_MESSAGE);
    }
  });

  it("accepts arrival exactly at 2021-01-01 00:00", () => {
    const result = validateAt({
      date: "2020-12-31",
      time: "23:40",
      durationMinutes: 20,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.arrivalDateTime).toEqual({
        date: "2021-01-01",
        time: "00:00",
      });
      expect(result.queryHour).toEqual({
        date: "2021-01-01",
        time: "00:00",
      });
    }
  });

  it("accepts a valid 2025 historical arrival on the live path", () => {
    const result = validateAt({
      date: "2025-01-01",
      time: "12:00",
      durationMinutes: 30,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.arrivalDateTime).toEqual({
        date: "2025-01-01",
        time: "12:30",
      });
    }
  });

  it("accepts arrival at the reference now", () => {
    const result = validateAt({
      date: "2026-08-28",
      time: "13:40",
      durationMinutes: 20,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.arrivalDateTime).toEqual({
        date: "2026-08-28",
        time: "14:00",
      });
    }
  });

  it("accepts arrival exactly 12 hours ahead of the reference now", () => {
    const result = validateAt({
      date: "2026-08-29",
      time: "01:40",
      durationMinutes: 20,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.arrivalDateTime).toEqual({
        date: "2026-08-29",
        time: "02:00",
      });
    }
  });

  it("rejects arrival one minute beyond the 12-hour forecast horizon", () => {
    const result = validateAt({
      date: "2026-08-29",
      time: "01:41",
      durationMinutes: 20,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe("date_beyond_forecast_horizon");
      expect(result.message).toBe(ENVIRONMENTAL_FORECAST_HORIZON_MESSAGE);
    }
  });

  it("rejects when departure is inside the horizon but arrival exceeds it", () => {
    const result = validateAt({
      date: "2026-08-28",
      time: "14:00",
      durationMinutes: 721,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe("date_beyond_forecast_horizon");
      expect(result.message).toBe(ENVIRONMENTAL_FORECAST_HORIZON_MESSAGE);
    }
  });

  it("rejects invalid date/time input", () => {
    const result = validateAt({
      date: "2026-02-30",
      time: "14:00",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasonCode).toBe("invalid_environmental_datetime");
    }
  });

  it("keeps HS-001 demo datetime valid", () => {
    const result = validateEnvironmentalQueryDatetime({
      journey: DEMO_CASE_A.journey,
      now: REFERENCE_NOW,
    });

    expect(result.ok).toBe(true);
  });

  it("preserves the exact verified Central Phoenix snapshot boundary", () => {
    const query = buildEnvironmentalQueryFromDischarge(
      DEMO_CASE_A.destination,
      DEMO_CASE_A.journey
    );

    expect(lookupVerifiedEnvironmentalResult(query)).not.toBeNull();
    expect(query.startDate).toBe("2026-08-18");
    expect(query.startTime).toBe("14:00");
  });
});

describe("heat-risk route temporal guard", () => {
  it("does not submit to FortyGuard when datetime validation fails", async () => {
    vi.resetModules();
    const submitHeatmapJobForQuery = vi.fn();

    vi.doMock("@/lib/fortyguard", () => ({
      FortyGuardError: class FortyGuardError extends Error {},
      submitHeatmapJobForQuery,
    }));

    const { POST } = await import("@/app/api/heat-risk/route");

    const response = await POST(
      new Request("http://localhost/api/heat-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: DEMO_CASE_A.origin,
          destination: DEMO_CASE_A.destination,
          journey: {
            ...DEMO_CASE_A.journey,
            date: "2020-12-31",
            time: "23:39",
            durationMinutes: 20,
          },
          patient: DEMO_CASE_A.profile.patient,
          medications: DEMO_CASE_A.profile.medications,
          homeSocial: DEMO_CASE_A.profile.homeSocial,
          forceRefresh: true,
        }),
      })
    );

    const body = await response.json();

    expect(submitHeatmapJobForQuery).not.toHaveBeenCalled();
    expect(body.status).toBe("failed");
    expect(body.environmentalFailureReason).toBe("date_before_historical_range");
    expect(body.environmentalFailure).toBe(ENVIRONMENTAL_HISTORICAL_EARLIEST_MESSAGE);
    expect(body.riskLevel).toBeNull();
  });

  it("rejects invalid datetime before verified snapshot lookup", async () => {
    vi.resetModules();
    const submitHeatmapJobForQuery = vi.fn();

    vi.doMock("@/lib/fortyguard", () => ({
      FortyGuardError: class FortyGuardError extends Error {},
      submitHeatmapJobForQuery,
    }));

    const { POST } = await import("@/app/api/heat-risk/route");

    const response = await POST(
      new Request("http://localhost/api/heat-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: DEMO_CASE_A.origin,
          destination: DEMO_CASE_A.destination,
          journey: {
            ...DEMO_CASE_A.journey,
            date: "2020-12-31",
            time: "23:39",
            durationMinutes: 20,
          },
          patient: DEMO_CASE_A.profile.patient,
          medications: DEMO_CASE_A.profile.medications,
          homeSocial: DEMO_CASE_A.profile.homeSocial,
        }),
      })
    );

    const body = await response.json();

    expect(submitHeatmapJobForQuery).not.toHaveBeenCalled();
    expect(body.status).toBe("failed");
    expect(body.environmentalFailureReason).toBe("date_before_historical_range");
  });

  it("returns verified snapshot for valid HS-001 datetime without live submission", async () => {
    vi.resetModules();
    const submitHeatmapJobForQuery = vi.fn();

    vi.doMock("@/lib/fortyguard", () => ({
      FortyGuardError: class FortyGuardError extends Error {},
      submitHeatmapJobForQuery,
    }));

    const { POST } = await import("@/app/api/heat-risk/route");

    const response = await POST(
      new Request("http://localhost/api/heat-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: DEMO_CASE_A.origin,
          destination: DEMO_CASE_A.destination,
          journey: DEMO_CASE_A.journey,
          patient: DEMO_CASE_A.profile.patient,
          medications: DEMO_CASE_A.profile.medications,
          homeSocial: DEMO_CASE_A.profile.homeSocial,
        }),
      })
    );

    const body = await response.json();

    expect(submitHeatmapJobForQuery).not.toHaveBeenCalled();
    expect(body.status).toBe("completed");
    expect(body.environmentalResult?.provenance).toBe("verified_historical_snapshot");
    expect(body.riskLevel).toBe("urgent");
  });
});
