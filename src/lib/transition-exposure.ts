import { WEIGHTS } from "@/lib/heat-discharge-risk";
import type { TransportMode } from "@/types/discharge-workflow";

export type TransitionExposureResult = {
  id: "transition-exposure";
  points: number;
  label: string;
  explanation: string;
  transportMode: TransportMode;
  durationMinutes: number;
  transportExposureFactor: number;
  durationFactor: number;
  rawPoints: number;
  cappedAt: number;
};

/** Maximum journey-modifier points — separate from destination heat scoring. */
export const MAX_TRANSITION_POINTS = WEIGHTS.environmental.transitionMax;

const TRANSPORT_EXPOSURE_FACTORS: Record<TransportMode, number> = {
  ac_private_vehicle: 0.15,
  ambulance: 0.2,
  taxi_rideshare: 0.35,
  other: 0.5,
  public_bus: 0.75,
  walking: 1,
};

export const TRANSPORT_MODE_LABELS: Record<TransportMode, string> = {
  ac_private_vehicle: "Air-conditioned private vehicle",
  taxi_rideshare: "Taxi / rideshare",
  ambulance: "Ambulance / medical transport",
  public_bus: "Public bus",
  walking: "Walking",
  other: "Other",
};

function getDurationFactor(durationMinutes: number) {
  if (durationMinutes <= 15) {
    return 0.5;
  }

  if (durationMinutes <= 30) {
    return 0.75;
  }

  if (durationMinutes <= 45) {
    return 1;
  }

  return 1.25;
}

/**
 * Journey modifier heuristic — driven by transport mode and configured duration.
 * Destination heat is scored separately; this does not re-measure destination heat.
 */
export function calculateTransitionExposure(input: {
  transportMode: TransportMode;
  durationMinutes: number;
}): TransitionExposureResult {
  const transportExposureFactor = TRANSPORT_EXPOSURE_FACTORS[input.transportMode];
  const durationFactor = getDurationFactor(input.durationMinutes);
  const rawPoints =
    WEIGHTS.environmental.transitionBase *
    transportExposureFactor *
    durationFactor;
  const points = Math.min(
    MAX_TRANSITION_POINTS,
    Math.max(0, Math.round(rawPoints))
  );

  const transportLabel = TRANSPORT_MODE_LABELS[input.transportMode].toLowerCase();

  return {
    id: "transition-exposure",
    points,
    label: "Journey transition modifier",
    explanation: `Hospital-to-home journey modifier (${transportLabel}, ${input.durationMinutes} min configured duration). This is a workflow heuristic based on transport exposure and coordinator-entered duration — not a second destination heat measurement, not clinically validated, and not a calculated route ETA.`,
    transportMode: input.transportMode,
    durationMinutes: input.durationMinutes,
    transportExposureFactor,
    durationFactor,
    rawPoints,
    cappedAt: MAX_TRANSITION_POINTS,
  };
}

export const TRANSITION_EXPOSURE_ASSUMPTIONS =
  "Transition points use transport exposure factors (AC vehicle lowest, walking highest) multiplied by a duration factor from coordinator-entered minutes, capped at 18 points. Destination heat is scored separately.";
