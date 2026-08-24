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
  title: "Early clinician workflow evaluation",
  summary:
    "Structured clinician review of standardized synthetic cases is in progress. Metrics below will be populated from actual validation sessions.",
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
