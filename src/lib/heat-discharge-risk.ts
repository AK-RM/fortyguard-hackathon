/**
 * Prototype workflow-prioritization weights for HeatSafe Discharge.
 *
 * These values are NOT probabilities, validated clinical thresholds, or
 * evidence-based risk scores. They exist to rank discharge-coordination
 * follow-up effort and can be tuned under clinical governance.
 */
export const WEIGHTS = {
  environmental: {
    meanTemperatureModerate: 8,
    meanTemperatureHigh: 15,
    maximumTemperatureModerate: 8,
    maximumTemperatureHigh: 15,
    transitionBase: 14,
    transitionMax: 18,
  },
  patient: {
    age65to74: 5,
    age75Plus: 10,
    cardiovascularDisease: 8,
    heartFailure: 12,
    kidneyDisease: 12,
    respiratoryDisease: 8,
    diabetes: 6,
    cognitiveImpairment: 8,
    limitedMobility: 10,
  },
  medication: {
    diuretic: 8,
    aceArbArni: 6,
    betaBlocker: 6,
    anticholinergic: 8,
    psychotropic: 6,
    lithium: 10,
    nsaid: 6,
  },
  homeSocial: {
    noWorkingAirConditioning: 15,
    livesAlone: 10,
    noReliableTransport: 10,
    noCaregiverCheckIn: 10,
    powerDependentMedicalEquipment: 12,
  },
} as const;

export const PRIORITY_THRESHOLDS = {
  enhanced: 25,
  high: 50,
  urgent: 75,
} as const;

export const HEAT_THRESHOLDS = {
  meanModerate: 28,
  meanHigh: 32,
  maxModerate: 35,
  maxHigh: 38,
} as const;

export const SCORE_EXPLAINER_DISCLAIMER =
  "Transparent workflow-prioritization heuristic — not predicted clinical outcome risk.";

export const DISCLAIMER =
  "HeatSafe Discharge is a hackathon deployment. The workflow prioritization score is not clinically validated, is not an outcome probability, and does not replace clinician judgment. The treating clinician retains full responsibility for discharge, medication, hydration, and safety decisions.";

export type HeatDischargePriority = "routine" | "enhanced" | "high" | "urgent";

export type RiskFactorCategory = "environmental" | "clinical" | "homeSupport";

export type EnvironmentalInput = {
  meanTemperature: number;
  maximumTemperature: number;
};

export type DestinationEnvironmentalInput = EnvironmentalInput;

export type TransitionEnvironmentalInput = {
  points: number;
  label: string;
  explanation: string;
};

export type CombinedEnvironmentalInput = {
  destination: DestinationEnvironmentalInput;
  transition: TransitionEnvironmentalInput;
};

export type PatientFactorsInput = {
  age: number;
  cardiovascularDisease: boolean;
  heartFailure: boolean;
  kidneyDisease: boolean;
  respiratoryDisease: boolean;
  diabetes: boolean;
  cognitiveImpairment: boolean;
  limitedMobility: boolean;
};

export type MedicationRiskInput = {
  diuretic: boolean;
  aceArbArni: boolean;
  betaBlocker: boolean;
  anticholinergic: boolean;
  psychotropic: boolean;
  lithium: boolean;
  nsaid: boolean;
};

export type HomeSocialInput = {
  workingAirConditioning: boolean;
  livesAlone: boolean;
  reliableTransport: boolean;
  caregiverCheckInAvailable: boolean;
  powerDependentMedicalEquipment: boolean;
};

export type HeatDischargeRiskInput = {
  environmental: CombinedEnvironmentalInput;
  patient: PatientFactorsInput;
  medications: MedicationRiskInput;
  homeSocial: HomeSocialInput;
};

export type ScoreContribution = {
  id: string;
  category: RiskFactorCategory;
  label: string;
  explanation: string;
  points: number;
};

export type CategorizedRiskFactor = {
  category: RiskFactorCategory;
  explanation: string;
};

export type SuggestedOwner =
  | "treating clinician"
  | "pharmacist"
  | "discharge coordinator"
  | "social worker"
  | "community-care team";

export type DischargeAction = {
  id: string;
  action: string;
  suggestedOwner: SuggestedOwner;
};

export type HeatDischargeRiskResult = {
  score: number;
  rawScore: number;
  priority: HeatDischargePriority;
  contributions: ScoreContribution[];
  riskFactors: CategorizedRiskFactor[];
  recommendedActions: DischargeAction[];
  disclaimer: string;
};

type RecommendedAction = DischargeAction;

const MEDICATION_LABELS: Record<keyof MedicationRiskInput, string> = {
  diuretic: "diuretic",
  aceArbArni: "ACE inhibitor, ARB, or ARNI",
  betaBlocker: "beta-blocker",
  anticholinergic: "anticholinergic",
  psychotropic: "psychotropic",
  lithium: "lithium",
  nsaid: "NSAID",
};

const BASELINE_ACTIONS: RecommendedAction[] = [
  {
    id: "patient-education",
    suggestedOwner: "community-care team",
    action:
      "Provide patient and caregiver education on heat-related warning symptoms (for example, dizziness, confusion, reduced urine output, chest pain, or breathing difficulty) and when to seek emergency care. This is educational guidance only—not a diagnosis.",
  },
];

export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function isHighHeat(environmental: DestinationEnvironmentalInput): boolean {
  return (
    environmental.meanTemperature >= HEAT_THRESHOLDS.meanHigh ||
    environmental.maximumTemperature >= HEAT_THRESHOLDS.maxHigh
  );
}

function scoreDestinationHeat(
  destination: DestinationEnvironmentalInput
): ScoreContribution[] {
  const contributions: ScoreContribution[] = [];

  if (destination.meanTemperature >= HEAT_THRESHOLDS.meanHigh) {
    contributions.push({
      id: "destination-mean-high",
      category: "environmental",
      label: "High mean destination heat",
      points: WEIGHTS.environmental.meanTemperatureHigh,
      explanation: `Mean destination temperature is ${destination.meanTemperature} °C (high heat exposure).`,
    });
  } else if (destination.meanTemperature >= HEAT_THRESHOLDS.meanModerate) {
    contributions.push({
      id: "destination-mean-moderate",
      category: "environmental",
      label: "Moderate mean destination heat",
      points: WEIGHTS.environmental.meanTemperatureModerate,
      explanation: `Mean destination temperature is ${destination.meanTemperature} °C (moderate heat exposure).`,
    });
  }

  if (destination.maximumTemperature >= HEAT_THRESHOLDS.maxHigh) {
    contributions.push({
      id: "destination-max-high",
      category: "environmental",
      label: "High peak destination heat",
      points: WEIGHTS.environmental.maximumTemperatureHigh,
      explanation: `Maximum destination temperature is ${destination.maximumTemperature} °C (high peak heat).`,
    });
  } else if (destination.maximumTemperature >= HEAT_THRESHOLDS.maxModerate) {
    contributions.push({
      id: "destination-max-moderate",
      category: "environmental",
      label: "Moderate peak destination heat",
      points: WEIGHTS.environmental.maximumTemperatureModerate,
      explanation: `Maximum destination temperature is ${destination.maximumTemperature} °C (moderate peak heat).`,
    });
  }

  return contributions;
}

function scoreTransitionHeat(transition: TransitionEnvironmentalInput): ScoreContribution[] {
  if (transition.points <= 0) {
    return [];
  }

  return [
    {
      id: "transition-exposure",
      category: "environmental",
      label: transition.label,
      points: transition.points,
      explanation: transition.explanation,
    },
  ];
}

function scorePatient(patient: PatientFactorsInput): ScoreContribution[] {
  const contributions: ScoreContribution[] = [];

  if (patient.age >= 75) {
    contributions.push({
      id: "age-75-plus",
      category: "clinical",
      label: "Age ≥75",
      points: WEIGHTS.patient.age75Plus,
      explanation: `Patient age is ${patient.age} (advanced age increases heat vulnerability).`,
    });
  } else if (patient.age >= 65) {
    contributions.push({
      id: "age-65-74",
      category: "clinical",
      label: "Age 65–74",
      points: WEIGHTS.patient.age65to74,
      explanation: `Patient age is ${patient.age} (older adult heat vulnerability).`,
    });
  }

  if (patient.cardiovascularDisease) {
    contributions.push({
      id: "cardiovascular-disease",
      category: "clinical",
      label: "Cardiovascular disease",
      points: WEIGHTS.patient.cardiovascularDisease,
      explanation:
        "Cardiovascular disease may reduce tolerance to heat stress during early recovery.",
    });
  }

  if (patient.heartFailure) {
    contributions.push({
      id: "heart-failure",
      category: "clinical",
      label: "Heart failure",
      points: WEIGHTS.patient.heartFailure,
      explanation:
        "Heart failure increases risk during heat events because fluid balance and exertion tolerance are more sensitive.",
    });
  }

  if (patient.kidneyDisease) {
    contributions.push({
      id: "kidney-disease",
      category: "clinical",
      label: "Kidney disease",
      points: WEIGHTS.patient.kidneyDisease,
      explanation:
        "Kidney disease increases vulnerability to dehydration and electrolyte shifts during heat exposure.",
    });
  }

  if (patient.respiratoryDisease) {
    contributions.push({
      id: "respiratory-disease",
      category: "clinical",
      label: "Respiratory disease",
      points: WEIGHTS.patient.respiratoryDisease,
      explanation:
        "Respiratory disease may worsen with heat and poor air quality during recovery at home.",
    });
  }

  if (patient.diabetes) {
    contributions.push({
      id: "diabetes",
      category: "clinical",
      label: "Diabetes",
      points: WEIGHTS.patient.diabetes,
      explanation:
        "Diabetes can affect thermoregulation and hydration awareness during heat exposure.",
    });
  }

  if (patient.cognitiveImpairment) {
    contributions.push({
      id: "cognitive-impairment",
      category: "clinical",
      label: "Cognitive impairment",
      points: WEIGHTS.patient.cognitiveImpairment,
      explanation:
        "Cognitive impairment may reduce the ability to recognize or respond to heat-related symptoms.",
    });
  }

  if (patient.limitedMobility) {
    contributions.push({
      id: "limited-mobility",
      category: "clinical",
      label: "Limited mobility",
      points: WEIGHTS.patient.limitedMobility,
      explanation:
        "Limited mobility may restrict access to cooler spaces, fluids, or help during a heat event.",
    });
  }

  return contributions;
}

function scoreMedications(medications: MedicationRiskInput): ScoreContribution[] {
  const contributions: ScoreContribution[] = [];

  for (const [key, label] of Object.entries(MEDICATION_LABELS) as Array<
    [keyof MedicationRiskInput, string]
  >) {
    if (medications[key]) {
      contributions.push({
        id: `medication-${key}`,
        category: "clinical",
        label: label.charAt(0).toUpperCase() + label.slice(1),
        points: WEIGHTS.medication[key],
        explanation: `Active ${label} therapy may require heat-aware medication review.`,
      });
    }
  }

  return contributions;
}

function scoreHomeSocial(homeSocial: HomeSocialInput): ScoreContribution[] {
  const contributions: ScoreContribution[] = [];

  if (!homeSocial.workingAirConditioning) {
    contributions.push({
      id: "no-working-ac",
      category: "homeSupport",
      label: "No working AC",
      points: WEIGHTS.homeSocial.noWorkingAirConditioning,
      explanation: "No working air conditioning at the planned discharge destination.",
    });
  }

  if (homeSocial.livesAlone) {
    contributions.push({
      id: "lives-alone",
      category: "homeSupport",
      label: "Lives alone",
      points: WEIGHTS.homeSocial.livesAlone,
      explanation: "Patient lives alone without continuous onsite support after discharge.",
    });
  }

  if (!homeSocial.reliableTransport) {
    contributions.push({
      id: "no-reliable-transport",
      category: "homeSupport",
      label: "No reliable transport",
      points: WEIGHTS.homeSocial.noReliableTransport,
      explanation: "Reliable transport is not available for follow-up or cooling-centre access.",
    });
  }

  if (!homeSocial.caregiverCheckInAvailable) {
    contributions.push({
      id: "no-caregiver-check-in",
      category: "homeSupport",
      label: "No caregiver check-in",
      points: WEIGHTS.homeSocial.noCaregiverCheckIn,
      explanation: "No caregiver check-in is available during the early post-discharge period.",
    });
  }

  if (homeSocial.powerDependentMedicalEquipment) {
    contributions.push({
      id: "power-dependent-equipment",
      category: "homeSupport",
      label: "Power-dependent equipment",
      points: WEIGHTS.homeSocial.powerDependentMedicalEquipment,
      explanation:
        "Patient relies on power-dependent medical equipment that is vulnerable during outages.",
    });
  }

  return contributions;
}

function derivePriority(score: number): HeatDischargePriority {
  if (score >= PRIORITY_THRESHOLDS.urgent) {
    return "urgent";
  }

  if (score >= PRIORITY_THRESHOLDS.high) {
    return "high";
  }

  if (score >= PRIORITY_THRESHOLDS.enhanced) {
    return "enhanced";
  }

  return "routine";
}

function getActiveMedicationLabels(medications: MedicationRiskInput): string[] {
  return (Object.keys(MEDICATION_LABELS) as Array<keyof MedicationRiskInput>)
    .filter((key) => medications[key])
    .map((key) => MEDICATION_LABELS[key]);
}

function buildRecommendedActions(
  input: HeatDischargeRiskInput,
  priority: HeatDischargePriority
): DischargeAction[] {
  const actions: RecommendedAction[] = [...BASELINE_ACTIONS];
  const { environmental, patient, medications, homeSocial } = input;

  if (!homeSocial.workingAirConditioning) {
    actions.push({
      id: "cooling-resource-assessment",
      suggestedOwner: "social worker",
      action:
        "Arrange social-work or cooling-resource assessment to verify home cooling options before discharge.",
    });
  }

  const needsFollowUp =
    homeSocial.livesAlone ||
    !homeSocial.caregiverCheckInAvailable ||
    priority === "high" ||
    priority === "urgent";

  if (needsFollowUp) {
    actions.push({
      id: "follow-up-24-48",
      suggestedOwner: "discharge coordinator",
      action:
        "Schedule discharge coordinator follow-up within 24–48 hours (phone or home visit) to verify cooling access and post-discharge support.",
    });
  }

  const activeMedications = getActiveMedicationLabels(medications);

  if (activeMedications.length > 0) {
    actions.push({
      id: "medication-review",
      suggestedOwner: "pharmacist",
      action: `Flag for clinician or pharmacist medication review due to heat-sensitive medication classes (${activeMedications.join(", ")}). Never stop or change medications automatically based on this tool.`,
    });
  }

  if (patient.limitedMobility || !homeSocial.reliableTransport) {
    actions.push({
      id: "transport-cooling-planning",
      suggestedOwner: "community-care team",
      action:
        "Plan transport and cooling-centre access options in case home cooling fails during a heat event.",
    });
  }

  if (environmental.transition.points >= 8) {
    actions.push({
      id: "transition-heat-planning",
      suggestedOwner: "discharge coordinator",
      action:
        "Review hospital-to-home transition plan for heat exposure during transport (cool vehicle, timing, hydration access, and contingency if travel is delayed).",
    });
  }

  if (homeSocial.powerDependentMedicalEquipment) {
    actions.push({
      id: "power-outage-contingency",
      suggestedOwner: "discharge coordinator",
      action:
        "Develop a power-outage contingency plan including backup power or relocation options for medical equipment.",
    });
  }

  if (
    isHighHeat(environmental.destination) &&
    (patient.heartFailure || patient.kidneyDisease)
  ) {
    actions.push({
      id: "fluid-plan-review",
      suggestedOwner: "treating clinician",
      action:
        "Review the patient's individualized fluid plan with the treating clinician. Do not provide generic hydration instructions or imply that fluid intake should automatically be increased.",
    });
  }

  const seen = new Set<string>();

  return actions.filter(({ id, action }) => {
    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return Boolean(action);
  });
}

export function evaluateHeatDischargeRisk(
  input: HeatDischargeRiskInput
): HeatDischargeRiskResult {
  const contributions = [
    ...scoreDestinationHeat(input.environmental.destination),
    ...scoreTransitionHeat(input.environmental.transition),
    ...scorePatient(input.patient),
    ...scoreMedications(input.medications),
    ...scoreHomeSocial(input.homeSocial),
  ];

  const rawScore = contributions.reduce((total, factor) => total + factor.points, 0);
  const score = clampScore(rawScore);
  const priority = derivePriority(score);
  const riskFactors = contributions.map(({ category, explanation }) => ({
    category,
    explanation,
  }));
  const recommendedActions = buildRecommendedActions(input, priority);

  return {
    score,
    rawScore,
    priority,
    contributions,
    riskFactors,
    recommendedActions,
    disclaimer: DISCLAIMER,
  };
}

/** Backward-compatible helper for tests using flat destination environmental input. */
export function createCombinedEnvironmentalInput(
  destination: DestinationEnvironmentalInput,
  transition: TransitionEnvironmentalInput
): CombinedEnvironmentalInput {
  return { destination, transition };
}

export function groupContributionsByCategory(contributions: ScoreContribution[]) {
  const categories: RiskFactorCategory[] = ["environmental", "clinical", "homeSupport"];

  return categories
    .map((category) => ({
      category,
      contributions: contributions.filter((item) => item.category === category),
    }))
    .filter((section) => section.contributions.length > 0);
}
