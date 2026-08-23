import { describe, expect, it } from "vitest";

import { evaluateHeatDischargeRisk } from "./heat-discharge-risk";
import {
  getHackathonDemoEnvironmentalRequest,
  HACKATHON_DEMO_ENVIRONMENT_ERROR,
} from "./discharge-locations";
import { parseHeatRiskRequest } from "./parse-heat-risk-request";

const DEMO_ENVIRONMENT = getHackathonDemoEnvironmentalRequest();

const VALID_BASE_REQUEST = {
  ...DEMO_ENVIRONMENT,
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
  it("accepts a valid structured request", () => {
    const parsed = parseHeatRiskRequest(VALID_BASE_REQUEST);

    expect(parsed).toEqual(VALID_BASE_REQUEST);
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
        patient: {
          ...VALID_BASE_REQUEST.patient,
          age: -1,
        },
      })
    ).toEqual({ error: "patient.age must be between 0 and 120." });

    expect(
      parseHeatRiskRequest({
        ...VALID_BASE_REQUEST,
        patient: {
          ...VALID_BASE_REQUEST.patient,
          age: 121,
        },
      })
    ).toEqual({ error: "patient.age must be between 0 and 120." });

    expect(
      parseHeatRiskRequest({
        ...VALID_BASE_REQUEST,
        patient: {
          ...VALID_BASE_REQUEST.patient,
          age: "78",
        },
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

  it("accepts the validated Phoenix hackathon demo environment", () => {
    const parsed = parseHeatRiskRequest(VALID_BASE_REQUEST);

    expect(parsed).toEqual(VALID_BASE_REQUEST);
  });

  it("rejects a different latitude", () => {
    const parsed = parseHeatRiskRequest({
      ...VALID_BASE_REQUEST,
      latitude: 34,
    });

    expect(parsed).toEqual({ error: HACKATHON_DEMO_ENVIRONMENT_ERROR });
  });

  it("rejects a different longitude", () => {
    const parsed = parseHeatRiskRequest({
      ...VALID_BASE_REQUEST,
      longitude: -111,
    });

    expect(parsed).toEqual({ error: HACKATHON_DEMO_ENVIRONMENT_ERROR });
  });

  it("rejects an unsupported timezone", () => {
    const parsed = parseHeatRiskRequest({
      ...VALID_BASE_REQUEST,
      timeZone: "America/Los_Angeles",
    });

    expect(parsed).toEqual({ error: HACKATHON_DEMO_ENVIRONMENT_ERROR });
  });

  it("rejects an unsupported discharge date", () => {
    const parsed = parseHeatRiskRequest({
      ...VALID_BASE_REQUEST,
      date: "2026-08-19",
    });

    expect(parsed).toEqual({ error: HACKATHON_DEMO_ENVIRONMENT_ERROR });
  });

  it("rejects an unsupported discharge time", () => {
    const parsed = parseHeatRiskRequest({
      ...VALID_BASE_REQUEST,
      time: "15:00",
    });

    expect(parsed).toEqual({ error: HACKATHON_DEMO_ENVIRONMENT_ERROR });
  });

  it("allows patient factors to differ while the environmental scenario stays fixed", () => {
    const alternatePatientRequest = {
      ...VALID_BASE_REQUEST,
      patient: {
        age: 82,
        cardiovascularDisease: true,
        heartFailure: true,
        kidneyDisease: false,
        respiratoryDisease: false,
        diabetes: true,
        cognitiveImpairment: true,
        limitedMobility: true,
      },
      medications: {
        diuretic: true,
        aceArbArni: true,
        betaBlocker: false,
        anticholinergic: false,
        psychotropic: false,
        lithium: false,
        nsaid: false,
      },
      homeSocial: {
        workingAirConditioning: false,
        livesAlone: true,
        reliableTransport: false,
        caregiverCheckInAvailable: false,
        powerDependentMedicalEquipment: true,
      },
    };

    const parsed = parseHeatRiskRequest(alternatePatientRequest);

    expect(parsed).toEqual(alternatePatientRequest);
  });
});

describe("evaluateHeatDischargeRisk with request profile inputs", () => {
  it("changes the score when patient and home factors differ", () => {
    const environmental = {
      meanTemperature: 33,
      maximumTemperature: 39,
    };

    const lowRisk = evaluateHeatDischargeRisk({
      environmental,
      patient: VALID_BASE_REQUEST.patient,
      medications: VALID_BASE_REQUEST.medications,
      homeSocial: VALID_BASE_REQUEST.homeSocial,
    });

    const highRisk = evaluateHeatDischargeRisk({
      environmental,
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
        ...VALID_BASE_REQUEST.medications,
        diuretic: true,
      },
      homeSocial: {
        workingAirConditioning: false,
        livesAlone: true,
        reliableTransport: true,
        caregiverCheckInAvailable: false,
        powerDependentMedicalEquipment: false,
      },
    });

    expect(highRisk.score).toBeGreaterThan(lowRisk.score);
    expect(highRisk.priority).not.toBe(lowRisk.priority);
    expect(
      highRisk.riskFactors.some((factor) =>
        factor.explanation.includes("Heart failure")
      )
    ).toBe(true);
    expect(
      lowRisk.riskFactors.some((factor) =>
        factor.explanation.includes("Heart failure")
      )
    ).toBe(false);
  });
});
