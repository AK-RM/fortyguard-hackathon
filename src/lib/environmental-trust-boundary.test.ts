import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertActivityTokenMatchesAssessment,
  signActivityToken,
  verifyActivityToken,
} from "@/lib/activity-token";
import { DEMO_CASE_A } from "@/lib/demo-cases";
import { fingerprintFromRequest } from "@/lib/discharge-record-state";
import {
  buildEnvironmentalQueryFromDischarge,
  buildEnvironmentalQueryKey,
  buildExpandedEnvironmentalQuery,
  INITIAL_AOI_SIDE_METERS,
} from "@/lib/environmental-query";
import { lookupVerifiedEnvironmentalResult } from "@/lib/verified-environmental-seed";
import type { EnvironmentalResult } from "@/lib/environmental-result";

const TEST_SIGNING_SECRET = "test-signing-secret-for-vitest-only";

const VALID_REQUEST = {
  origin: DEMO_CASE_A.origin,
  destination: DEMO_CASE_A.destination,
  journey: DEMO_CASE_A.journey,
  patient: DEMO_CASE_A.profile.patient,
  medications: DEMO_CASE_A.profile.medications,
  homeSocial: DEMO_CASE_A.profile.homeSocial,
};

const MESA_REQUEST = {
  ...VALID_REQUEST,
  destination: {
    label: "Mesa, Arizona",
    latitude: 33.4152,
    longitude: -111.8315,
  },
};

function fabricatedZeroCache(): Record<string, EnvironmentalResult> {
  const query = buildEnvironmentalQueryFromDischarge(
    VALID_REQUEST.destination,
    VALID_REQUEST.journey
  );

  return {
    [buildEnvironmentalQueryKey(query)]: {
      source: "FortyGuard",
      activityId: "fabricated-cache",
      query,
      minimumTemperatureC: 0,
      maximumTemperatureC: 0,
      meanTemperatureC: 0,
      standardDeviation: 0,
      cellCount: 16,
      provenance: "live_fortyguard",
      aoiSideMetersUsed: INITIAL_AOI_SIDE_METERS,
      aoiFallbackUsed: false,
      granularityUsed: 100,
      status: "completed",
    },
  };
}

function signTokenForRequest(
  request: typeof VALID_REQUEST,
  activityId: string,
  options?: { retryCount?: number; expiresAt?: number; query?: ReturnType<typeof buildEnvironmentalQueryFromDischarge> }
) {
  const environmentalQuery =
    options?.query ??
    buildEnvironmentalQueryFromDischarge(request.destination, request.journey);

  return signActivityToken({
    activityId,
    environmentalQuery,
    inputFingerprint: fingerprintFromRequest(request),
    retryCount: options?.retryCount,
    expiresAt: options?.expiresAt,
  });
}

describe("environmental trust boundary", () => {
  beforeEach(() => {
    process.env.HEATSAFE_STATE_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.HEATSAFE_STATE_SIGNING_SECRET;
  });

  describe("client environmental cache rejection", () => {
    it("rejects fabricated completed client cache containing 0°C", async () => {
      vi.doMock("@/lib/fortyguard", () => ({
        FortyGuardError: class FortyGuardError extends Error {},
        submitHeatmapJobForQuery: vi.fn(),
      }));

      const { POST } = await import("@/app/api/heat-risk/route");
      const submitSpy = (await import("@/lib/fortyguard")).submitHeatmapJobForQuery as ReturnType<
        typeof vi.fn
      >;

      const response = await POST(
        new Request("http://localhost/api/heat-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...VALID_REQUEST,
            clientEnvironmentalCache: fabricatedZeroCache(),
          }),
        })
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("completed");
      expect(body.environmentalResult?.meanTemperatureC).not.toBe(0);
      expect(body.environmentalResult?.provenance).toBe("verified_historical_snapshot");
      expect(submitSpy).not.toHaveBeenCalled();
    });

    it("rejects legacy browser cache as a scoring source", async () => {
      vi.doMock("@/lib/fortyguard", () => ({
        FortyGuardError: class FortyGuardError extends Error {},
        submitHeatmapJobForQuery: vi.fn(async () => "live-activity-legacy"),
      }));

      const { POST } = await import("@/app/api/heat-risk/route");
      const submitSpy = (await import("@/lib/fortyguard")).submitHeatmapJobForQuery as ReturnType<
        typeof vi.fn
      >;

      const query = buildEnvironmentalQueryFromDischarge(
        MESA_REQUEST.destination,
        MESA_REQUEST.journey
      );
      const legacyCache = fabricatedZeroCache();
      legacyCache[buildEnvironmentalQueryKey(query)] = {
        ...legacyCache[buildEnvironmentalQueryKey(query)]!,
        query,
        meanTemperatureC: 12,
        maximumTemperatureC: 12,
        minimumTemperatureC: 12,
      };

      const response = await POST(
        new Request("http://localhost/api/heat-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...MESA_REQUEST,
            clientEnvironmentalCache: legacyCache,
          }),
        })
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("processing");
      expect(body.activityToken).toBeTruthy();
      expect(submitSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("signed activity token enforcement", () => {
    async function importStatusRoute() {
      vi.doMock("@/lib/fortyguard", () => ({
        FortyGuardError: class FortyGuardError extends Error {},
        checkHeatmapStatusOnce: vi.fn(async () => ({
          activityId: "phoenix-activity",
          normalizedStatus: "processing",
          rawStatus: "Processing",
          completed: false,
          failed: false,
          processing: true,
          statsData: {},
          mapData: {},
          envelope: {},
        })),
        submitHeatmapJobForQuery: vi.fn(async () => "expanded-activity"),
      }));

      return import("@/app/api/heat-risk/status/route");
    }

    it("rejects Phoenix activity paired with a Mesa request", async () => {
      const token = signTokenForRequest(VALID_REQUEST, "phoenix-activity");
      const { POST } = await importStatusRoute();

      const response = await POST(
        new Request("http://localhost/api/heat-risk/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request: MESA_REQUEST,
            activityToken: token,
          }),
        })
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Environmental query does not match the signed activity token.",
      });
    });

    it("rejects a modified activity ID inside the token", async () => {
      const token = signTokenForRequest(VALID_REQUEST, "original-activity");
      const tampered = `${token.slice(0, -4)}aaaa`;
      const { POST } = await importStatusRoute();

      const response = await POST(
        new Request("http://localhost/api/heat-risk/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request: VALID_REQUEST,
            activityToken: tampered,
          }),
        })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toMatch(/invalid|match/i);
    });

    it("rejects a modified query hash binding", async () => {
      const token = signTokenForRequest(VALID_REQUEST, "activity-1");
      const verified = verifyActivityToken(token);

      expect(verified.ok).toBe(true);
      if (!verified.ok) {
        return;
      }

      const mesaQuery = buildEnvironmentalQueryFromDischarge(
        MESA_REQUEST.destination,
        MESA_REQUEST.journey
      );
      const mismatch = assertActivityTokenMatchesAssessment({
        payload: verified.payload,
        environmentalQuery: mesaQuery,
        inputFingerprint: fingerprintFromRequest(VALID_REQUEST),
      });

      expect(mismatch.ok).toBe(false);
    });

    it("rejects a modified input fingerprint binding", async () => {
      const token = signTokenForRequest(VALID_REQUEST, "activity-1");
      const verified = verifyActivityToken(token);

      expect(verified.ok).toBe(true);
      if (!verified.ok) {
        return;
      }

      const mismatch = assertActivityTokenMatchesAssessment({
        payload: verified.payload,
        environmentalQuery: buildEnvironmentalQueryFromDischarge(
          VALID_REQUEST.destination,
          VALID_REQUEST.journey
        ),
        inputFingerprint: fingerprintFromRequest(MESA_REQUEST),
      });

      expect(mismatch.ok).toBe(false);
    });

    it("rejects missing activity token", async () => {
      const { POST } = await importStatusRoute();

      const response = await POST(
        new Request("http://localhost/api/heat-risk/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request: VALID_REQUEST,
            activityId: "rogue-activity",
            environmentalQuery: buildEnvironmentalQueryFromDischarge(
              VALID_REQUEST.destination,
              VALID_REQUEST.journey
            ),
            inputFingerprint: fingerprintFromRequest(VALID_REQUEST),
          }),
        })
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "activityToken and the original HeatSafe request are required.",
      });
    });

    it("rejects expired token", async () => {
      const token = signTokenForRequest(VALID_REQUEST, "activity-1", {
        expiresAt: Date.now() - 1_000,
      });
      const { POST } = await importStatusRoute();

      const response = await POST(
        new Request("http://localhost/api/heat-risk/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request: VALID_REQUEST,
            activityToken: token,
          }),
        })
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Activity token has expired.",
      });
    });

    it("rejects invalid token signature", async () => {
      const token = `${signTokenForRequest(VALID_REQUEST, "activity-1")}bad`;
      const { POST } = await importStatusRoute();

      const response = await POST(
        new Request("http://localhost/api/heat-risk/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request: VALID_REQUEST,
            activityToken: token,
          }),
        })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe(
        "Activity token signature is invalid."
      );
    });

    it("rejects more than one expanded-AOI retry", async () => {
      const initialQuery = buildEnvironmentalQueryFromDischarge(
        VALID_REQUEST.destination,
        VALID_REQUEST.journey
      );
      const expandedQuery = buildExpandedEnvironmentalQuery(initialQuery);
      const token = signTokenForRequest(VALID_REQUEST, "expanded-activity", {
        retryCount: 1,
        query: expandedQuery,
      });

      vi.doMock("@/lib/fortyguard", () => ({
        FortyGuardError: class FortyGuardError extends Error {},
        checkHeatmapStatusOnce: vi.fn(async () => ({
          activityId: "expanded-activity",
          normalizedStatus: "completed",
          rawStatus: "Completed",
          completed: true,
          failed: false,
          processing: false,
          statsData: {},
          mapData: { features: [] },
          envelope: {},
        })),
        submitHeatmapJobForQuery: vi.fn(),
      }));

      const { POST } = await import("@/app/api/heat-risk/status/route");
      const submitSpy = (await import("@/lib/fortyguard")).submitHeatmapJobForQuery as ReturnType<
        typeof vi.fn
      >;

      const response = await POST(
        new Request("http://localhost/api/heat-risk/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request: VALID_REQUEST,
            activityToken: token,
          }),
        })
      );

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe("failed");
      expect(body.environmentalFailureReason).toBe("empty_expanded_aoi");
      expect(submitSpy).not.toHaveBeenCalled();
    });
  });

  describe("numeric validation", () => {
    it("rejects fractional API age", async () => {
      const { parseHeatRiskRequest } = await import("@/lib/parse-heat-risk-request");

      expect(
        parseHeatRiskRequest({
          ...VALID_REQUEST,
          patient: { ...VALID_REQUEST.patient, age: 40.5 },
        })
      ).toEqual({ error: "patient.age must be an integer between 0 and 120." });
    });

    it("rejects fractional API journey duration", async () => {
      const { parseHeatRiskRequest } = await import("@/lib/parse-heat-risk-request");

      expect(
        parseHeatRiskRequest({
          ...VALID_REQUEST,
          journey: { ...VALID_REQUEST.journey, durationMinutes: 44.7 },
        })
      ).toEqual({
        error: "journey.durationMinutes must be an integer between 1 and 480.",
      });
    });
  });

  describe("verified snapshot and temporal ordering", () => {
    it("keeps HS-001 verified snapshot working", () => {
      const query = buildEnvironmentalQueryFromDischarge(
        DEMO_CASE_A.destination,
        DEMO_CASE_A.journey
      );

      expect(lookupVerifiedEnvironmentalResult(query)).not.toBeNull();
    });

    it("validates temporal constraints before snapshot lookup", async () => {
      vi.doMock("@/lib/fortyguard", () => ({
        FortyGuardError: class FortyGuardError extends Error {},
        submitHeatmapJobForQuery: vi.fn(),
      }));

      const { POST } = await import("@/app/api/heat-risk/route");
      const submitSpy = (await import("@/lib/fortyguard")).submitHeatmapJobForQuery as ReturnType<
        typeof vi.fn
      >;

      const response = await POST(
        new Request("http://localhost/api/heat-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...VALID_REQUEST,
            journey: {
              ...VALID_REQUEST.journey,
              date: "2020-12-31",
              time: "23:39",
              durationMinutes: 20,
            },
          }),
        })
      );

      const body = await response.json();

      expect(submitSpy).not.toHaveBeenCalled();
      expect(body.status).toBe("failed");
      expect(body.riskLevel).toBeNull();
    });
  });
});
