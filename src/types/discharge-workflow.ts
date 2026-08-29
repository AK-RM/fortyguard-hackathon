import type {
  HomeSocialInput,
  MedicationRiskInput,
  PatientFactorsInput,
  ScoreContribution,
  SuggestedOwner,
} from "@/lib/heat-discharge-risk";
import type { EnvironmentalQuery } from "@/lib/environmental-query";
import type { HeatRiskAssessmentResponse } from "@/types/heat-risk-api";

export type TransportMode =
  | "ac_private_vehicle"
  | "taxi_rideshare"
  | "ambulance"
  | "public_bus"
  | "walking"
  | "other";

export type DischargeLocation = {
  label: string;
  latitude: number;
  longitude: number;
};

export type DischargeJourney = {
  date: string;
  time: string;
  timeZone: string;
  transportMode: TransportMode;
  durationMinutes: number;
};

export type DischargeProfile = {
  patient: PatientFactorsInput;
  medications: MedicationRiskInput;
  homeSocial: HomeSocialInput;
};

export type ActionStatus = "pending" | "in_progress" | "completed" | "escalated";

export type DischargeActionTask = {
  id: string;
  action: string;
  suggestedOwner: SuggestedOwner;
  status: ActionStatus;
  createdAt: string;
  completedAt?: string;
  escalatedAt?: string;
  note?: string;
};

export type AssessmentStatus =
  | "not_assessed"
  | "processing"
  | "assessed"
  | "stale"
  | "environmental_unavailable";

export type EnvironmentalRefreshState = {
  status: "processing" | "failed";
  activityToken: string;
  activityId: string;
  environmentalQuery: EnvironmentalQuery;
  inputFingerprint: string;
  submittedAt: string;
  failureMessage?: string;
};

export type PendingEnvironmentalAssessment = {
  activityToken: string;
  activityId: string;
  environmentalQuery: EnvironmentalQuery;
  inputFingerprint: string;
  submittedAt: string;
};

export type DischargeRecord = {
  id: string;
  casePreset?: "A" | "B" | "C";
  origin: DischargeLocation;
  destination: DischargeLocation;
  journey: DischargeJourney;
  profile: DischargeProfile;
  assessmentStatus: AssessmentStatus;
  assessment: HeatRiskAssessmentResponse | null;
  environmentalFailure: string | null;
  environmentalRefreshFailure: string | null;
  reassessmentRequired: boolean;
  assessedAt: string | null;
  assessmentInputFingerprint: string | null;
  pendingAssessment: PendingEnvironmentalAssessment | null;
  environmentalRefresh: EnvironmentalRefreshState | null;
  actions: DischargeActionTask[];
  createdAt: string;
  updatedAt: string;
};

export type DischargeDashboardSummary = {
  id: string;
  destinationLabel: string;
  plannedDischargeDisplay: string;
  transportMode: TransportMode;
  transportLabel: string;
  priority: HeatRiskAssessmentResponse["riskLevel"];
  keyReasons: string[];
  outstandingActionCount: number;
  assessmentStatus: AssessmentStatus;
  environmentalRefreshStatus: EnvironmentalRefreshState["status"] | null;
  reassessmentRequired: boolean;
};

export type DemoCaseDefinition = {
  preset: "A" | "B" | "C";
  id: string;
  label: string;
  vulnerabilityLabel: string;
  origin: DischargeLocation;
  destination: DischargeLocation;
  journey: DischargeJourney;
  profile: DischargeProfile;
};

export type ScoreBreakdown = {
  score: number;
  rawScore: number;
  priority: NonNullable<HeatRiskAssessmentResponse["riskLevel"]>;
  contributions: ScoreContribution[];
};
