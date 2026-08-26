import { describe, expect, it } from "vitest";

import {
  parseCoordinateDraftPair,
  parseNumericDraft,
  validateAgeInput,
  validateDurationInput,
  validateLatitudeDraft,
  validateLongitudeDraft,
} from "@/lib/numeric-form-input";
import { resolveNumericDraft } from "@/components/numeric-field-input";
import { evaluateHeatDischargeRisk } from "@/lib/heat-discharge-risk";
import { DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C } from "@/lib/demo-cases";

describe("numeric form input drafts", () => {
  it("treats empty age input as missing, not zero", () => {
    expect(parseNumericDraft("")).toBeNull();
    expect(validateAgeInput("")).toBe("Enter the patient's age.");
    expect(validateAgeInput("0")).toBeNull();
  });

  it("supports age transition 0 → empty → 78", () => {
    let draft = "0";
    expect(validateAgeInput(draft)).toBeNull();

    draft = "";
    expect(parseNumericDraft(draft)).toBeNull();
    expect(validateAgeInput(draft)).toBe("Enter the patient's age.");

    draft = "7";
    expect(parseNumericDraft(draft)).toBe(7);

    draft = "78";
    expect(parseNumericDraft(draft)).toBe(78);
    expect(validateAgeInput(draft)).toBeNull();
  });

  it("supports clearing and replacing journey duration", () => {
    let draft = "45";
    expect(validateDurationInput(draft)).toBeNull();

    draft = "";
    expect(validateDurationInput(draft)).toBe("Enter a valid journey duration.");

    draft = "30";
    expect(parseNumericDraft(draft)).toBe(30);
    expect(validateDurationInput(draft)).toBeNull();
  });

  it("supports clearing and replacing latitude", () => {
    let draft = "33.4484";
    expect(validateLatitudeDraft(draft)).toBeNull();

    draft = "";
    expect(validateLatitudeDraft(draft)).toBe("Enter a latitude value.");

    draft = "33.4561";
    expect(parseNumericDraft(draft)).toBeCloseTo(33.4561, 4);
  });

  it("supports editing negative longitude naturally", () => {
    let draft = "-111.9261";
    expect(validateLongitudeDraft(draft)).toBeNull();

    draft = "-";
    expect(validateLongitudeDraft(draft)).toBe("Enter a longitude value.");

    draft = "-112.074";
    expect(parseNumericDraft(draft)).toBeCloseTo(-112.074, 3);
    expect(validateLongitudeDraft(draft)).toBeNull();
  });

  it("blocks coordinate confirmation when drafts are incomplete", () => {
    expect(parseCoordinateDraftPair("", "-112.074")).toEqual({
      error: "Enter a latitude value.",
    });
    expect(parseCoordinateDraftPair("33.4484", "")).toEqual({
      error: "Enter a longitude value.",
    });
  });

  it("does not treat empty required numeric values as zero for assessment validation", () => {
    expect(validateAgeInput("")).not.toBeNull();
    expect(validateDurationInput("")).not.toBeNull();
    expect(parseCoordinateDraftPair("", "")).toEqual({
      error: "Enter a latitude value.",
    });
  });

  it("keeps blank draft distinct from persisted zero", () => {
    expect(resolveNumericDraft(undefined, 0)).toBe("0");
    expect(resolveNumericDraft("", 0)).toBe("");
    expect(parseNumericDraft(resolveNumericDraft("", 0))).toBeNull();
  });
});

describe("demo case regression", () => {
  it("keeps HS-001/002/003 risk outputs unchanged", () => {
    for (const demoCase of [DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C]) {
      const result = evaluateHeatDischargeRisk({
        environmental: {
          destination: { meanTemperature: 41.6, maximumTemperature: 41.6 },
          transition: { points: 9, label: "Public bus", explanation: "Test" },
        },
        patient: demoCase.profile.patient,
        medications: demoCase.profile.medications,
        homeSocial: demoCase.profile.homeSocial,
      });

      expect(result.recommendedActions.length).toBeGreaterThan(0);
    }

    const hs001 = evaluateHeatDischargeRisk({
      environmental: {
        destination: { meanTemperature: 41.6, maximumTemperature: 41.6 },
        transition: { points: 9, label: "Public bus", explanation: "Test" },
      },
      patient: DEMO_CASE_A.profile.patient,
      medications: DEMO_CASE_A.profile.medications,
      homeSocial: DEMO_CASE_A.profile.homeSocial,
    });

    expect(hs001.priority).toBe("urgent");
    expect(hs001.recommendedActions).toHaveLength(6);
  });
});
