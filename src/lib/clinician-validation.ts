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
  status: "evaluation_in_progress" as ClinicianValidationStatus,
  title: "Clinician workflow evaluation",
  summary:
    "Structured clinician review of standardized synthetic cases is underway. Aggregate metrics will be populated only from completed validation sessions — no placeholder percentages are shown.",
  emptyStateLabel: "Clinician evaluation in progress",
  metrics: {
    clinicianCount: null,
    caseReviewCount: null,
    additionalConsiderationPercent: null,
    reprioritizedActionPercent: null,
    meanActionabilityOutOfFive: null,
    pilotSupportPercent: null,
  } satisfies ClinicianValidationMetrics,
};

export type ClinicianValidationConfig = typeof CLINICIAN_VALIDATION;
