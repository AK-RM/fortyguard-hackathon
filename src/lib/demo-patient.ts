import type { HeatDischargeRiskInput } from "./heat-discharge-risk";

/**
 * Fixed demo discharge scenario for the hackathon vertical slice.
 * No patient names, MRNs, addresses, or other identifiers are included.
 */
export const DEMO_DISCHARGE_SCENARIO: Omit<
  HeatDischargeRiskInput,
  "environmental"
> = {
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
