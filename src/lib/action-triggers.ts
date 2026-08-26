import {
  HEAT_THRESHOLDS,
  type HeatDischargePriority,
  type HomeSocialInput,
  type MedicationRiskInput,
  type PatientFactorsInput,
} from "@/lib/heat-discharge-risk";
import type { TransportMode } from "@/types/discharge-workflow";
import { TRANSPORT_MODE_LABELS } from "@/lib/transition-exposure";

const MEDICATION_TRIGGER_LABELS: Record<keyof MedicationRiskInput, string> = {
  diuretic: "Diuretic",
  aceArbArni: "ACE/ARB/ARNI",
  betaBlocker: "Beta-blocker",
  anticholinergic: "Anticholinergic",
  psychotropic: "Psychotropic",
  lithium: "Lithium",
  nsaid: "NSAID",
};

export type ActionTriggerContext = {
  patient: PatientFactorsInput;
  medications: MedicationRiskInput;
  homeSocial: HomeSocialInput;
  journey: {
    transportMode: TransportMode;
    durationMinutes: number;
  };
  destinationEnvironmental?: {
    meanTemperatureC: number;
    maximumTemperatureC: number;
  } | null;
  transitionPoints: number;
  priority: HeatDischargePriority | null;
};

function isHighDestinationHeat(
  destination: { meanTemperatureC: number; maximumTemperatureC: number } | null | undefined
): boolean {
  if (!destination) {
    return false;
  }

  return (
    destination.meanTemperatureC >= HEAT_THRESHOLDS.meanHigh ||
    destination.maximumTemperatureC >= HEAT_THRESHOLDS.maxHigh
  );
}

function getActiveMedicationTriggerLabels(medications: MedicationRiskInput): string[] {
  return (Object.keys(MEDICATION_TRIGGER_LABELS) as Array<keyof MedicationRiskInput>)
    .filter((key) => medications[key])
    .map((key) => MEDICATION_TRIGGER_LABELS[key]);
}

function formatTransportJourney(
  transportMode: TransportMode,
  durationMinutes: number
): string {
  const label = TRANSPORT_MODE_LABELS[transportMode]
    .replace("Air-conditioned private vehicle", "AC vehicle")
    .replace("Taxi / rideshare", "Taxi/rideshare");

  return `${label} · ${durationMinutes} min`;
}

/**
 * Derives display trigger labels from the same input conditions used in
 * buildRecommendedActions — not from score totals.
 */
export function getActionTriggeredBy(
  actionId: string,
  context: ActionTriggerContext
): string {
  const highHeat = isHighDestinationHeat(context.destinationEnvironmental);
  const heatLabel = highHeat ? "High destination heat" : null;

  switch (actionId) {
    case "patient-education":
      return "Heat-sensitive discharge";

    case "cooling-resource-assessment": {
      const parts = ["No working AC"];
      if (heatLabel) {
        parts.push(heatLabel.toLowerCase());
      }
      return parts.join(" + ");
    }

    case "follow-up-24-48": {
      const parts: string[] = [];
      if (context.homeSocial.livesAlone) {
        parts.push("Lives alone");
      }
      if (!context.homeSocial.caregiverCheckInAvailable) {
        parts.push("no caregiver check-in");
      }
      if (
        parts.length === 0 &&
        (context.priority === "high" || context.priority === "urgent")
      ) {
        parts.push("High workflow priority");
      }
      return parts.join(" + ");
    }

    case "medication-review": {
      const meds = getActiveMedicationTriggerLabels(context.medications);
      const parts = [...meds];
      if (heatLabel) {
        parts.push(heatLabel.toLowerCase());
      }
      return parts.join(" + ");
    }

    case "transport-cooling-planning": {
      const parts: string[] = [];
      if (context.patient.limitedMobility) {
        parts.push("Limited mobility");
      }
      if (!context.homeSocial.reliableTransport) {
        parts.push("No reliable transport");
      }
      return parts.join(" + ");
    }

    case "transition-heat-planning":
      return formatTransportJourney(
        context.journey.transportMode,
        context.journey.durationMinutes
      );

    case "power-outage-contingency":
      return "Power-dependent medical equipment";

    case "fluid-plan-review": {
      const clinical: string[] = [];
      if (context.patient.heartFailure) {
        clinical.push("HF");
      }
      if (context.patient.kidneyDisease) {
        clinical.push("CKD");
      }
      if (context.patient.cardiovascularDisease && clinical.length === 0) {
        clinical.push("CVD");
      }
      const clinicalLabel = clinical.join("/");
      return heatLabel
        ? `${clinicalLabel} + high heat`
        : clinicalLabel || "Heart/kidney vulnerability";
    }

    default:
      return "Workflow rule match";
  }
}

export function buildActionTriggerContextFromRecord(
  record: {
    profile: {
      patient: PatientFactorsInput;
      medications: MedicationRiskInput;
      homeSocial: HomeSocialInput;
    };
    journey: { transportMode: TransportMode; durationMinutes: number };
    assessment?: {
      riskLevel?: HeatDischargePriority | null;
      destinationEnvironmental?: {
        meanTemperatureC: number;
        maximumTemperatureC: number;
      } | null;
      transitionEnvironmental?: { transitionPoints: number } | null;
    } | null;
  }
): ActionTriggerContext {
  return {
    patient: record.profile.patient,
    medications: record.profile.medications,
    homeSocial: record.profile.homeSocial,
    journey: record.journey,
    destinationEnvironmental: record.assessment?.destinationEnvironmental ?? null,
    transitionPoints: record.assessment?.transitionEnvironmental?.transitionPoints ?? 0,
    priority: record.assessment?.riskLevel ?? null,
  };
}
