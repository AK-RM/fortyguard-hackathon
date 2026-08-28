import { describe, expect, it, vi } from "vitest";

import { acquireCompletedEnvironmentalData } from "@/lib/environmental-acquisition";
import {
  ENVIRONMENTAL_UNAVAILABLE_MESSAGE,
  getEnvironmentalFailureMessage,
} from "@/lib/environmental-failure";
import {
  EXPANDED_AOI_SIDE_METERS,
  INITIAL_AOI_SIDE_METERS,
  buildEnvironmentalQueryFromDischarge,
  buildExpandedEnvironmentalQuery,
} from "@/lib/environmental-query";
import { buildEnvironmentalResultFromFortyGuard } from "@/lib/map-fortyguard-environment";
import {
  parseFortyGuardEnvironmentalSource,
  validateParsedTemperatureStatistics,
} from "@/lib/parse-fortyguard-environment";
import { isExplicitNonArizonaSearchQuery } from "@/lib/geocoding";
import { lookupVerifiedEnvironmentalResult } from "@/lib/verified-environmental-seed";
import { SCOTTSDALE_PRESET } from "@/lib/arizona-locations";
import { buildEnvironmentalUnavailableAssessment } from "@/lib/assessment-orchestration";
import { DEMO_CASE_A } from "@/lib/demo-cases";

const LIVE_STATS = {
  temperature_stats: {
    minimum: 41.5432,
    maximum: 41.5619,
    mean: 41.55235,
    standard_deviation: 0.00659282438210968,
  },
};

const LIVE_MAP = {
  type: "FeatureCollection",
  features: Array.from({ length: 16 }, (_, index) => ({
    id: String(index),
    properties: {
      average_temperature: 41.55,
      min_temperature: 41.54,
      max_temperature: 41.56,
    },
  })),
};

const SCOTTSDALE_QUERY = buildEnvironmentalQueryFromDischarge(
  {
    label: SCOTTSDALE_PRESET.label,
    latitude: SCOTTSDALE_PRESET.latitude,
    longitude: SCOTTSDALE_PRESET.longitude,
  },
  {
    date: "2026-08-18",
    time: "14:00",
    timeZone: "America/Phoenix",
    transportMode: "ac_private_vehicle",
    durationMinutes: 20,
  }
);

describe("parseFortyGuardEnvironmentalSource", () => {
  it("parses numeric temperature_stats", () => {
    const parsed = parseFortyGuardEnvironmentalSource({
      statsData: LIVE_STATS,
      mapData: LIVE_MAP,
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.meanTemperatureC).toBeCloseTo(41.55, 2);
      expect(parsed.data.cellCount).toBe(16);
    }
  });

  it("parses numeric-string temperature_stats", () => {
    const parsed = parseFortyGuardEnvironmentalSource({
      statsData: {
        temperature_stats: {
          minimum: "41.3",
          maximum: "41.4",
          mean: "41.35",
          standard_deviation: "0.01",
        },
      },
      mapData: LIVE_MAP,
    });

    expect(parsed.ok).toBe(true);
  });

  it("falls back to map_data when summary statistics are absent", () => {
    const parsed = parseFortyGuardEnvironmentalSource({
      statsData: {},
      mapData: LIVE_MAP,
    });

    expect(parsed.ok).toBe(true);
  });

  it("rejects malformed completed responses", () => {
    const parsed = parseFortyGuardEnvironmentalSource({
      statsData: { temperature_stats: { mean: "not-a-number" } },
      mapData: { features: [] },
    });

    expect(parsed.ok).toBe(false);
  });

  it("rejects empty completed responses", () => {
    const parsed = parseFortyGuardEnvironmentalSource(
      { statsData: {}, mapData: { features: [] } },
      { aoiSideMeters: INITIAL_AOI_SIDE_METERS }
    );

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.reasonCode).toBe("empty_initial_aoi");
    }
  });

  it("validates temperature plausibility", () => {
    expect(
      validateParsedTemperatureStatistics({
        minimumTemperatureC: 50,
        meanTemperatureC: 40,
        maximumTemperatureC: 45,
        standardDeviationC: 1,
        cellCount: 4,
      })
    ).toBe(false);
  });
});

describe("AOI fallback acquisition", () => {
  it("requests expanded AOI only after empty initial AOI", () => {
    const acquisition = acquireCompletedEnvironmentalData({
      activityId: "activity-1",
      query: SCOTTSDALE_QUERY,
      statusCheck: {
        activityId: "activity-1",
        normalizedStatus: "completed",
        rawStatus: "Completed",
        completed: true,
        failed: false,
        processing: false,
        statsData: {},
        mapData: { features: [] },
        envelope: {},
      },
    });

    expect(acquisition.kind).toBe("retry_expanded");
    if (acquisition.kind === "retry_expanded") {
      expect(acquisition.expandedQuery.aoiSideMeters).toBe(EXPANDED_AOI_SIDE_METERS);
      expect(acquisition.expandedQuery.startDate).toBe("2026-08-18");
      expect(acquisition.expandedQuery.startTime).toBe("14:00");
    }
  });

  it("succeeds on initial 400 m AOI when data is usable", () => {
    const acquisition = acquireCompletedEnvironmentalData({
      activityId: "activity-2",
      query: SCOTTSDALE_QUERY,
      statusCheck: {
        activityId: "activity-2",
        normalizedStatus: "completed",
        rawStatus: "Completed",
        completed: true,
        failed: false,
        processing: false,
        statsData: LIVE_STATS,
        mapData: LIVE_MAP,
        envelope: {},
      },
    });

    expect(acquisition.kind).toBe("success");
  });

  it("fails when both AOIs would be empty", () => {
    const expanded = buildExpandedEnvironmentalQuery(SCOTTSDALE_QUERY);
    const acquisition = acquireCompletedEnvironmentalData({
      activityId: "activity-3",
      query: expanded,
      statusCheck: {
        activityId: "activity-3",
        normalizedStatus: "completed",
        rawStatus: "Completed",
        completed: true,
        failed: false,
        processing: false,
        statsData: {},
        mapData: { features: [] },
        envelope: {},
      },
    });

    expect(acquisition.kind).toBe("unavailable");
    if (acquisition.kind === "unavailable") {
      expect(acquisition.reasonCode).toBe("empty_expanded_aoi");
      expect(getEnvironmentalFailureMessage(acquisition.reasonCode)).toBe(
        ENVIRONMENTAL_UNAVAILABLE_MESSAGE
      );
    }
  });

  it("does not retry upstream failures", () => {
    const acquisition = acquireCompletedEnvironmentalData({
      activityId: "activity-4",
      query: SCOTTSDALE_QUERY,
      statusCheck: {
        activityId: "activity-4",
        normalizedStatus: "failed",
        rawStatus: "Failed",
        completed: false,
        failed: true,
        processing: false,
        statsData: null,
        mapData: null,
        envelope: {},
      },
    });

    expect(acquisition.kind).toBe("unavailable");
    if (acquisition.kind === "unavailable") {
      expect(acquisition.reasonCode).toBe("upstream_failed");
    }
  });
});

describe("provenance and snapshot boundaries", () => {
  it("uses verified snapshot for Central Phoenix prepared query only", () => {
    const verified = lookupVerifiedEnvironmentalResult(
      buildEnvironmentalQueryFromDischarge(DEMO_CASE_A.destination, DEMO_CASE_A.journey)
    );

    expect(verified?.provenance).toBe("verified_historical_snapshot");
    expect(lookupVerifiedEnvironmentalResult(SCOTTSDALE_QUERY)).toBeNull();
  });

  it("never uses Central Phoenix snapshot for Scottsdale coordinates", () => {
    expect(lookupVerifiedEnvironmentalResult(SCOTTSDALE_QUERY)).toBeNull();
  });

  it("builds unavailable assessments without priority", () => {
    const unavailable = buildEnvironmentalUnavailableAssessment({
      parsed: {
        origin: DEMO_CASE_A.origin,
        destination: SCOTTSDALE_PRESET,
        journey: {
          date: "2026-08-18",
          time: "14:00",
          timeZone: "America/Phoenix",
          transportMode: "ac_private_vehicle",
          durationMinutes: 20,
        },
        patient: DEMO_CASE_A.profile.patient,
        medications: DEMO_CASE_A.profile.medications,
        homeSocial: DEMO_CASE_A.profile.homeSocial,
      },
      environmentalQuery: SCOTTSDALE_QUERY,
      environmentalFailure: ENVIRONMENTAL_UNAVAILABLE_MESSAGE,
      environmentalFailureReason: "empty_expanded_aoi",
    });

    expect(unavailable.riskLevel).toBeNull();
    expect(unavailable.totalRiskScore).toBeNull();
    expect(unavailable.environmentalAvailable).toBe(false);
  });
});

describe("geocoder hardening", () => {
  it("rejects explicit non-Arizona searches such as Los Angeles, CA", () => {
    expect(isExplicitNonArizonaSearchQuery("Los Angeles, CA")).toBe(true);
    expect(isExplicitNonArizonaSearchQuery("123 N Example St, Phoenix, AZ")).toBe(false);
  });
});

describe("HS-006 Scottsdale regression payload", () => {
  it("marks expanded AOI metadata when fallback result is parsed", () => {
    const expandedQuery = buildExpandedEnvironmentalQuery(SCOTTSDALE_QUERY);
    const result = buildEnvironmentalResultFromFortyGuard({
      activityId: "hs-006-expanded",
      query: expandedQuery,
      statsData: LIVE_STATS,
      mapData: LIVE_MAP,
      provenance: "live_fortyguard",
      provenanceNote: "Expanded AOI fallback",
    });

    expect(result?.aoiFallbackUsed).toBe(true);
    expect(result?.aoiSideMetersUsed).toBe(1600);
    expect(result?.provenance).toBe("live_fortyguard");
  });
});

describe("retry budget", () => {
  it("allows exactly one expanded query derivation per initial query", () => {
    const expanded = buildExpandedEnvironmentalQuery(SCOTTSDALE_QUERY);
    expect(expanded.aoiSideMeters).toBe(EXPANDED_AOI_SIDE_METERS);
    expect(buildExpandedEnvironmentalQuery(expanded).aoiSideMeters).toBe(
      EXPANDED_AOI_SIDE_METERS
    );
  });
});
