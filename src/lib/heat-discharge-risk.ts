/**
 * Prototype workflow-prioritization weights for HeatSafe Discharge.
 *
 * These values are NOT probabilities, validated clinical thresholds, or
 * evidence-based risk scores. They exist to rank discharge-coordination
 * follow-up effort in hackathon/demo workflows and can be tuned by operators.
 */
export const WEIGHTS = {
  environmental: {
    meanTemperatureModerate: 8, // mean >= 28 °C
    meanTemperatureHigh: 15, // mean >= 32 °C
    maximumTemperatureModerate: 8, // max >= 35 °C
    maximumTemperatureHigh: 15, // max >= 38 °C
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

/**
 * Score cut-offs that map the capped 0–100 score to coordinator priority tiers.
 * These tiers are workflow labels, not clinical acuity classifications.
 */
export const PRIORITY_THRESHOLDS = {
  enhanced: 25,
  high: 50,
  urgent: 75,
} as const;

/** Environmental heat thresholds used for scoring and conditional action rules. */
export const HEAT_THRESHOLDS = {
  meanModerate: 28,
  meanHigh: 32,
  maxModerate: 35,
  maxHigh: 38,
} as const;

export const DISCLAIMER =
  "HeatSafe Discharge is prototype decision support only. It is not a validated clinical score, diagnostic tool, or substitute for clinician judgment. The treating clinician retains full responsibility for discharge, medication, hydration, and safety decisions.";

export type HeatDischargePriority = "routine" | "enhanced" | "high" | "urgent";

export type EnvironmentalInput = {
  meanTemperature: number;
  maximumTemperature: number;
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
  environmental: EnvironmentalInput;
  patient: PatientFactorsInput;
  medications: MedicationRiskInput;
  homeSocial: HomeSocialInput;
};

export type HeatDischargeRiskResult = {
  score: number;
  priority: HeatDischargePriority;
  riskFactors: CategorizedRiskFactor[];
  recommendedActions: DischargeAction[];
  disclaimer: string;
};

export type RiskFactorCategory = "environmental" | "clinical" | "homeSupport";

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
  action: string;
  suggestedOwner: SuggestedOwner;
};

type ScoredFactor = {
  points: number;
  explanation: string;
  category: RiskFactorCategory;
};

type RecommendedAction = {
  id: string;
  action: string;
  suggestedOwner: SuggestedOwner;
};

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

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function isHighHeat(environmental: EnvironmentalInput): boolean {
  return (
    environmental.meanTemperature >= HEAT_THRESHOLDS.meanHigh ||
    environmental.maximumTemperature >= HEAT_THRESHOLDS.maxHigh
  );
}

function scoreEnvironmental(environmental: EnvironmentalInput): ScoredFactor[] {
  const factors: ScoredFactor[] = [];

  if (environmental.meanTemperature >= HEAT_THRESHOLDS.meanHigh) {
    factors.push({
      points: WEIGHTS.environmental.meanTemperatureHigh,
      category: "environmental",
      explanation: `Mean ambient temperature is ${environmental.meanTemperature} °C (high heat exposure).`,
    });
  } else if (environmental.meanTemperature >= HEAT_THRESHOLDS.meanModerate) {
    factors.push({
      points: WEIGHTS.environmental.meanTemperatureModerate,
      category: "environmental",
      explanation: `Mean ambient temperature is ${environmental.meanTemperature} °C (moderate heat exposure).`,
    });
  }

  if (environmental.maximumTemperature >= HEAT_THRESHOLDS.maxHigh) {
    factors.push({
      points: WEIGHTS.environmental.maximumTemperatureHigh,
      category: "environmental",
      explanation: `Maximum ambient temperature is ${environmental.maximumTemperature} °C (high peak heat).`,
    });
  } else if (environmental.maximumTemperature >= HEAT_THRESHOLDS.maxModerate) {
    factors.push({
      points: WEIGHTS.environmental.maximumTemperatureModerate,
      category: "environmental",
      explanation: `Maximum ambient temperature is ${environmental.maximumTemperature} °C (moderate peak heat).`,
    });
  }

  return factors;
}

function scorePatient(patient: PatientFactorsInput): ScoredFactor[] {
  const factors: ScoredFactor[] = [];

  if (patient.age >= 75) {
    factors.push({
      points: WEIGHTS.patient.age75Plus,
      category: "clinical",
      explanation: `Patient age is ${patient.age} (advanced age increases heat vulnerability).`,
    });
  } else if (patient.age >= 65) {
    factors.push({
      points: WEIGHTS.patient.age65to74,
      category: "clinical",
      explanation: `Patient age is ${patient.age} (older adult heat vulnerability).`,
    });
  }

  if (patient.cardiovascularDisease) {
    factors.push({
      points: WEIGHTS.patient.cardiovascularDisease,
      category: "clinical",
      explanation:
        "Cardiovascular disease may reduce tolerance to heat stress during early recovery.",
    });
  }

  if (patient.heartFailure) {
    factors.push({
      points: WEIGHTS.patient.heartFailure,
      category: "clinical",
      explanation:
        "Heart failure increases risk during heat events because fluid balance and exertion tolerance are more sensitive.",
    });
  }

  if (patient.kidneyDisease) {
    factors.push({
      points: WEIGHTS.patient.kidneyDisease,
      category: "clinical",
      explanation:
        "Kidney disease increases vulnerability to dehydration and electrolyte shifts during heat exposure.",
    });
  }

  if (patient.respiratoryDisease) {
    factors.push({
      points: WEIGHTS.patient.respiratoryDisease,
      category: "clinical",
      explanation:
        "Respiratory disease may worsen with heat and poor air quality during recovery at home.",
    });
  }

  if (patient.diabetes) {
    factors.push({
      points: WEIGHTS.patient.diabetes,
      category: "clinical",
      explanation:
        "Diabetes can affect thermoregulation and hydration awareness during heat exposure.",
    });
  }

  if (patient.cognitiveImpairment) {
    factors.push({
      points: WEIGHTS.patient.cognitiveImpairment,
      category: "clinical",
      explanation:
        "Cognitive impairment may reduce the ability to recognize or respond to heat-related symptoms.",
    });
  }

  if (patient.limitedMobility) {
    factors.push({
      points: WEIGHTS.patient.limitedMobility,
      category: "clinical",
      explanation:
        "Limited mobility may restrict access to cooler spaces, fluids, or help during a heat event.",
    });
  }

  return factors;
}

function scoreMedications(medications: MedicationRiskInput): ScoredFactor[] {
  const factors: ScoredFactor[] = [];

  for (const [key, label] of Object.entries(MEDICATION_LABELS) as Array<
    [keyof MedicationRiskInput, string]
  >) {
    if (medications[key]) {
      factors.push({
        points: WEIGHTS.medication[key],
        category: "clinical",
        explanation: `Active ${label} therapy may require heat-aware medication review.`,
      });
    }
  }

  return factors;
}

function scoreHomeSocial(homeSocial: HomeSocialInput): ScoredFactor[] {
  const factors: ScoredFactor[] = [];

  if (!homeSocial.workingAirConditioning) {
    factors.push({
      points: WEIGHTS.homeSocial.noWorkingAirConditioning,
      category: "homeSupport",
      explanation: "No working air conditioning at the planned discharge destination.",
    });
  }

  if (homeSocial.livesAlone) {
    factors.push({
      points: WEIGHTS.homeSocial.livesAlone,
      category: "homeSupport",
      explanation: "Patient lives alone without continuous onsite support after discharge.",
    });
  }

  if (!homeSocial.reliableTransport) {
    factors.push({
      points: WEIGHTS.homeSocial.noReliableTransport,
      category: "homeSupport",
      explanation: "Reliable transport is not available for follow-up or cooling-centre access.",
    });
  }

  if (!homeSocial.caregiverCheckInAvailable) {
    factors.push({
      points: WEIGHTS.homeSocial.noCaregiverCheckIn,
      category: "homeSupport",
      explanation: "No caregiver check-in is available during the early post-discharge period.",
    });
  }

  if (homeSocial.powerDependentMedicalEquipment) {
    factors.push({
      points: WEIGHTS.homeSocial.powerDependentMedicalEquipment,
      category: "homeSupport",
      explanation:
        "Patient relies on power-dependent medical equipment that is vulnerable during outages.",
    });
  }

  return factors;
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

  if (homeSocial.powerDependentMedicalEquipment) {
    actions.push({
      id: "power-outage-contingency",
      suggestedOwner: "discharge coordinator",
      action:
        "Develop a power-outage contingency plan including backup power or relocation options for medical equipment.",
    });
  }

  if (
    isHighHeat(environmental) &&
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

  return actions
    .filter(({ id, action }) => {
      if (seen.has(id)) {
        return false;
      }

      seen.add(id);
      return Boolean(action);
    })
    .map(({ action, suggestedOwner }) => ({ action, suggestedOwner }));
}

/**
 * Evaluates heat-related discharge coordination priority from structured,
 * non-identifying workflow inputs. No patient names, MRNs, or addresses are
 * accepted or stored by this function.
 */
export function evaluateHeatDischargeRisk(
  input: HeatDischargeRiskInput
): HeatDischargeRiskResult {
  const scoredFactors = [
    ...scoreEnvironmental(input.environmental),
    ...scorePatient(input.patient),
    ...scoreMedications(input.medications),
    ...scoreHomeSocial(input.homeSocial),
  ];

  const rawScore = scoredFactors.reduce((total, factor) => total + factor.points, 0);
  const score = clampScore(rawScore);
  const priority = derivePriority(score);
  const riskFactors = scoredFactors.map(({ category, explanation }) => ({
    category,
    explanation,
  }));
  const recommendedActions = buildRecommendedActions(input, priority);

  return {
    score,
    priority,
    riskFactors,
    recommendedActions,
    disclaimer: DISCLAIMER,
  };
}
