import { buildCompletedHeatRiskAssessment } from "@/lib/assessment-orchestration";
import {
  DEMO_CASE_A,
  DEMO_CASE_B,
  DEMO_CASE_C,
} from "@/lib/demo-cases";
import type { DemoCaseDefinition } from "@/types/discharge-workflow";
import type { HeatRiskAssessmentRequest } from "@/types/heat-risk-api";
import type { HeatDischargePriority } from "@/lib/heat-discharge-risk";
import type { EnvironmentalResult } from "@/lib/environmental-result";
import type { EnvironmentalQuery } from "@/lib/environmental-query";
import {
  VERIFIED_CENTRAL_PHOENIX_EARLY_QUERY,
  VERIFIED_CENTRAL_PHOENIX_EARLY_RESULT,
  VERIFIED_CENTRAL_PHOENIX_QUERY,
  VERIFIED_CENTRAL_PHOENIX_RESULT,
  type VerifiedEnvironmentalScenario,
  isVerifiedEnvironmentalResult,
} from "@/lib/verified-environmental-seed";

export type MatchedPatientComparisonScenario = {
  id: string;
  label: string;
  arrivalLabel: string;
  destinationLabel: string;
  queryWindowLabel: string;
  activityId: string;
  provenance: EnvironmentalResult["provenance"];
  provenanceNote: string | null;
  meanTemperatureC: number;
  maximumTemperatureC: number;
  environmentalPoints: number;
  transitionPoints: number;
  totalScore: number;
  rawScore: number;
  priority: HeatDischargePriority;
  actionIds: string[];
  actionTitles: string[];
};

export type MatchedPatientEnvironmentalComparison = {
  demoCaseId: string;
  profileLabel: string;
  profileDescription: string;
  heldConstantSummary: string[];
  scenarioA: MatchedPatientComparisonScenario;
  scenarioB: MatchedPatientComparisonScenario;
  deltas: {
    environmentalPoints: number;
    totalScore: number;
    rawScore: number;
    priorityChanged: boolean;
    actionsAdded: string[];
    actionsRemoved: string[];
  };
  workflowEffectSummary: string;
  isReady: true;
};

const COMPARISON_DEMO_CASES = [DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C] as const;

const HOT_ARRIVAL_SCENARIO: VerifiedEnvironmentalScenario = {
  id: "central-phoenix-1400",
  label: "Hotter arrival · 14:00–15:00 local",
  query: VERIFIED_CENTRAL_PHOENIX_QUERY,
  result: VERIFIED_CENTRAL_PHOENIX_RESULT,
};

const COOL_ARRIVAL_SCENARIO: VerifiedEnvironmentalScenario = {
  id: "central-phoenix-0600",
  label: "Cooler arrival · 06:00–07:00 local",
  query: VERIFIED_CENTRAL_PHOENIX_EARLY_QUERY,
  result: VERIFIED_CENTRAL_PHOENIX_EARLY_RESULT,
};

const HELD_CONSTANT_SUMMARY = [
  "Same clinical vulnerability profile",
  "Same medications",
  "Same home and social support conditions",
  "Same Central Phoenix destination",
  "Same transport mode and journey duration",
  "Only the expected arrival window changes",
] as const;

export function buildMatchedPatientRequestFromDemoCase(
  demoCase: DemoCaseDefinition,
  journeyOverride?: Partial<HeatRiskAssessmentRequest["journey"]>
): HeatRiskAssessmentRequest {
  return {
    origin: demoCase.origin,
    destination: demoCase.destination,
    journey: {
      ...demoCase.journey,
      ...journeyOverride,
    },
    patient: demoCase.profile.patient,
    medications: demoCase.profile.medications,
    homeSocial: demoCase.profile.homeSocial,
  };
}

function sumEnvironmentalPoints(
  contributions: Array<{ category: string; points: number }>
): number {
  return contributions
    .filter((item) => item.category === "environmental")
    .reduce((total, item) => total + item.points, 0);
}

function buildScenarioAssessment(
  request: HeatRiskAssessmentRequest,
  environmentalQuery: EnvironmentalQuery,
  environmentalResult: EnvironmentalResult,
  scenario: VerifiedEnvironmentalScenario,
  arrivalLabel: string
): MatchedPatientComparisonScenario {
  const assessment = buildCompletedHeatRiskAssessment({
    parsed: request,
    environmentalQuery,
    environmentalResult,
    assessedAt: "2026-08-18T14:00:00.000Z",
  });

  const environmentalPoints = sumEnvironmentalPoints(assessment.scoreContributions);
  const transitionPoints =
    assessment.scoreContributions.find((item) => item.id === "transition-exposure")
      ?.points ?? 0;

  return {
    id: scenario.id,
    label: scenario.label,
    arrivalLabel,
    destinationLabel: assessment.destinationEnvironmental?.label ?? scenario.label,
    queryWindowLabel:
      assessment.destinationEnvironmental?.fortyGuardQueryWindowLocal ??
      `${environmentalQuery.startDate} ${environmentalQuery.startTime} local`,
    activityId: environmentalResult.activityId,
    provenance: environmentalResult.provenance,
    provenanceNote: environmentalResult.provenanceNote ?? null,
    meanTemperatureC: environmentalResult.meanTemperatureC,
    maximumTemperatureC: environmentalResult.maximumTemperatureC,
    environmentalPoints,
    transitionPoints,
    totalScore: assessment.totalRiskScore ?? 0,
    rawScore: assessment.rawRiskScore ?? 0,
    priority: assessment.riskLevel ?? "routine",
    actionIds: assessment.recommendedDischargeActions.map((action) => action.id),
    actionTitles: assessment.recommendedDischargeActions.map((action) => action.action),
  };
}

function scoreCounterfactualStrength(
  comparison: MatchedPatientEnvironmentalComparison
): number {
  let strength = 0;

  if (comparison.deltas.priorityChanged) {
    strength += 100;
  }

  if (
    comparison.deltas.actionsAdded.length > 0 ||
    comparison.deltas.actionsRemoved.length > 0
  ) {
    strength += 50;
  }

  strength += Math.abs(comparison.deltas.rawScore);

  return strength;
}

function buildWorkflowEffectSummary(
  comparison: MatchedPatientEnvironmentalComparison
): string {
  if (
    comparison.deltas.priorityChanged &&
    (comparison.deltas.actionsAdded.length > 0 ||
      comparison.deltas.actionsRemoved.length > 0)
  ) {
    return "The patient is identical in both scenarios. Only the expected arrival window changes. FortyGuard identifies a substantially different environmental exposure, which changes HeatSafe's workflow priority and the interventions surfaced to the discharge team.";
  }

  if (comparison.deltas.priorityChanged) {
    return "The patient is identical in both scenarios. Only the expected arrival window changes. FortyGuard identifies a substantially different environmental exposure, which changes HeatSafe's workflow priority for the same discharge profile.";
  }

  if (
    comparison.deltas.actionsAdded.length > 0 ||
    comparison.deltas.actionsRemoved.length > 0
  ) {
    return "The patient is identical in both scenarios. Only the expected arrival window changes. FortyGuard identifies a substantially different environmental exposure, which changes the interventions surfaced to the discharge team.";
  }

  return "The patient is identical in both scenarios. Only the expected arrival window changes. FortyGuard identifies a different environmental exposure and changes the environmental contribution to HeatSafe's workflow score.";
}

export function buildMatchedPatientComparisonForDemoCase(
  demoCase: DemoCaseDefinition
): MatchedPatientEnvironmentalComparison {
  const hotRequest = buildMatchedPatientRequestFromDemoCase(demoCase);
  const coolRequest = buildMatchedPatientRequestFromDemoCase(demoCase, {
    time: "06:00",
  });

  const scenarioA = buildScenarioAssessment(
    hotRequest,
    HOT_ARRIVAL_SCENARIO.query,
    HOT_ARRIVAL_SCENARIO.result,
    HOT_ARRIVAL_SCENARIO,
    "Hotter arrival"
  );

  const scenarioB = buildScenarioAssessment(
    coolRequest,
    COOL_ARRIVAL_SCENARIO.query,
    COOL_ARRIVAL_SCENARIO.result,
    COOL_ARRIVAL_SCENARIO,
    "Cooler arrival"
  );

  const actionsAdded = scenarioB.actionIds.filter(
    (id) => !scenarioA.actionIds.includes(id)
  );
  const actionsRemoved = scenarioA.actionIds.filter(
    (id) => !scenarioB.actionIds.includes(id)
  );

  const comparison: MatchedPatientEnvironmentalComparison = {
    demoCaseId: demoCase.id,
    profileLabel: `${demoCase.label} (${demoCase.id})`,
    profileDescription: `${demoCase.vulnerabilityLabel}. Same patient profile, destination, and transport configuration — only the FortyGuard arrival-hour query window changes.`,
    heldConstantSummary: [...HELD_CONSTANT_SUMMARY],
    scenarioA,
    scenarioB,
    deltas: {
      environmentalPoints:
        scenarioB.environmentalPoints - scenarioA.environmentalPoints,
      totalScore: scenarioB.totalScore - scenarioA.totalScore,
      rawScore: scenarioB.rawScore - scenarioA.rawScore,
      priorityChanged: scenarioA.priority !== scenarioB.priority,
      actionsAdded,
      actionsRemoved,
    },
    workflowEffectSummary: "",
    isReady: true,
  };

  comparison.workflowEffectSummary = buildWorkflowEffectSummary(comparison);

  return comparison;
}

export function selectBestCounterfactualDemoCase(): DemoCaseDefinition {
  const ranked = COMPARISON_DEMO_CASES.map((demoCase) => ({
    demoCase,
    comparison: buildMatchedPatientComparisonForDemoCase(demoCase),
  })).sort(
    (left, right) =>
      scoreCounterfactualStrength(right.comparison) -
      scoreCounterfactualStrength(left.comparison)
  );

  return ranked[0]?.demoCase ?? DEMO_CASE_A;
}

export function buildMatchedPatientEnvironmentalComparison(): MatchedPatientEnvironmentalComparison {
  return buildMatchedPatientComparisonForDemoCase(selectBestCounterfactualDemoCase());
}

export function assertVerifiedComparisonInputs(
  result: EnvironmentalResult
): boolean {
  return isVerifiedEnvironmentalResult(result);
}

export function getEnvironmentalComparisonReadiness(): {
  ready: boolean;
  verifiedScenarioCount: number;
  message: string;
} {
  const ready =
    isVerifiedEnvironmentalResult(VERIFIED_CENTRAL_PHOENIX_RESULT) &&
    isVerifiedEnvironmentalResult(VERIFIED_CENTRAL_PHOENIX_EARLY_RESULT);

  return {
    ready,
    verifiedScenarioCount: ready ? 2 : 1,
    message: ready
      ? "Two verified FortyGuard snapshots are available for matched-patient comparison."
      : "A second verified FortyGuard snapshot is required before enabling the final comparison.",
  };
}

export type VerifiedSnapshotVerification = {
  activityId: string;
  verified: boolean;
  destination: string;
  date: string;
  localQueryHour: string;
  meanTemperatureC: number;
  maximumTemperatureC: number;
  cellCount: number;
  provenance: EnvironmentalResult["provenance"];
};

export function verifyComparisonEnvironmentalSnapshots(): {
  hot: VerifiedSnapshotVerification;
  cool: VerifiedSnapshotVerification;
  bothVerified: boolean;
} {
  const hot = HOT_ARRIVAL_SCENARIO.result;
  const cool = COOL_ARRIVAL_SCENARIO.result;

  const hotVerification: VerifiedSnapshotVerification = {
    activityId: hot.activityId,
    verified:
      hot.status === "completed" &&
      hot.query.destinationLabel.includes("Central Phoenix") &&
      hot.query.startDate === "2026-08-18" &&
      hot.query.startTime === "14:00" &&
      hot.meanTemperatureC === 41.55235 &&
      hot.maximumTemperatureC === 41.5619 &&
      hot.cellCount === 16,
    destination: hot.query.destinationLabel,
    date: hot.query.startDate,
    localQueryHour: hot.query.startTime,
    meanTemperatureC: hot.meanTemperatureC,
    maximumTemperatureC: hot.maximumTemperatureC,
    cellCount: hot.cellCount,
    provenance: hot.provenance,
  };

  const coolVerification: VerifiedSnapshotVerification = {
    activityId: cool.activityId,
    verified:
      cool.status === "completed" &&
      cool.query.destinationLabel.includes("Central Phoenix") &&
      cool.query.startDate === "2026-08-18" &&
      cool.query.startTime === "06:00" &&
      cool.meanTemperatureC === 34.2316125 &&
      cool.maximumTemperatureC === 34.2476 &&
      cool.cellCount === 16,
    destination: cool.query.destinationLabel,
    date: cool.query.startDate,
    localQueryHour: cool.query.startTime,
    meanTemperatureC: cool.meanTemperatureC,
    maximumTemperatureC: cool.maximumTemperatureC,
    cellCount: cool.cellCount,
    provenance: cool.provenance,
  };

  return {
    hot: hotVerification,
    cool: coolVerification,
    bothVerified: hotVerification.verified && coolVerification.verified,
  };
}

/** @deprecated Use buildMatchedPatientRequestFromDemoCase */
export function buildMatchedPatientRequestForScenario(
  journeyOverride?: Partial<HeatRiskAssessmentRequest["journey"]>
): HeatRiskAssessmentRequest {
  return buildMatchedPatientRequestFromDemoCase(DEMO_CASE_A, journeyOverride);
}
