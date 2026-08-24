import { describe, expect, it } from "vitest";

import { buildCompletedHeatRiskAssessment } from "@/lib/assessment-orchestration";
import {
  DEMO_CASE_A,
  DEMO_CASE_B,
  DEMO_CASE_C,
  createDischargeRecordFromDemoCase,
} from "@/lib/demo-cases";
import {
  BUILTIN_DEMO_IDS,
  DEMO_DATA_VERSION,
  migrateDemoDischargeRecord,
  migratePersistedState,
} from "@/lib/demo-storage-migration";
import {
  applyEnvironmentalRefresh,
  applyEnvironmentalRefreshFailure,
  applyProcessingAssessment,
  applySuccessfulAssessment,
  computeAssessmentInputFingerprint,
  isAssessmentCurrent,
  isEnvironmentalRefreshCurrent,
  isPendingAssessmentCurrent,
  updateAssessmentInputs,
} from "@/lib/discharge-record-state";
import { createInitialPersistedState, summarizeDischargeRecord } from "@/lib/discharge-storage";
import type { PersistedDischargeState } from "@/lib/discharge-storage";
import {
  buildEnvironmentalQueryFromDischarge,
  buildEnvironmentalQueryKey,
} from "@/lib/environmental-query";
import {
  VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID,
  VERIFIED_CENTRAL_PHOENIX_QUERY,
  VERIFIED_CENTRAL_PHOENIX_RESULT,
  lookupVerifiedEnvironmentalResult,
} from "@/lib/verified-environmental-seed";
import type { DischargeRecord } from "@/types/discharge-workflow";

function buildOldMesaRecord(demoCase: typeof DEMO_CASE_B): DischargeRecord {
  const base = createDischargeRecordFromDemoCase(demoCase);
  const mesaDestination = {
    label: "Mesa, Arizona",
    latitude: 33.4152,
    longitude: -111.8315,
  };

  return {
    ...base,
    destination: mesaDestination,
    pendingAssessment: {
      activityId: "227251d7-8807-4a2f-a28c-9c537c67c8e3",
      environmentalQuery: buildEnvironmentalQueryFromDischarge(
        mesaDestination,
        base.journey
      ),
      inputFingerprint: computeAssessmentInputFingerprint({
        ...base,
        destination: mesaDestination,
      }),
      submittedAt: "2026-08-18T14:00:00.000Z",
    },
    assessmentStatus: "processing",
  };
}

function buildOldScottsdaleRecord(): DischargeRecord {
  const base = createDischargeRecordFromDemoCase(DEMO_CASE_C);
  const scottsdaleDestination = {
    label: "Scottsdale, Arizona",
    latitude: 33.4942,
    longitude: -111.9261,
  };

  return {
    ...base,
    destination: scottsdaleDestination,
    assessmentStatus: "assessed",
    assessmentInputFingerprint: computeAssessmentInputFingerprint({
      ...base,
      destination: scottsdaleDestination,
    }),
    assessedAt: "2026-08-18T14:00:00.000Z",
    assessment: {
      environmentalAvailable: true,
      destinationEnvironmental: {
        fortyGuardActivityId: "old-scottsdale-activity",
      },
    } as never,
  };
}

describe("demo case environmental canonicalization", () => {
  it("defines HS-001/002/003 with identical Central Phoenix verified query", () => {
    for (const demoCase of [DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C]) {
      const query = buildEnvironmentalQueryFromDischarge(
        demoCase.destination,
        demoCase.journey
      );

      expect(buildEnvironmentalQueryKey(query)).toBe(
        buildEnvironmentalQueryKey(VERIFIED_CENTRAL_PHOENIX_QUERY)
      );
      expect(query.startDate).toBe("2026-08-18");
      expect(query.startTime).toBe("14:00");
      expect(query.timeZone).toBe("America/Phoenix");
    }
  });
});

describe("demo storage migration", () => {
  it("migrates old HS-002 Mesa coordinates to Central Phoenix", () => {
    const old = buildOldMesaRecord(DEMO_CASE_B);
    const migrated = migrateDemoDischargeRecord(old, DEMO_CASE_B);

    expect(migrated.destination.latitude).toBe(33.4484);
    expect(migrated.destination.longitude).toBe(-112.074);
    expect(migrated.pendingAssessment).toBeNull();
    expect(migrated.assessmentStatus).toBe("not_assessed");
  });

  it("migrates old HS-003 Scottsdale coordinates to Central Phoenix", () => {
    const old = buildOldScottsdaleRecord();
    const migrated = migrateDemoDischargeRecord(old, DEMO_CASE_C);

    expect(migrated.destination.latitude).toBe(33.4484);
    expect(migrated.destination.longitude).toBe(-112.074);
    expect(migrated.assessment).toBeNull();
    expect(migrated.assessmentStatus).toBe("stale");
  });

  it("does not change user-created records during persisted migration", () => {
    const userRecord = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    userRecord.id = "HS-099";
    userRecord.destination = {
      label: "Custom location",
      latitude: 32.2,
      longitude: -110.9,
    };

    const state: PersistedDischargeState = {
      version: 2,
      demoDataVersion: 0,
      discharges: {
        "HS-099": userRecord,
      },
      environmentalCache: {},
    };

    const migrated = migratePersistedState(state, 0);

    expect(migrated.discharges["HS-099"].destination.label).toBe("Custom location");
    expect(migrated.discharges["HS-099"].destination.latitude).toBe(32.2);
  });

  it("invalidates incompatible demo assessments after migration", () => {
    const old = buildOldScottsdaleRecord();
    const migrated = migrateDemoDischargeRecord(old, DEMO_CASE_C);

    expect(isAssessmentCurrent(migrated)).toBe(false);
    expect(migrated.assessment).toBeNull();
  });

  it("allows all A/B/C to hit verified seed after migration without new FortyGuard job", () => {
    for (const demoCase of [DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C]) {
      const record = migrateDemoDischargeRecord(
        createDischargeRecordFromDemoCase(demoCase),
        demoCase
      );
      const query = buildEnvironmentalQueryFromDischarge(
        record.destination,
        record.journey
      );
      const verified = lookupVerifiedEnvironmentalResult(query);

      expect(verified?.activityId).toBe(VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID);
      expect(verified?.meanTemperatureC).toBe(41.55235);

      const assessment = buildCompletedHeatRiskAssessment({
        parsed: {
          origin: record.origin,
          destination: record.destination,
          journey: record.journey,
          patient: record.profile.patient,
          medications: record.profile.medications,
          homeSocial: record.profile.homeSocial,
        },
        environmentalQuery: query,
        environmentalResult: VERIFIED_CENTRAL_PHOENIX_RESULT,
        assessedAt: "2026-08-18T14:00:00.000Z",
      });

      expect(assessment.status).toBe("completed");
      expect(assessment.destinationEnvironmental?.fortyGuardActivityId).toBe(
        VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID
      );
    }
  });

  it("sets demoDataVersion on migrated persisted state", () => {
    const initial = createInitialPersistedState();
    const migrated = migratePersistedState(
      { ...initial, demoDataVersion: 0 },
      0
    );

    expect(migrated.demoDataVersion).toBe(DEMO_DATA_VERSION);
    expect(BUILTIN_DEMO_IDS.every((id) => migrated.discharges[id])).toBe(true);
  });
});

describe("environmental refresh state model", () => {
  it("preserves completed assessment when refresh starts", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const assessed = applySuccessfulAssessment(
      base,
      {
        environmentalAvailable: true,
        riskLevel: "urgent",
        scoreContributions: [],
        recommendedDischargeActions: [],
      } as never,
      [],
      "2026-08-18T14:00:00.000Z",
      fingerprint
    );

    const refreshing = applyEnvironmentalRefresh(assessed, {
      activityId: "refresh-activity-456",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:05:00.000Z",
    });

    expect(refreshing.assessmentStatus).toBe("assessed");
    expect(isAssessmentCurrent(refreshing)).toBe(true);
    expect(refreshing.assessment?.riskLevel).toBe("urgent");
    expect(refreshing.environmentalRefresh?.activityId).toBe("refresh-activity-456");
    expect(refreshing.pendingAssessment).toBeNull();
  });

  it("keeps refresh activity separate from initial pending assessment", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);

    const processing = applyProcessingAssessment(base, {
      activityId: "initial-activity",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:00:00.000Z",
    });

    expect(processing.pendingAssessment?.activityId).toBe("initial-activity");
    expect(processing.environmentalRefresh).toBeNull();
    expect(isPendingAssessmentCurrent(processing)).toBe(true);
    expect(isEnvironmentalRefreshCurrent(processing)).toBe(false);
  });

  it("retains current priority on dashboard while refresh processes", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const assessed = applySuccessfulAssessment(
      base,
      {
        environmentalAvailable: true,
        riskLevel: "urgent",
        scoreContributions: [{ label: "Heat exposure", points: 40 }],
        recommendedDischargeActions: [],
      } as never,
      [],
      "2026-08-18T14:00:00.000Z",
      fingerprint
    );
    const refreshing = applyEnvironmentalRefresh(assessed, {
      activityId: "refresh-activity-456",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:05:00.000Z",
    });

    const summary = summarizeDischargeRecord(refreshing);

    expect(summary.priority).toBe("urgent");
    expect(summary.environmentalRefreshStatus).toBe("processing");
    expect(summary.assessmentStatus).toBe("assessed");
    expect(summary.keyReasons).toContain("Heat exposure");
  });

  it("remains resumable after reopen with same refresh activity ID", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const assessed = applySuccessfulAssessment(
      base,
      { environmentalAvailable: true, riskLevel: "urgent" } as never,
      [],
      "2026-08-18T14:00:00.000Z",
      fingerprint
    );
    const refreshing = applyEnvironmentalRefresh(assessed, {
      activityId: "refresh-activity-456",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:05:00.000Z",
    });

    const reopened = { ...refreshing };

    expect(isEnvironmentalRefreshCurrent(reopened)).toBe(true);
    expect(reopened.environmentalRefresh?.activityId).toBe("refresh-activity-456");
    expect(isAssessmentCurrent(reopened)).toBe(true);
  });

  it("marks reassessment required when inputs change during initial processing", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_B);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const processing = applyProcessingAssessment(base, {
      activityId: "initial-activity",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:00:00.000Z",
    });

    const changed = updateAssessmentInputs(processing, {
      profile: {
        ...processing.profile,
        patient: { ...processing.profile.patient, age: 70 },
      },
    });

    expect(changed.pendingAssessment).toBeNull();
    expect(changed.reassessmentRequired).toBe(true);
    expect(isPendingAssessmentCurrent(changed)).toBe(false);
  });

  it("clears environmental failure when a new processing attempt starts", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_C);
    const failed: DischargeRecord = {
      ...base,
      assessmentStatus: "environmental_unavailable",
      environmentalFailure: "Environmental assessment unavailable",
      assessment: { environmentalAvailable: false } as never,
      assessmentInputFingerprint: computeAssessmentInputFingerprint(base),
      assessedAt: "2026-08-18T14:00:00.000Z",
    };

    const retrying = applyProcessingAssessment(failed, {
      activityId: "retry-activity",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: computeAssessmentInputFingerprint(base),
      submittedAt: "2026-08-18T14:10:00.000Z",
    });

    expect(retrying.environmentalFailure).toBeNull();
    expect(retrying.assessmentStatus).toBe("processing");
  });

  it("replaces assessment on successful refresh when fingerprint still matches", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const assessed = applySuccessfulAssessment(
      base,
      {
        environmentalAvailable: true,
        riskLevel: "urgent",
        inputFingerprint: fingerprint,
      } as never,
      [],
      "2026-08-18T14:00:00.000Z",
      fingerprint
    );
    const refreshing = applyEnvironmentalRefresh(assessed, {
      activityId: "refresh-activity-456",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:05:00.000Z",
    });

    const refreshed = applySuccessfulAssessment(
      refreshing,
      {
        environmentalAvailable: true,
        riskLevel: "high",
        inputFingerprint: fingerprint,
      } as never,
      [],
      "2026-08-18T14:06:00.000Z",
      fingerprint
    );

    expect(refreshed.assessment?.riskLevel).toBe("high");
    expect(refreshed.environmentalRefresh).toBeNull();
    expect(isAssessmentCurrent(refreshed)).toBe(true);
  });

  it("preserves completed assessment when refresh fails", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const assessed = applySuccessfulAssessment(
      base,
      {
        environmentalAvailable: true,
        riskLevel: "urgent",
      } as never,
      [],
      "2026-08-18T14:00:00.000Z",
      fingerprint
    );
    const refreshing = applyEnvironmentalRefresh(assessed, {
      activityId: "refresh-activity-456",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:05:00.000Z",
    });

    const failed = applyEnvironmentalRefreshFailure(
      refreshing,
      "FortyGuard refresh timed out.",
      "2026-08-18T14:10:00.000Z"
    );

    expect(isAssessmentCurrent(failed)).toBe(true);
    expect(failed.assessment?.riskLevel).toBe("urgent");
    expect(failed.environmentalRefreshFailure).toBe("FortyGuard refresh timed out.");
  });

  it("clears refresh when patient inputs change during refresh", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const assessed = applySuccessfulAssessment(
      base,
      {
        environmentalAvailable: true,
        riskLevel: "urgent",
      } as never,
      [],
      "2026-08-18T14:00:00.000Z",
      fingerprint
    );
    const refreshing = applyEnvironmentalRefresh(assessed, {
      activityId: "refresh-activity-456",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:05:00.000Z",
    });

    const changed = updateAssessmentInputs(refreshing, {
      profile: {
        ...refreshing.profile,
        patient: { ...refreshing.profile.patient, age: 79 },
      },
    });

    expect(changed.environmentalRefresh).toBeNull();
    expect(changed.assessmentStatus).toBe("stale");
    expect(changed.assessment).toBeNull();
  });
});
