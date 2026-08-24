import { describe, expect, it } from "vitest";

import { DEMO_CASE_A } from "./demo-cases";
import {
  applySuccessfulAssessment,
  computeAssessmentInputFingerprint,
  isAssessmentCurrent,
  updateAssessmentInputs,
} from "./discharge-record-state";
import { createDischargeRecordFromDemoCase } from "./demo-cases";

describe("discharge record assessment freshness", () => {
  it("invalidates a prior assessment when assessment inputs change", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const assessed = {
      ...base,
      assessmentStatus: "assessed" as const,
      assessmentInputFingerprint: fingerprint,
      assessedAt: "2026-08-18T14:00:00.000Z",
      assessment: {
        environmentalAvailable: true,
      } as never,
    };

    const stale = updateAssessmentInputs(assessed, {
      profile: {
        ...assessed.profile,
        patient: { ...assessed.profile.patient, age: 80 },
      },
    });

    expect(stale.assessmentStatus).toBe("stale");
    expect(stale.assessment).toBeNull();
    expect(stale.actions).toEqual([]);
    expect(isAssessmentCurrent(stale)).toBe(false);
  });

  it("does not invalidate when only workflow actions change", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const fingerprint = computeAssessmentInputFingerprint(base);
    const assessed = {
      ...base,
      assessmentStatus: "assessed" as const,
      assessmentInputFingerprint: fingerprint,
      assessedAt: "2026-08-18T14:00:00.000Z",
      assessment: { environmentalAvailable: true } as never,
      actions: [
        {
          id: "follow-up-24-48",
          action: "Follow up",
          suggestedOwner: "discharge coordinator" as const,
          status: "in_progress" as const,
          createdAt: "2026-08-18T14:00:00.000Z",
        },
      ],
    };

    const withUpdatedActions = {
      ...assessed,
      actions: assessed.actions.map((action) => ({
        ...action,
        status: "completed" as const,
        completedAt: "2026-08-18T15:00:00.000Z",
      })),
    };

    expect(isAssessmentCurrent(withUpdatedActions)).toBe(true);
  });

  it("stores assessedAt and fingerprint on successful assessment", () => {
    const base = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const assessedAt = "2026-08-18T14:00:00.000Z";
    const fingerprint = "fp-123";
    const next = applySuccessfulAssessment(
      base,
      {
        environmentalAvailable: true,
        inputFingerprint: fingerprint,
        assessedAt,
      } as never,
      [],
      assessedAt,
      fingerprint
    );

    expect(next.assessmentStatus).toBe("assessed");
    expect(next.assessedAt).toBe(assessedAt);
    expect(next.assessmentInputFingerprint).toBe(fingerprint);
  });
});
