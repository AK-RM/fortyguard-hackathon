import {
  ARIZONA_TIME_ZONE,
  BANNER_PHOENIX_PRESET,
  PHOENIX_DEMO_PRESET,
  getPhoenixDemoDateTime,
} from "@/lib/arizona-locations";
import { toDischargeLocation } from "@/lib/location-presets";
import type { DemoCaseDefinition } from "@/types/discharge-workflow";

const DEMO_DATE_TIME = getPhoenixDemoDateTime();

export const DEMO_CASE_A: DemoCaseDefinition = {
  preset: "A",
  id: "HS-001",
  label: "Case A — High vulnerability",
  vulnerabilityLabel: "High vulnerability",
  origin: toDischargeLocation(BANNER_PHOENIX_PRESET),
  destination: toDischargeLocation(PHOENIX_DEMO_PRESET),
  journey: {
    ...DEMO_DATE_TIME,
    transportMode: "public_bus",
    durationMinutes: 45,
  },
  profile: {
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
  },
};

export const DEMO_CASE_B: DemoCaseDefinition = {
  preset: "B",
  id: "HS-002",
  label: "Case B — Moderate vulnerability",
  vulnerabilityLabel: "Moderate vulnerability",
  origin: toDischargeLocation(BANNER_PHOENIX_PRESET),
  destination: toDischargeLocation(PHOENIX_DEMO_PRESET),
  journey: {
    ...DEMO_DATE_TIME,
    transportMode: "taxi_rideshare",
    durationMinutes: 30,
  },
  profile: {
    patient: {
      age: 68,
      cardiovascularDisease: false,
      heartFailure: false,
      kidneyDisease: false,
      respiratoryDisease: true,
      diabetes: true,
      cognitiveImpairment: false,
      limitedMobility: false,
    },
    medications: {
      diuretic: false,
      aceArbArni: false,
      betaBlocker: true,
      anticholinergic: false,
      psychotropic: false,
      lithium: false,
      nsaid: false,
    },
    homeSocial: {
      workingAirConditioning: true,
      livesAlone: true,
      reliableTransport: true,
      caregiverCheckInAvailable: true,
      powerDependentMedicalEquipment: false,
    },
  },
};

export const DEMO_CASE_C: DemoCaseDefinition = {
  preset: "C",
  id: "HS-003",
  label: "Case C — Lower vulnerability",
  vulnerabilityLabel: "Lower vulnerability",
  origin: toDischargeLocation(BANNER_PHOENIX_PRESET),
  destination: toDischargeLocation(PHOENIX_DEMO_PRESET),
  journey: {
    ...DEMO_DATE_TIME,
    transportMode: "ac_private_vehicle",
    durationMinutes: 20,
  },
  profile: {
    patient: {
      age: 45,
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
  },
};

export const DEMO_CASES: DemoCaseDefinition[] = [
  DEMO_CASE_A,
  DEMO_CASE_B,
  DEMO_CASE_C,
];

export function getDemoCaseByPreset(preset: "A" | "B" | "C"): DemoCaseDefinition {
  const match = DEMO_CASES.find((demoCase) => demoCase.preset === preset);

  if (!match) {
    throw new Error(`Unknown demo preset: ${preset}`);
  }

  return match;
}

export function getDemoCaseById(id: string): DemoCaseDefinition | null {
  return DEMO_CASES.find((demoCase) => demoCase.id === id) ?? null;
}

export function createDischargeRecordFromDemoCase(
  demoCase: DemoCaseDefinition,
  timestamp = new Date().toISOString()
) {
  return {
    id: demoCase.id,
    casePreset: demoCase.preset,
    origin: demoCase.origin,
    destination: demoCase.destination,
    journey: demoCase.journey,
    profile: demoCase.profile,
    assessmentStatus: "not_assessed" as const,
    assessment: null,
    environmentalFailure: null,
    environmentalRefreshFailure: null,
    reassessmentRequired: false,
    assessedAt: null,
    assessmentInputFingerprint: null,
    pendingAssessment: null,
    environmentalRefresh: null,
    actions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const DEFAULT_TIME_ZONE = ARIZONA_TIME_ZONE;
