import type {
  CategorizedRiskFactor,
  HeatDischargePriority,
  HomeSocialInput,
  MedicationRiskInput,
  PatientFactorsInput,
  ScoreContribution,
  SuggestedOwner,
} from "@/lib/heat-discharge-risk";
import type { DateTimeMetadata } from "@/lib/discharge-timezone";
import type { EnvironmentalQuery } from "@/lib/environmental-query";
import type { EnvironmentalResult } from "@/lib/environmental-result";
import type {
  DischargeJourney,
  DischargeLocation,
  TransportMode,
} from "@/types/discharge-workflow";

export type HeatRiskAssessmentRequest = {
  origin: DischargeLocation;
  destination: DischargeLocation;
  journey: DischargeJourney;
  patient: PatientFactorsInput;
  medications: MedicationRiskInput;
  homeSocial: HomeSocialInput;
  forceRefresh?: boolean;
};

export type DestinationEnvironmentalData = {
  label: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  departureDateTimeLocal: DateTimeMetadata;
  estimatedArrivalDateTimeLocal: DateTimeMetadata;
  journeyDurationMinutes: number;
  arrivalTimingNote: string;
  fortyGuardQueryHourLocal: DateTimeMetadata;
  fortyGuardQueryWindowLocal: string;
  fortyGuardSingleHourNote: string;
  meanTemperatureC: number;
  maximumTemperatureC: number;
  minimumTemperatureC: number | null;
  standardDeviationC: number;
  cellCount: number;
  fortyGuardActivityId: string;
  environmentalProvenance: EnvironmentalResult["provenance"];
  environmentalProvenanceLabel: string;
  environmentalProvenanceNote: string | null;
  dataSource: string;
  aoiSideMeters: number;
  aoiFallbackUsed: boolean;
  granularity: number;
  configuredHistoricalQueryDate: string;
  configuredHistoricalQueryHour: string;
};

export type TransitionEnvironmentalData = {
  transportMode: TransportMode;
  transportLabel: string;
  durationMinutes: number;
  configuredDurationNote: string;
  transitionPoints: number;
  transitionExplanation: string;
  transitionAssumptions: string;
  originUsedForDisplayOnly: boolean;
};

export type HeatRiskAssessmentResponse = {
  status: "completed" | "failed";
  fortyGuardDataUsed: boolean;
  environmentalAvailable: boolean;
  environmentalFailure: string | null;
  environmentalFailureReason?: import("@/lib/environmental-failure").EnvironmentalFailureReasonCode;
  assessedAt: string;
  inputFingerprint: string;
  environmentalQuery: EnvironmentalQuery;
  environmentalResult: EnvironmentalResult | null;
  destinationEnvironmental: DestinationEnvironmentalData | null;
  transitionEnvironmental: TransitionEnvironmentalData | null;
  totalRiskScore: number | null;
  rawRiskScore: number | null;
  riskLevel: HeatDischargePriority | null;
  scoreContributions: ScoreContribution[];
  triggeredRiskFactors: CategorizedRiskFactor[];
  recommendedDischargeActions: Array<{
    id: string;
    action: string;
    suggestedOwner: SuggestedOwner;
  }>;
  heatsafeAdditions: string[];
  scoreExplainerDisclaimer: string;
  disclaimer: string;
};

export type HeatRiskProcessingResponse = {
  status: "processing";
  activityToken: string;
  activityId: string;
  environmentalQuery: EnvironmentalQuery;
  inputFingerprint: string;
  submittedAt: string;
  isRefresh: boolean;
};

export type HeatRiskStatusRequest = {
  request: HeatRiskAssessmentRequest;
  activityToken: string;
  isRefresh?: boolean;
};

export type HeatRiskStatusResponse =
  | HeatRiskProcessingResponse
  | HeatRiskAssessmentResponse;

export type HeatRiskAssessmentErrorResponse = {
  error: string;
};

export type HeatRiskSubmitResponse =
  | HeatRiskAssessmentResponse
  | HeatRiskProcessingResponse;
