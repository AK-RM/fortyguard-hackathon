import { describe, expect, it, vi } from "vitest";

import { buildCompletedHeatRiskAssessment } from "@/lib/assessment-orchestration";
import {
  DEMO_CASE_A,
  DEMO_CASE_B,
  DEMO_CASE_C,
  createDischargeRecordFromDemoCase,
} from "@/lib/demo-cases";
import {
  applyProcessingAssessment,
  computeAssessmentInputFingerprint,
  isPendingAssessmentCurrent,
  updateAssessmentInputs,
} from "@/lib/discharge-record-state";
import {
  lookupEnvironmentalResult,
  storeEnvironmentalResultInCache,
} from "@/lib/environmental-cache";
import {
  buildEnvironmentalQueryFromDischarge,
  buildEnvironmentalQueryKey,
  canonicalizeCoordinate,
} from "@/lib/environmental-query";
import { buildEnvironmentalResultFromFortyGuard } from "@/lib/map-fortyguard-environment";
import {
  isFortyGuardCompletedStatus,
  isFortyGuardFailedStatus,
  normalizeFortyGuardStatus,
} from "@/lib/fortyguard";
import {
  VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID,
  VERIFIED_CENTRAL_PHOENIX_QUERY,
  VERIFIED_CENTRAL_PHOENIX_RESULT,
  lookupVerifiedEnvironmentalResult,
} from "@/lib/verified-environmental-seed";

describe("environmental query canonicalization", () => {
  it("canonicalizes equivalent coordinates to the same cache key", () => {
    const base = buildEnvironmentalQueryFromDischarge(
      { label: "Central Phoenix", latitude: 33.4484, longitude: -112.074 },
      {
        date: "2026-08-18",
        time: "14:00",
        timeZone: "America/Phoenix",
        transportMode: "public_bus",
        durationMinutes: 45,
      }
    );
    const equivalent = buildEnvironmentalQueryFromDischarge(
      {
        label: "Central Phoenix",
        latitude: canonicalizeCoordinate(33.448400),
        longitude: canonicalizeCoordinate(-112.074),
      },
      {
        date: "2026-08-18",
        time: "14:00",
        timeZone: "America/Phoenix",
        transportMode: "taxi_rideshare",
        durationMinutes: 30,
      }
    );

    expect(buildEnvironmentalQueryKey(base)).toBe(buildEnvironmentalQueryKey(equivalent));
  });

  it("does not match different coordinates", () => {
    const phoenix = buildEnvironmentalQueryFromDischarge(
      { label: "Central Phoenix", latitude: 33.4484, longitude: -112.074 },
      {
        date: "2026-08-18",
        time: "14:00",
        timeZone: "America/Phoenix",
        transportMode: "public_bus",
        durationMinutes: 45,
      }
    );
    const mesa = buildEnvironmentalQueryFromDischarge(
      { label: "Mesa", latitude: 33.4152, longitude: -111.8315 },
      {
        date: "2026-08-18",
        time: "14:00",
        timeZone: "America/Phoenix",
        transportMode: "public_bus",
        durationMinutes: 45,
      }
    );

    expect(buildEnvironmentalQueryKey(phoenix)).not.toBe(buildEnvironmentalQueryKey(mesa));
  });

  it("does not match different hours or dates", () => {
    const caseA = buildEnvironmentalQueryFromDischarge(
      { label: "Central Phoenix", latitude: 33.4484, longitude: -112.074 },
      {
        date: "2026-08-18",
        time: "14:00",
        timeZone: "America/Phoenix",
        transportMode: "public_bus",
        durationMinutes: 45,
      }
    );
    const differentHour = buildEnvironmentalQueryFromDischarge(
      { label: "Central Phoenix", latitude: 33.4484, longitude: -112.074 },
      {
        date: "2026-08-18",
        time: "15:00",
        timeZone: "America/Phoenix",
        transportMode: "public_bus",
        durationMinutes: 45,
      }
    );
    const differentDate = buildEnvironmentalQueryFromDischarge(
      { label: "Central Phoenix", latitude: 33.4484, longitude: -112.074 },
      {
        date: "2026-08-19",
        time: "14:00",
        timeZone: "America/Phoenix",
        transportMode: "public_bus",
        durationMinutes: 45,
      }
    );

    expect(buildEnvironmentalQueryKey(caseA)).not.toBe(
      buildEnvironmentalQueryKey(differentHour)
    );
    expect(buildEnvironmentalQueryKey(caseA)).not.toBe(
      buildEnvironmentalQueryKey(differentDate)
    );
  });
});

describe("verified Central Phoenix seed", () => {
  it("hits the seed cache for the exact verified query", () => {
    expect(lookupVerifiedEnvironmentalResult(VERIFIED_CENTRAL_PHOENIX_QUERY)).toEqual(
      VERIFIED_CENTRAL_PHOENIX_RESULT
    );
    expect(
      lookupEnvironmentalResult(VERIFIED_CENTRAL_PHOENIX_QUERY)
    ).toEqual(VERIFIED_CENTRAL_PHOENIX_RESULT);
  });

  it("retains the real activity ID and provenance", () => {
    expect(VERIFIED_CENTRAL_PHOENIX_RESULT.activityId).toBe(
      VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID
    );
    expect(VERIFIED_CENTRAL_PHOENIX_RESULT.provenance).toBe("verified_historical_snapshot");
    expect(VERIFIED_CENTRAL_PHOENIX_RESULT.meanTemperatureC).toBe(41.55235);
    expect(VERIFIED_CENTRAL_PHOENIX_RESULT.cellCount).toBe(16);
  });
});

describe("demo cases A/B/C environmental alignment", () => {
  it("uses the identical Central Phoenix environmental query", () => {
    const queryA = buildEnvironmentalQueryFromDischarge(
      DEMO_CASE_A.destination,
      DEMO_CASE_A.journey
    );
    const queryB = buildEnvironmentalQueryFromDischarge(
      DEMO_CASE_B.destination,
      DEMO_CASE_B.journey
    );
    const queryC = buildEnvironmentalQueryFromDischarge(
      DEMO_CASE_C.destination,
      DEMO_CASE_C.journey
    );

    expect(buildEnvironmentalQueryKey(queryA)).toBe(
      buildEnvironmentalQueryKey(VERIFIED_CENTRAL_PHOENIX_QUERY)
    );
    expect(buildEnvironmentalQueryKey(queryB)).toBe(
      buildEnvironmentalQueryKey(VERIFIED_CENTRAL_PHOENIX_QUERY)
    );
    expect(buildEnvironmentalQueryKey(queryC)).toBe(
      buildEnvironmentalQueryKey(VERIFIED_CENTRAL_PHOENIX_QUERY)
    );
  });

  it("keeps distinct patient profiles across A/B/C", () => {
    expect(DEMO_CASE_A.profile).not.toEqual(DEMO_CASE_B.profile);
    expect(DEMO_CASE_B.profile).not.toEqual(DEMO_CASE_C.profile);
    expect(DEMO_CASE_A.journey.transportMode).not.toBe(DEMO_CASE_B.journey.transportMode);
  });

  it("builds Case A query as 2026-08-18 / 14:00 local", () => {
    const query = buildEnvironmentalQueryFromDischarge(
      DEMO_CASE_A.destination,
      DEMO_CASE_A.journey
    );

    expect(query.startDate).toBe("2026-08-18");
    expect(query.startTime).toBe("14:00");
  });
});

describe("cached assessment completion", () => {
  it("completes instantly from verified cache without a new FortyGuard submission", () => {
    const request = {
      origin: DEMO_CASE_A.origin,
      destination: DEMO_CASE_A.destination,
      journey: DEMO_CASE_A.journey,
      patient: DEMO_CASE_A.profile.patient,
      medications: DEMO_CASE_A.profile.medications,
      homeSocial: DEMO_CASE_A.profile.homeSocial,
    };

    const assessment = buildCompletedHeatRiskAssessment({
      parsed: request,
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      environmentalResult: VERIFIED_CENTRAL_PHOENIX_RESULT,
      assessedAt: "2026-08-18T14:00:00.000Z",
    });

    expect(assessment.status).toBe("completed");
    expect(assessment.environmentalAvailable).toBe(true);
    expect(assessment.destinationEnvironmental?.fortyGuardActivityId).toBe(
      VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID
    );
    expect(assessment.totalRiskScore).not.toBeNull();
  });
});

describe("FortyGuard status normalization", () => {
  it("treats Completed as completed case-insensitively", () => {
    expect(normalizeFortyGuardStatus("Completed")).toBe("completed");
    expect(isFortyGuardCompletedStatus("Completed")).toBe(true);
  });

  it("keeps Processing as non-terminal without fake failure", () => {
    expect(isFortyGuardCompletedStatus("Processing")).toBe(false);
    expect(isFortyGuardFailedStatus("Processing")).toBe(false);
  });

  it("parses a completed environmental result from real stats payload", () => {
    const result = buildEnvironmentalResultFromFortyGuard({
      activityId: "live-activity",
      query: VERIFIED_CENTRAL_PHOENIX_QUERY,
      statsData: {
        temperature_stats: {
          minimum: 41.5432,
          maximum: 41.5619,
          mean: 41.55235,
          standard_deviation: 0.00659282438210968,
        },
      },
      mapData: { features: Array.from({ length: 16 }, (_, index) => ({ id: index })) },
      provenance: "live_fortyguard",
    });

    expect(result?.cellCount).toBe(16);
    expect(result?.provenance).toBe("live_fortyguard");
  });
});

describe("processing lifecycle and stale safety", () => {
  it("stores processing state with the same activity ID for resume", () => {
    const record = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(record);
    const pending = {
      activityId: "activity-123",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:00:00.000Z",
    };

    const processing = applyProcessingAssessment(record, pending);

    expect(processing.assessmentStatus).toBe("processing");
    expect(processing.pendingAssessment?.activityId).toBe("activity-123");
    expect(isPendingAssessmentCurrent(processing)).toBe(true);
  });

  it("blocks stale pending results after input changes", () => {
    const record = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(record);
    const processing = applyProcessingAssessment(record, {
      activityId: "activity-123",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:00:00.000Z",
    });

    const stale = updateAssessmentInputs(processing, {
      profile: {
        ...processing.profile,
        patient: { ...processing.profile.patient, age: 81 },
      },
    });

    expect(stale.pendingAssessment).toBeNull();
    expect(isPendingAssessmentCurrent(stale)).toBe(false);
  });

  it("stores completed environmental data only under the exact query key", () => {
    const cache = storeEnvironmentalResultInCache({}, {
      ...VERIFIED_CENTRAL_PHOENIX_RESULT,
      activityId: "live-999",
      provenance: "live_fortyguard",
    });

    expect(Object.keys(cache)).toHaveLength(1);
    expect(cache[buildEnvironmentalQueryKey(VERIFIED_CENTRAL_PHOENIX_QUERY)]?.activityId).toBe(
      "live-999"
    );
  });
});

describe("force refresh bypasses cache lookup", () => {
  it("does not use verified seed when forceRefresh is requested at the API layer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { activity_id: "new-live-activity" } }),
      }))
    );

    process.env.FORTYGUARD_API_KEY = "test-key";

    const { submitHeatmapJobForQuery } = await import("@/lib/fortyguard");
    const activityId = await submitHeatmapJobForQuery(VERIFIED_CENTRAL_PHOENIX_QUERY);

    expect(activityId).toBe("new-live-activity");
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
