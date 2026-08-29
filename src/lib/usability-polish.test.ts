import { describe, expect, it } from "vitest";

import { getTopFlagReasons } from "@/lib/discharge-display";
import {
  buildActionTriggerContextFromRecord,
  getActionTriggeredBy,
} from "@/lib/action-triggers";
import { DEMO_CASE_A, createDischargeRecordFromDemoCase, getDemoCaseById } from "@/lib/demo-cases";
import { BUILTIN_DEMO_IDS } from "@/lib/demo-storage-migration";
import {
  resetBuiltinDemoState,
  upsertDischargeRecord,
} from "@/lib/discharge-storage";
import { buildMatchedPatientEnvironmentalComparison } from "@/lib/environmental-comparison";
import { evaluateHeatDischargeRisk } from "@/lib/heat-discharge-risk";
import { isStandardizedDemoCase } from "@/lib/prepared-case-display";

describe("prepared case review mode", () => {
  it("identifies HS-001/002/003 as standardized demo cases", () => {
    for (const id of BUILTIN_DEMO_IDS) {
      const demoCase = getDemoCaseById(id);
      expect(demoCase).not.toBeNull();
      const record = createDischargeRecordFromDemoCase(demoCase!);
      expect(isStandardizedDemoCase(record)).toBe(true);
    }
  });

  it("does not treat custom IDs as standardized demo cases", () => {
    const record = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    record.id = "HS-004";

    expect(isStandardizedDemoCase(record)).toBe(false);
  });
});

describe("action trigger mapping", () => {
  const hs001RiskInput = {
    environmental: {
      destination: { meanTemperature: 41.6, maximumTemperature: 41.6 },
      transition: { points: 9, label: "Public bus", explanation: "Test" },
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
    medications: {
      diuretic: true,
      aceArbArni: false,
      betaBlocker: false,
      anticholinergic: false,
      psychotropic: false,
      lithium: false,
      nsaid: false,
    },
    homeSocial: {
      workingAirConditioning: false,
      livesAlone: true,
      reliableTransport: true,
      caregiverCheckInAvailable: false,
      powerDependentMedicalEquipment: false,
    },
  };

  it("maps HS-001 actions to input-factor triggers", () => {
    const result = evaluateHeatDischargeRisk(hs001RiskInput);
    const context = {
      patient: hs001RiskInput.patient,
      medications: hs001RiskInput.medications,
      homeSocial: hs001RiskInput.homeSocial,
      journey: { transportMode: "public_bus" as const, durationMinutes: 45 },
      destinationEnvironmental: {
        meanTemperatureC: 41.6,
        maximumTemperatureC: 41.6,
      },
      transitionPoints: 9,
      priority: result.priority,
    };

    expect(result.recommendedActions).toHaveLength(6);
    expect(getActionTriggeredBy("cooling-resource-assessment", context)).toBe(
      "No working AC + high destination heat"
    );
    expect(getActionTriggeredBy("medication-review", context)).toBe(
      "Diuretic + high destination heat"
    );
    expect(getActionTriggeredBy("follow-up-24-48", context)).toBe(
      "Lives alone + no caregiver check-in"
    );
    expect(getActionTriggeredBy("transition-heat-planning", context)).toBe(
      "Public bus · 45 min"
    );
    expect(getActionTriggeredBy("fluid-plan-review", context)).toBe(
      "HF/CKD + high heat"
    );
  });

  it("builds trigger context from an assessed discharge record", () => {
    const record = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    record.assessment = {
      environmentalAvailable: true,
      riskLevel: "urgent",
      destinationEnvironmental: {
        meanTemperatureC: 41.6,
        maximumTemperatureC: 41.6,
      },
      transitionEnvironmental: { transitionPoints: 9 },
    } as never;

    const context = buildActionTriggerContextFromRecord(record);
    expect(context.transitionPoints).toBe(9);
    expect(getActionTriggeredBy("medication-review", context)).toContain("Diuretic");
  });
});

describe("demo reset", () => {
  it("restores only built-in demo records", () => {
    const polluted = resetBuiltinDemoState();
    const withExtra = upsertDischargeRecord(polluted, {
      ...createDischargeRecordFromDemoCase(DEMO_CASE_A),
      id: "HS-004",
    });

    expect(Object.keys(withExtra.discharges)).toContain("HS-004");

    const reset = resetBuiltinDemoState();

    expect(Object.keys(reset.discharges).sort()).toEqual(["HS-001", "HS-002", "HS-003"]);
    expect(reset.discharges["HS-004"]).toBeUndefined();
  });
});

describe("environmental comparison regression", () => {
  it("keeps HS-003 Enhanced to Routine counterfactual", () => {
    const comparison = buildMatchedPatientEnvironmentalComparison();

    expect(comparison.demoCaseId).toBe("HS-003");
    expect(comparison.scenarioA.priority).toBe("enhanced");
    expect(comparison.scenarioB.priority).toBe("routine");
    expect(comparison.deltas.priorityChanged).toBe(true);
  });
});

describe("flag reason display", () => {
  it("deduplicates simplified destination heat labels in HS-001-style assessments", () => {
    const result = evaluateHeatDischargeRisk({
      environmental: {
        destination: { meanTemperature: 41.6, maximumTemperature: 41.6 },
        transition: { points: 9, label: "Public bus", explanation: "Test" },
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
      medications: {
        diuretic: true,
        aceArbArni: false,
        betaBlocker: false,
        anticholinergic: false,
        psychotropic: false,
        lithium: false,
        nsaid: false,
      },
      homeSocial: {
        workingAirConditioning: false,
        livesAlone: true,
        reliableTransport: true,
        caregiverCheckInAvailable: false,
        powerDependentMedicalEquipment: false,
      },
    });

    const reasons = getTopFlagReasons(result.contributions);
    const highDestinationHeatCount = reasons.filter(
      (reason) => reason === "High destination heat"
    ).length;

    expect(highDestinationHeatCount).toBeLessThanOrEqual(1);
  });
});
