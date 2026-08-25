import { describe, expect, it } from "vitest";

import {
  DEMO_CASE_A,
  DEMO_CASE_B,
  DEMO_CASE_C,
} from "@/lib/demo-cases";
import {
  buildMatchedPatientComparisonForDemoCase,
  selectBestCounterfactualDemoCase,
  verifyComparisonEnvironmentalSnapshots,
} from "@/lib/environmental-comparison";

describe("counterfactual profile analysis", () => {
  it("calculates HS-001 hot vs cool without tier change", () => {
    const comparison = buildMatchedPatientComparisonForDemoCase(DEMO_CASE_A);

    expect(comparison.scenarioA.priority).toBe("urgent");
    expect(comparison.scenarioB.priority).toBe("urgent");
    expect(comparison.scenarioA.totalScore).toBe(100);
    expect(comparison.scenarioB.totalScore).toBe(100);
    expect(comparison.deltas.priorityChanged).toBe(false);
    expect(comparison.deltas.environmentalPoints).toBe(-15);
    expect(comparison.deltas.rawScore).toBe(-15);
    expect(comparison.scenarioA.environmentalPoints).toBe(41);
    expect(comparison.scenarioB.environmentalPoints).toBe(26);
    expect(comparison.scenarioA.actionIds).toEqual([
      "patient-education",
      "cooling-resource-assessment",
      "follow-up-24-48",
      "medication-review",
      "transition-heat-planning",
      "fluid-plan-review",
    ]);
    expect(comparison.scenarioB.actionIds).toEqual(comparison.scenarioA.actionIds);
  });

  it("calculates HS-002 hot vs cool without tier change", () => {
    const comparison = buildMatchedPatientComparisonForDemoCase(DEMO_CASE_B);

    expect(comparison.scenarioA.priority).toBe("high");
    expect(comparison.scenarioB.priority).toBe("high");
    expect(comparison.scenarioA.totalScore).toBe(69);
    expect(comparison.scenarioB.totalScore).toBe(54);
    expect(comparison.deltas.priorityChanged).toBe(false);
    expect(comparison.deltas.environmentalPoints).toBe(-15);
    expect(comparison.deltas.rawScore).toBe(-15);
  });

  it("calculates HS-003 hot vs cool with enhanced to routine tier change", () => {
    const comparison = buildMatchedPatientComparisonForDemoCase(DEMO_CASE_C);

    expect(comparison.scenarioA.totalScore).toBe(32);
    expect(comparison.scenarioA.priority).toBe("enhanced");
    expect(comparison.scenarioA.actionIds).toEqual(["patient-education"]);
    expect(comparison.scenarioB.totalScore).toBe(17);
    expect(comparison.scenarioB.priority).toBe("routine");
    expect(comparison.scenarioB.actionIds).toEqual(["patient-education"]);
    expect(comparison.deltas.priorityChanged).toBe(true);
    expect(comparison.deltas.actionsAdded).toEqual([]);
    expect(comparison.deltas.actionsRemoved).toEqual([]);
    expect(comparison.deltas.environmentalPoints).toBe(-15);
    expect(comparison.deltas.rawScore).toBe(-15);
  });

  it("selects HS-003 as the strongest natural counterfactual profile", () => {
    expect(selectBestCounterfactualDemoCase().id).toBe("HS-003");
  });

  it("verifies both FortyGuard snapshots against stored metadata", () => {
    const verification = verifyComparisonEnvironmentalSnapshots();

    expect(verification.bothVerified).toBe(true);
    expect(verification.hot.activityId).toBe("c2307681-94c3-40ff-b2ac-952d47d1fb9f");
    expect(verification.cool.activityId).toBe("20258c9e-f533-4c58-ba4d-5903ddf29984");
    expect(verification.hot.meanTemperatureC).toBe(41.55235);
    expect(verification.cool.meanTemperatureC).toBe(34.2316125);
  });
});
