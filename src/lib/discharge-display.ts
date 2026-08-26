import { countOutstandingActions } from "@/lib/discharge-actions";
import { getActionShortTitle } from "@/lib/clinical-methodology";
import { getDemoCaseById } from "@/lib/demo-cases";
import type { ScoreContribution } from "@/lib/heat-discharge-risk";
import { TRANSPORT_MODE_LABELS } from "@/lib/transition-exposure";
import type { DischargeRecord } from "@/types/discharge-workflow";

export function buildPatientSummaryLine(record: DischargeRecord): string {
  const { patient, medications, homeSocial } = record.profile;
  const parts: string[] = [`${patient.age} years`];

  if (patient.heartFailure) parts.push("HF");
  if (patient.kidneyDisease) parts.push("CKD");
  if (patient.cardiovascularDisease) parts.push("CVD");
  if (patient.respiratoryDisease) parts.push("respiratory disease");
  if (patient.diabetes) parts.push("diabetes");
  if (patient.cognitiveImpairment) parts.push("cognitive impairment");
  if (patient.limitedMobility) parts.push("limited mobility");

  if (medications.diuretic) parts.push("diuretic");
  if (medications.betaBlocker) parts.push("beta-blocker");
  if (medications.aceArbArni) parts.push("ACE/ARB");
  if (medications.lithium) parts.push("lithium");

  if (!homeSocial.workingAirConditioning) parts.push("no AC");
  if (homeSocial.livesAlone) parts.push("lives alone");
  if (!homeSocial.caregiverCheckInAvailable) parts.push("no caregiver check-in");

  const transport = TRANSPORT_MODE_LABELS[record.journey.transportMode]
    .replace("Air-conditioned private vehicle", "AC vehicle")
    .replace("Taxi / rideshare", "Taxi/rideshare")
    .replace("Public bus", "Public bus");

  parts.push(`${transport} · ${record.journey.durationMinutes} min`);

  return parts.join(" · ");
}

export function getCaseHeaderLabel(record: DischargeRecord): string | null {
  const demoCase = getDemoCaseById(record.id);

  if (!demoCase) {
    return record.casePreset ? `Case ${record.casePreset} · Synthetic` : null;
  }

  return `Case ${demoCase.preset} · Synthetic · ${demoCase.vulnerabilityLabel}`;
}

export function getTopFlagReasons(
  contributions: ScoreContribution[],
  limit = 5
): string[] {
  return contributions
    .slice()
    .sort((left, right) => right.points - left.points)
    .slice(0, limit)
    .map((item) => simplifyReasonLabel(item.label));
}

function simplifyReasonLabel(label: string): string {
  return label
    .replace(/^High mean destination heat$/i, "High destination heat")
    .replace(/^High peak destination heat$/i, "High destination heat")
    .replace(/^Moderate mean destination heat$/i, "Elevated destination heat")
    .replace(/^Moderate peak destination heat$/i, "Elevated destination heat")
    .replace(/^No working AC$/i, "No functioning AC")
    .replace(/^Age ≥75$/i, "Age 75+")
    .replace(/^Age 65–74$/i, "Age 65–74");
}

export function dedupeFlagReasons(reasons: string[]): string[] {
  const normalized = reasons.map((reason) => simplifyReasonLabel(reason));
  const unique: string[] = [];

  for (const reason of normalized) {
    if (!unique.includes(reason)) {
      unique.push(reason);
    }
  }

  return unique;
}

export function getDashboardDifferentiators(record: DischargeRecord, limit = 3): string[] {
  const { patient, medications, homeSocial } = record.profile;
  const items: string[] = [];

  if (patient.heartFailure) items.push("HF");
  if (patient.kidneyDisease) items.push("CKD");
  if (medications.diuretic) items.push("Diuretic");
  if (!homeSocial.workingAirConditioning) items.push("No AC");
  if (homeSocial.livesAlone) items.push("Lives alone");
  if (patient.age >= 75) items.push("Age 75+");

  return items.slice(0, limit);
}

export function formatShortArrivalDisplay(
  date: string,
  time: string,
  timeZone: string
): string {
  const [hours, minutes] = time.split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${date} · ${hour12}:${minutes} ${suffix}`;
}

export function getOutstandingActionCount(record: DischargeRecord): number {
  return countOutstandingActions(record.actions);
}

export function getActionWhyPreview(actionText: string): string {
  const firstSentence = actionText.split(/(?<=[.!])\s+/)[0]?.trim();

  if (!firstSentence || firstSentence.length > 160) {
    return actionText.length > 160 ? `${actionText.slice(0, 157)}…` : actionText;
  }

  return firstSentence;
}

export function getActionDisplayTitle(actionId: string, fallback: string): string {
  return getActionShortTitle(actionId, fallback);
}
