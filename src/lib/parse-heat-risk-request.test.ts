import { describe, expect, it } from "vitest";

import { ARIZONA_COVERAGE_ERROR } from "./arizona-locations";
import { DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C, getDemoCaseByPreset } from "./demo-cases";
import { evaluateHeatDischargeRisk } from "./heat-discharge-risk";
import { parseHeatRiskRequest } from "./parse-heat-risk-request";
import { calculateTransitionExposure } from "./transition-exposure";

const VALID_BASE_REQUEST = {
  origin: {
    label: "Banner — University Medical Center Phoenix",
    latitude: 33.4794,
    longitude: -112.0892,
  },
  destination: {
    label: "Central Phoenix, Arizona",
    latitude: 33.4484,
    longitude: -112.074,
  },
  journey: {
    date: "2026-08-18",
    time: "14:00",
    timeZone: "America/Phoenix",
    transportMode: "public_bus" as const,
    durationMinutes: 45,
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
  },
  medications: {
    diuretic: false,
    aceArbArni: false,
    betaBlocker: false,
    anticholinergic: false,
    psychotropic: false,
    lithium: false,
    nsaid: false,
  },
  homeSocial: {
    workingAirConditioning: true,
    livesAlone: false,
    reliableTransport: true,
    caregiverCheckInAvailable: true,
    powerDependentMedicalEquipment: false,
  },
};

describe("parseHeatRiskRequest", () => {
  it("accepts a valid Arizona structured request", () => {
    expect(parseHeatRiskRequest(VALID_BASE_REQUEST)).toEqual(VALID_BASE_REQUEST);
  });

  it("rejects string values for boolean patient factors", () => {
    const parsed = parseHeatRiskRequest({
      ...VALID_BASE_REQUEST,
      patient: {
        ...VALID_BASE_REQUEST.patient,
        heartFailure: "true",
      },
    });

    expect(parsed).toEqual({
      error: "patient.heartFailure must be a boolean.",
    });
  });

  it("rejects string values for boolean medication factors", () => {
    const parsed = parseHeatRiskRequest({
      ...VALID_BASE_REQUEST,
      medications: {
        ...VALID_BASE_REQUEST.medications,
        diuretic: "false",
      },
    });

    expect(parsed).toEqual({
      error: "medications.diuretic must be a boolean.",
    });
  });

  it("rejects invalid age values", () => {
    expect(
      parseHeatRiskRequest({
        ...VALID_BASE_REQUEST,
        patient: { ...VALID_BASE_REQUEST.patient, age: -1 },
      })
    ).toEqual({ error: "patient.age must be an integer between 0 and 120." });

    expect(
      parseHeatRiskRequest({
        ...VALID_BASE_REQUEST,
        patient: { ...VALID_BASE_REQUEST.patient, age: 121 },
      })
    ).toEqual({ error: "patient.age must be an integer between 0 and 120." });

    expect(
      parseHeatRiskRequest({
        ...VALID_BASE_REQUEST,
        patient: { ...VALID_BASE_REQUEST.patient, age: "78" },
      })
    ).toEqual({ error: "patient.age must be a finite number." });
  });

  it("rejects malformed homeSocial objects", () => {
    const parsed = parseHeatRiskRequest({
      ...VALID_BASE_REQUEST,
      homeSocial: {
        workingAirConditioning: true,
      },
    });

    expect(parsed).toEqual({
      error: "homeSocial.livesAlone is required.",
    });
  });

  it("rejects coordinates outside Arizona", () => {
    expect(
      parseHeatRiskRequest({
        ...VALID_BASE_REQUEST,
        destination: {
          ...VALID_BASE_REQUEST.destination,
          latitude: 40.7128,
          longitude: -74.006,
        },
      })
    ).toEqual({ error: ARIZONA_COVERAGE_ERROR });
  });

  it("rejects a point inside the old rectangular bounds but outside Arizona", () => {
    expect(
      parseHeatRiskRequest({
        ...VALID_BASE_REQUEST,
        destination: {
          ...VALID_BASE_REQUEST.destination,
          latitude: 36.5,
          longitude: -115,
        },
      })
    ).toEqual({ error: ARIZONA_COVERAGE_ERROR });
  });

  it("rejects invalid transport mode", () => {
    expect(
      parseHeatRiskRequest({
        ...VALID_BASE_REQUEST,
        journey: {
          ...VALID_BASE_REQUEST.journey,
          transportMode: "helicopter",
        },
      })
    ).toEqual({ error: "journey.transportMode must be a supported transport mode." });
  });

  it("allows patient factors to differ while Arizona locations remain valid", () => {
    const alternate = {
      ...VALID_BASE_REQUEST,
      patient: {
        ...VALID_BASE_REQUEST.patient,
        age: 82,
        heartFailure: true,
      },
    };

    expect(parseHeatRiskRequest(alternate)).toEqual(alternate);
  });
});

describe("demo cases", () => {
  it("defines A/B/C presets with synthetic IDs", () => {
    expect(DEMO_CASE_A.id).toBe("HS-001");
    expect(DEMO_CASE_B.id).toBe("HS-002");
    expect(DEMO_CASE_C.id).toBe("HS-003");
    expect(getDemoCaseByPreset("A").profile.patient.heartFailure).toBe(true);
    expect(getDemoCaseByPreset("C").profile.medications.diuretic).toBe(false);
  });
});

describe("patient vulnerability with constant environmental data", () => {
  it("changes score when patient factors differ", () => {
    const transition = calculateTransitionExposure({
      transportMode: "public_bus",
      durationMinutes: 45,
    });

    const environmental = {
      destination: { meanTemperature: 33, maximumTemperature: 39 },
      transition: {
        points: transition.points,
        label: transition.label,
        explanation: transition.explanation,
      },
    };

    const lowRisk = evaluateHeatDischargeRisk({
      environmental,
      patient: VALID_BASE_REQUEST.patient,
      medications: VALID_BASE_REQUEST.medications,
      homeSocial: VALID_BASE_REQUEST.homeSocial,
    });

    const highRisk = evaluateHeatDischargeRisk({
      environmental,
      patient: DEMO_CASE_A.profile.patient,
      medications: DEMO_CASE_A.profile.medications,
      homeSocial: DEMO_CASE_A.profile.homeSocial,
    });

    expect(highRisk.score).toBeGreaterThan(lowRisk.score);
    expect(highRisk.contributions.length).toBeGreaterThan(lowRisk.contributions.length);
  });
});
