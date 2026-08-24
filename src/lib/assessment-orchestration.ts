import { findArizonaLocationPreset } from "@/lib/arizona-locations";
import {
  addDurationToLocalDateTime,
  buildLocalDateTimeMetadata,
  formatFortyGuardQueryWindowDisplay,
  formatLocalDateTimeCompactLocal,
  FORTYGUARD_SINGLE_HOUR_NOTE,
} from "@/lib/discharge-timezone";
import type { EnvironmentalQuery } from "@/lib/environmental-query";
import type { EnvironmentalResult } from "@/lib/environmental-result";
import {
  SCORE_EXPLAINER_DISCLAIMER,
  evaluateHeatDischargeRisk,
} from "@/lib/heat-discharge-risk";
import {
  TRANSPORT_MODE_LABELS,
  TRANSITION_EXPOSURE_ASSUMPTIONS,
  calculateTransitionExposure,
} from "@/lib/transition-exposure";
import type {
  DestinationEnvironmentalData,
  HeatRiskAssessmentRequest,
  HeatRiskAssessmentResponse,
} from "@/types/heat-risk-api";

import { fingerprintFromRequest } from "./discharge-record-state";

const AOI_SIDE_METERS = 400;

function buildHeatsafeAdditions(
  actions: Array<{ id: string; action: string }>
): string[] {
  const labels: Record<string, string> = {
    "cooling-resource-assessment": "Verify home cooling before discharge",
    "follow-up-24-48": "Heat-specific 24–48 hour follow-up",
    "medication-review": "Heat-aware medication review flag",
    "transport-cooling-planning": "Transport and cooling contingency planning",
    "transition-heat-planning": "Hospital-to-home transition heat review",
    "power-outage-contingency": "Power-outage contingency for medical equipment",
    "fluid-plan-review": "Individualized fluid-plan clinician review",
    "patient-education": "Heat warning symptom education",
  };

  return actions
    .map((action) => labels[action.id] ?? action.action)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function provenanceDisplayLabel(provenance: EnvironmentalResult["provenance"]): string {
  if (provenance === "verified_historical") {
    return "Verified historical FortyGuard environmental intelligence";
  }

  return "Live completed FortyGuard environmental intelligence";
}

export function buildDestinationEnvironmentalData(params: {
  parsed: HeatRiskAssessmentRequest;
  environmentalQuery: EnvironmentalQuery;
  environmentalResult: EnvironmentalResult;
}): DestinationEnvironmentalData {
  const { parsed, environmentalQuery, environmentalResult } = params;
  const departureDateTime = {
    date: parsed.journey.date,
    time: parsed.journey.time,
  };
  const arrivalDateTime = addDurationToLocalDateTime(
    departureDateTime,
    parsed.journey.durationMinutes
  );
  const destinationPreset = findArizonaLocationPreset(
    parsed.destination.latitude,
    parsed.destination.longitude
  );

  return {
    label:
      destinationPreset?.label ??
      parsed.destination.label ??
      environmentalQuery.destinationLabel,
    latitude: parsed.destination.latitude,
    longitude: parsed.destination.longitude,
    timeZone: parsed.journey.timeZone,
    departureDateTimeLocal: buildLocalDateTimeMetadata(
      departureDateTime,
      parsed.journey.timeZone
    ),
    estimatedArrivalDateTimeLocal: {
      ...buildLocalDateTimeMetadata(arrivalDateTime, parsed.journey.timeZone),
      display: formatLocalDateTimeCompactLocal(arrivalDateTime),
    },
    journeyDurationMinutes: parsed.journey.durationMinutes,
    arrivalTimingNote:
      "Estimated arrival from coordinator-entered journey duration — not a calculated route ETA.",
    fortyGuardQueryHourLocal: buildLocalDateTimeMetadata(
      {
        date: environmentalQuery.startDate,
        time: environmentalQuery.startTime,
      },
      parsed.journey.timeZone
    ),
    fortyGuardQueryWindowLocal: formatFortyGuardQueryWindowDisplay({
      date: environmentalQuery.startDate,
      time: environmentalQuery.startTime,
    }),
    fortyGuardSingleHourNote: FORTYGUARD_SINGLE_HOUR_NOTE,
    meanTemperatureC: environmentalResult.meanTemperatureC,
    maximumTemperatureC: environmentalResult.maximumTemperatureC,
    minimumTemperatureC: environmentalResult.minimumTemperatureC,
    standardDeviationC: environmentalResult.standardDeviation,
    cellCount: environmentalResult.cellCount,
    fortyGuardActivityId: environmentalResult.activityId,
    environmentalProvenance: environmentalResult.provenance,
    environmentalProvenanceLabel: provenanceDisplayLabel(
      environmentalResult.provenance
    ),
    environmentalProvenanceNote: environmentalResult.provenanceNote ?? null,
    dataSource: "FortyGuard heatmap API (stats_data.temperature_stats)",
    aoiSideMeters: AOI_SIDE_METERS,
  };
}

export function buildCompletedHeatRiskAssessment(params: {
  parsed: HeatRiskAssessmentRequest;
  environmentalQuery: EnvironmentalQuery;
  environmentalResult: EnvironmentalResult;
  assessedAt?: string;
}): HeatRiskAssessmentResponse {
  const assessedAt = params.assessedAt ?? new Date().toISOString();
  const inputFingerprint = fingerprintFromRequest(params.parsed);
  const destinationEnvironmental = buildDestinationEnvironmentalData({
    parsed: params.parsed,
    environmentalQuery: params.environmentalQuery,
    environmentalResult: params.environmentalResult,
  });

  const transitionExposure = calculateTransitionExposure({
    transportMode: params.parsed.journey.transportMode,
    durationMinutes: params.parsed.journey.durationMinutes,
  });

  const riskAssessment = evaluateHeatDischargeRisk({
    environmental: {
      destination: {
        meanTemperature: params.environmentalResult.meanTemperatureC,
        maximumTemperature: params.environmentalResult.maximumTemperatureC,
      },
      transition: {
        points: transitionExposure.points,
        label: transitionExposure.label,
        explanation: transitionExposure.explanation,
      },
    },
    patient: params.parsed.patient,
    medications: params.parsed.medications,
    homeSocial: params.parsed.homeSocial,
  });

  return {
    status: "completed",
    fortyGuardDataUsed: true,
    environmentalAvailable: true,
    environmentalFailure: null,
    assessedAt,
    inputFingerprint,
    environmentalQuery: params.environmentalQuery,
    environmentalResult: params.environmentalResult,
    destinationEnvironmental,
    transitionEnvironmental: {
      transportMode: params.parsed.journey.transportMode,
      transportLabel: TRANSPORT_MODE_LABELS[params.parsed.journey.transportMode],
      durationMinutes: params.parsed.journey.durationMinutes,
      configuredDurationNote:
        "Journey duration is coordinator-entered configuration, not a calculated route.",
      transitionPoints: transitionExposure.points,
      transitionExplanation: transitionExposure.explanation,
      transitionAssumptions: TRANSITION_EXPOSURE_ASSUMPTIONS,
      originUsedForDisplayOnly: true,
    },
    totalRiskScore: riskAssessment.score,
    rawRiskScore: riskAssessment.rawScore,
    riskLevel: riskAssessment.priority,
    scoreContributions: riskAssessment.contributions,
    triggeredRiskFactors: riskAssessment.riskFactors,
    recommendedDischargeActions: riskAssessment.recommendedActions,
    heatsafeAdditions: buildHeatsafeAdditions(riskAssessment.recommendedActions),
    scoreExplainerDisclaimer: SCORE_EXPLAINER_DISCLAIMER,
    disclaimer: riskAssessment.disclaimer,
  };
}

export function buildEnvironmentalUnavailableAssessment(params: {
  parsed: HeatRiskAssessmentRequest;
  environmentalQuery: EnvironmentalQuery;
  environmentalFailure: string;
  assessedAt?: string;
}): HeatRiskAssessmentResponse {
  const assessedAt = params.assessedAt ?? new Date().toISOString();

  return {
    status: "failed",
    fortyGuardDataUsed: false,
    environmentalAvailable: false,
    environmentalFailure: params.environmentalFailure,
    assessedAt,
    inputFingerprint: fingerprintFromRequest(params.parsed),
    environmentalQuery: params.environmentalQuery,
    environmentalResult: null,
    destinationEnvironmental: null,
    transitionEnvironmental: null,
    totalRiskScore: null,
    rawRiskScore: null,
    riskLevel: null,
    scoreContributions: [],
    triggeredRiskFactors: [],
    recommendedDischargeActions: [],
    heatsafeAdditions: [],
    scoreExplainerDisclaimer: SCORE_EXPLAINER_DISCLAIMER,
    disclaimer:
      "Environmental heat data is unavailable. HeatSafe cannot produce an environmental prioritization score without FortyGuard data. Clinician review of the discharge plan remains required.",
  };
}
