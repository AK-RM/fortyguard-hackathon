import { describe, expect, it } from "vitest";

import {
  ACTION_METHODOLOGY,
  CLINICAL_METHODOLOGY_DISCLAIMER,
  CLINICAL_METHODOLOGY_SUMMARY,
  CLINICAL_SOURCES,
  FACTOR_METHODOLOGY,
} from "@/lib/clinical-methodology";
import { CLINICIAN_VALIDATION } from "@/lib/clinician-validation";
import { DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C } from "@/lib/demo-cases";
import {
  applyEnvironmentalRefresh,
  applySuccessfulAssessment,
  computeAssessmentInputFingerprint,
  isEnvironmentalRefreshCurrent,
} from "@/lib/discharge-record-state";
import { createDischargeRecordFromDemoCase } from "@/lib/demo-cases";
import {
  buildEnvironmentalQueryFromDischarge,
  buildEnvironmentalQueryKey,
} from "@/lib/environmental-query";
import {
  assertVerifiedComparisonInputs,
  buildMatchedPatientComparisonForDemoCase,
  buildMatchedPatientEnvironmentalComparison,
  selectBestCounterfactualDemoCase,
  verifyComparisonEnvironmentalSnapshots,
} from "@/lib/environmental-comparison";
import { evaluateHeatDischargeRisk } from "@/lib/heat-discharge-risk";
import {
  VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID,
  VERIFIED_CENTRAL_PHOENIX_EARLY_ACTIVITY_ID,
  VERIFIED_CENTRAL_PHOENIX_EARLY_RESULT,
  VERIFIED_CENTRAL_PHOENIX_QUERY,
  VERIFIED_CENTRAL_PHOENIX_RESULT,
  lookupVerifiedEnvironmentalResult,
} from "@/lib/verified-environmental-seed";

describe("clinical methodology references", () => {
  it("defines authoritative CDC/AHRQ/WHO sources", () => {
    expect(Object.keys(CLINICAL_SOURCES)).toEqual(
      expect.arrayContaining([
        "cdc-clinical-guidance",
        "cdc-heat-medications",
        "cdc-older-adults",
        "cdc-risk-factors",
        "ahrq-ideal-discharge",
        "who-keep-cool",
      ])
    );
    expect(CLINICAL_SOURCES["cdc-clinical-guidance"].url).toContain("cdc.gov");
  });

  it("does not describe numerical weights as CDC-validated", () => {
    expect(CLINICAL_METHODOLOGY_SUMMARY).toMatch(/not been clinically calibrated/i);
    expect(CLINICAL_METHODOLOGY_DISCLAIMER).toMatch(/not the numerical coefficients/i);
    expect(CLINICAL_METHODOLOGY_SUMMARY).not.toMatch(/CDC validates our score/i);
    expect(FACTOR_METHODOLOGY.every((entry) => entry.doesNotSupport.length > 0)).toBe(
      true
    );
    expect(ACTION_METHODOLOGY.some((entry) => entry.factorOrAction === "Medication review")).toBe(
      true
    );
  });

  it("keeps medication actions review-only in methodology", () => {
    const medicationEntry = ACTION_METHODOLOGY.find(
      (entry) => entry.factorOrAction === "Medication review"
    );

    expect(medicationEntry?.doesNotSupport).toMatch(/automatic/i);
  });

  it("preserves HF/CKD fluid-plan safety language in scoring actions", () => {
    const result = evaluateHeatDischargeRisk({
      environmental: {
        destination: { meanTemperature: 41.5, maximumTemperature: 41.6 },
        transition: { points: 0, label: "Transition", explanation: "Test" },
      },
      patient: {
        age: 78,
        cardiovascularDisease: false,
        heartFailure: true,
        kidneyDisease: true,
        respiratoryDisease: false,
        diabetes: false,
        cognitiveImpairment: false,
        limitedMobility: false,
      },
      medications: { diuretic: true, aceArbArni: false, betaBlocker: false, anticholinergic: false, psychotropic: false, lithium: false, nsaid: false },
      homeSocial: {
        workingAirConditioning: false,
        livesAlone: true,
        reliableTransport: true,
        caregiverCheckInAvailable: false,
        powerDependentMedicalEquipment: false,
      },
    });

    const fluidAction = result.recommendedActions.find(
      (action) => action.id === "fluid-plan-review"
    );

    expect(fluidAction?.action).toMatch(/Do not provide generic hydration instructions/i);
    expect(fluidAction?.action).toMatch(/individualized fluid plan/i);
  });
});

describe("environmental counterfactual", () => {
  it("uses HS-003 for dashboard comparison when it produces the strongest workflow delta", () => {
    const comparison = buildMatchedPatientEnvironmentalComparison();

    expect(selectBestCounterfactualDemoCase().id).toBe("HS-003");
    expect(comparison.demoCaseId).toBe("HS-003");
    expect(comparison.deltas.priorityChanged).toBe(true);
  });

  it("verifies comparison snapshots programmatically", () => {
    const verification = verifyComparisonEnvironmentalSnapshots();

    expect(verification.bothVerified).toBe(true);
  });

  it("holds patient profile constant and changes only environmental query window", () => {
    const comparison = buildMatchedPatientComparisonForDemoCase(DEMO_CASE_C);

    expect(comparison.scenarioA.actionIds).toEqual(comparison.scenarioB.actionIds);
    expect(comparison.deltas.priorityChanged).toBe(true);
  });

  it("shows activity IDs and provenance for both scenarios", () => {
    const comparison = buildMatchedPatientEnvironmentalComparison();

    expect(comparison.scenarioA.activityId).toBe(VERIFIED_CENTRAL_PHOENIX_ACTIVITY_ID);
    expect(comparison.scenarioB.activityId).toBe(VERIFIED_CENTRAL_PHOENIX_EARLY_ACTIVITY_ID);
    expect(comparison.scenarioA.provenance).toBe("verified_historical_snapshot");
    expect(comparison.scenarioB.provenance).toBe("verified_historical_snapshot");
  });

  it("changes environmental contribution when verified query changes", () => {
    const comparison = buildMatchedPatientEnvironmentalComparison();

    expect(comparison.scenarioA.meanTemperatureC).not.toBe(
      comparison.scenarioB.meanTemperatureC
    );
    expect(comparison.deltas.environmentalPoints).not.toBe(0);
    expect(comparison.scenarioA.environmentalPoints).toBeGreaterThan(
      comparison.scenarioB.environmentalPoints
    );
    expect(comparison.deltas.rawScore).not.toBe(0);
  });

  it("cannot use fabricated environmental values in verified lookup", () => {
    const fabricatedQuery = {
      ...VERIFIED_CENTRAL_PHOENIX_QUERY,
      latitude: 99,
      longitude: -99,
    };

    expect(lookupVerifiedEnvironmentalResult(fabricatedQuery)).toBeNull();
  });
});

describe("regression safeguards", () => {
  it("keeps A/B/C on the standardized Central Phoenix environmental query", () => {
    for (const demoCase of [DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C]) {
      const query = buildEnvironmentalQueryFromDischarge(
        demoCase.destination,
        demoCase.journey
      );

      expect(buildEnvironmentalQueryKey(query)).toBe(
        buildEnvironmentalQueryKey(VERIFIED_CENTRAL_PHOENIX_QUERY)
      );
    }
  });

  it("preserves refresh behavior as separate from completed assessment", () => {
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
      activityId: "refresh-123",
      environmentalQuery: VERIFIED_CENTRAL_PHOENIX_QUERY,
      inputFingerprint: fingerprint,
      submittedAt: "2026-08-18T14:05:00.000Z",
    });

    expect(refreshing.assessmentStatus).toBe("assessed");
    expect(isEnvironmentalRefreshCurrent(refreshing)).toBe(true);
  });

  it("shows honest clinician validation empty state", () => {
    expect(CLINICIAN_VALIDATION.status).toBe("evaluation_in_progress");
    expect(CLINICIAN_VALIDATION.metrics.clinicianCount).toBeNull();
    expect(CLINICIAN_VALIDATION.emptyStateLabel).toMatch(/in progress/i);
  });
});
