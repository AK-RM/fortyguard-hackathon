export type ClinicianValidationStatus = "evaluation_in_progress" | "completed";

export type ClinicianValidationMetrics = {
  clinicianCount: number | null;
  caseReviewCount: number | null;
  additionalConsiderationPercent: number | null;
  reprioritizedActionPercent: number | null;
  meanActionabilityOutOfFive: number | null;
  pilotSupportPercent: number | null;
};

export const CLINICIAN_VALIDATION = {
  status: "completed" as ClinicianValidationStatus,
  title: "Early clinician usability feedback",
  summary:
    "Eight physicians each reviewed three synthetic patient cases (24 clinician–case reviews) and completed one structured survey (eight surveys total). Mean scores: recommendation usefulness 4.6/5, clinical sensibility 4.8/5, value added by environmental information 4.6/5. All eight identified a consideration they might not have immediately considered; seven of eight said HeatSafe could realistically improve discharge planning. Frequently mentioned considerations included air conditioning, transport, and temperature at discharge; one physician requested one-click EHR integration with recommendations carried into the discharge summary. This is early usability evidence involving synthetic cases — not clinical validation, an outcomes study, or evidence that HeatSafe reduces readmissions.",
  emptyStateLabel: "Clinician feedback available",
  metrics: {
    clinicianCount: 8,
    caseReviewCount: 24,
    additionalConsiderationPercent: 100,
    reprioritizedActionPercent: null,
    meanActionabilityOutOfFive: 4.6,
    pilotSupportPercent: 87.5,
  } satisfies ClinicianValidationMetrics,
};

export type ClinicianValidationConfig = typeof CLINICIAN_VALIDATION;
