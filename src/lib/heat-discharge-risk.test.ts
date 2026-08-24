import { describe, expect, it } from "vitest";

import {
  clampScore,
  evaluateHeatDischargeRisk,
  type HeatDischargeRiskInput,
} from "./heat-discharge-risk";

function createBaseInput(
  overrides: Partial<{
    environmental: Partial<HeatDischargeRiskInput["environmental"]>;
    patient: Partial<HeatDischargeRiskInput["patient"]>;
    medications: Partial<HeatDischargeRiskInput["medications"]>;
    homeSocial: Partial<HeatDischargeRiskInput["homeSocial"]>;
  }> = {}
): HeatDischargeRiskInput {
  return {
    environmental: {
      destination: {
        meanTemperature: 24,
        maximumTemperature: 28,
        ...overrides.environmental?.destination,
      },
      transition: {
        points: 0,
        label: "Transition exposure",
        explanation: "No transition exposure for baseline test.",
        ...overrides.environmental?.transition,
      },
    },
    patient: {
      age: 40,
      cardiovascularDisease: false,
      heartFailure: false,
      kidneyDisease: false,
      respiratoryDisease: false,
      diabetes: false,
      cognitiveImpairment: false,
      limitedMobility: false,
      ...overrides.patient,
    },
    medications: {
      diuretic: false,
      aceArbArni: false,
      betaBlocker: false,
      anticholinergic: false,
      psychotropic: false,
      lithium: false,
      nsaid: false,
      ...overrides.medications,
    },
    homeSocial: {
      workingAirConditioning: true,
      livesAlone: false,
      reliableTransport: true,
      caregiverCheckInAvailable: true,
      powerDependentMedicalEquipment: false,
      ...overrides.homeSocial,
    },
  };
}

describe("evaluateHeatDischargeRisk", () => {
  it("returns a low score and routine priority for a low-vulnerability patient with working air conditioning", () => {
    const result = evaluateHeatDischargeRisk(createBaseInput());

    expect(result.score).toBeLessThan(25);
    expect(result.priority).toBe("routine");
    expect(result.contributions).toHaveLength(0);
    expect(result.recommendedActions.map((action) => action.action)).toContain(
      "Provide patient and caregiver education on heat-related warning symptoms (for example, dizziness, confusion, reduced urine output, chest pain, or breathing difficulty) and when to seek emergency care. This is educational guidance only—not a diagnosis."
    );
  });

  it("elevates an older patient with heart failure, kidney disease, diuretic use, no air conditioning, and living alone", () => {
    const result = evaluateHeatDischargeRisk(
      createBaseInput({
        environmental: {
          destination: {
            meanTemperature: 33,
            maximumTemperature: 39,
          },
        },
        patient: {
          age: 78,
          heartFailure: true,
          kidneyDisease: true,
        },
        medications: {
          diuretic: true,
        },
        homeSocial: {
          workingAirConditioning: false,
          livesAlone: true,
          caregiverCheckInAvailable: false,
        },
      })
    );

    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(["high", "urgent"]).toContain(result.priority);
    expect(result.contributions.some((item) => item.id === "heart-failure")).toBe(
      true
    );
    expect(
      result.recommendedActions.some((action) =>
        action.action.includes("social-work or cooling-resource assessment")
      )
    ).toBe(true);
  });

  it("returns structured score contributions with actual weights", () => {
    const result = evaluateHeatDischargeRisk(
      createBaseInput({
        environmental: {
          destination: {
            meanTemperature: 33,
            maximumTemperature: 39,
          },
        },
        patient: { age: 78, heartFailure: true },
      })
    );

    expect(result.contributions.find((item) => item.id === "destination-mean-high")).toEqual(
      expect.objectContaining({ points: 15, category: "environmental" })
    );
    expect(result.contributions.find((item) => item.id === "age-75-plus")).toEqual(
      expect.objectContaining({ points: 10, category: "clinical" })
    );
    expect(result.rawScore).toBeGreaterThanOrEqual(result.score);
  });

  it("never returns a score above 100 even when every factor is present", () => {
    const result = evaluateHeatDischargeRisk(
      createBaseInput({
        environmental: {
          destination: {
            meanTemperature: 40,
            maximumTemperature: 45,
          },
          transition: {
            points: 18,
            label: "Transition exposure",
            explanation: "High transition exposure",
          },
        },
        patient: {
          age: 90,
          cardiovascularDisease: true,
          heartFailure: true,
          kidneyDisease: true,
          respiratoryDisease: true,
          diabetes: true,
          cognitiveImpairment: true,
          limitedMobility: true,
        },
        medications: {
          diuretic: true,
          aceArbArni: true,
          betaBlocker: true,
          anticholinergic: true,
          psychotropic: true,
          lithium: true,
          nsaid: true,
        },
        homeSocial: {
          workingAirConditioning: false,
          livesAlone: true,
          reliableTransport: false,
          caregiverCheckInAvailable: false,
          powerDependentMedicalEquipment: true,
        },
      })
    );

    expect(result.score).toBeLessThanOrEqual(100);
    expect(clampScore(result.rawScore)).toBe(result.score);
    expect(result.priority).toBe("urgent");
  });

  it("includes transition exposure as an environmental contribution", () => {
    const result = evaluateHeatDischargeRisk(
      createBaseInput({
        environmental: {
          transition: {
            points: 9,
            label: "Journey transition modifier",
            explanation: "Public bus transition modifier.",
          },
        },
      })
    );

    expect(result.contributions).toContainEqual(
      expect.objectContaining({ id: "transition-exposure", points: 9 })
    );
  });

  it("flags medication review without instructing automatic medication changes", () => {
    const result = evaluateHeatDischargeRisk(
      createBaseInput({
        medications: {
          diuretic: true,
          lithium: true,
          betaBlocker: true,
        },
      })
    );

    const medicationAction = result.recommendedActions.find((action) =>
      action.action.includes("medication review")
    );

    expect(medicationAction).toBeDefined();
    expect(medicationAction?.suggestedOwner).toBe("pharmacist");
    expect(medicationAction?.action).toMatch(
      /Never stop or change medications automatically/i
    );
  });

  it("includes individualized fluid guidance for heart failure and kidney disease in high heat", () => {
    const result = evaluateHeatDischargeRisk(
      createBaseInput({
        environmental: {
          destination: {
            meanTemperature: 33,
            maximumTemperature: 39,
          },
        },
        patient: {
          heartFailure: true,
          kidneyDisease: true,
        },
      })
    );

    const fluidAction = result.recommendedActions.find((action) =>
      action.action.includes("individualized fluid plan")
    );

    expect(fluidAction?.suggestedOwner).toBe("treating clinician");
    expect(fluidAction?.action).toMatch(/Do not provide generic hydration instructions/i);
    expect(fluidAction?.action).toMatch(
      /fluid intake should automatically be increased/i
    );
  });

  it("deduplicates recommended actions when multiple triggers map to the same workflow step", () => {
    const result = evaluateHeatDischargeRisk(
      createBaseInput({
        patient: {
          limitedMobility: true,
        },
        homeSocial: {
          reliableTransport: false,
        },
      })
    );

    const transportActions = result.recommendedActions.filter((action) =>
      action.action.includes("transport and cooling-centre access")
    );

    expect(transportActions).toHaveLength(1);
  });

  it("includes only one 24–48-hour follow-up action when multiple follow-up triggers apply", () => {
    const result = evaluateHeatDischargeRisk(
      createBaseInput({
        patient: {
          age: 78,
          heartFailure: true,
        },
        homeSocial: {
          livesAlone: true,
          caregiverCheckInAvailable: false,
        },
        environmental: {
          destination: {
            meanTemperature: 33,
            maximumTemperature: 39,
          },
        },
      })
    );

    const followUpActions = result.recommendedActions.filter((action) =>
      action.action.includes("follow-up within 24–48 hours")
    );

    expect(followUpActions).toHaveLength(1);
    expect(followUpActions[0]?.suggestedOwner).toBe("discharge coordinator");
  });
});
