import type { HeatRiskAssessmentRequest } from "@/types/heat-risk-api";
import type {
  DischargeActionTask,
  DischargeJourney,
  DischargeLocation,
  DischargeProfile,
  DischargeRecord,
  EnvironmentalRefreshState,
  PendingEnvironmentalAssessment,
} from "@/types/discharge-workflow";

type AssessmentInputSlice = {
  origin: DischargeLocation;
  destination: DischargeLocation;
  journey: DischargeJourney;
  profile: DischargeProfile;
};

export function computeAssessmentInputFingerprint(
  input: AssessmentInputSlice
): string {
  return JSON.stringify({
    origin: input.origin,
    destination: input.destination,
    journey: input.journey,
    profile: input.profile,
  });
}

export function fingerprintFromRequest(request: HeatRiskAssessmentRequest): string {
  return computeAssessmentInputFingerprint({
    origin: request.origin,
    destination: request.destination,
    journey: request.journey,
    profile: {
      patient: request.patient,
      medications: request.medications,
      homeSocial: request.homeSocial,
    },
  });
}

export function clearAssessmentState(record: DischargeRecord): DischargeRecord {
  return {
    ...record,
    assessmentStatus: "not_assessed",
    assessment: null,
    environmentalFailure: null,
    environmentalRefreshFailure: null,
    reassessmentRequired: false,
    assessedAt: null,
    assessmentInputFingerprint: null,
    pendingAssessment: null,
    environmentalRefresh: null,
    actions: [],
  };
}

export function invalidateAssessmentIfInputsChanged(
  record: DischargeRecord,
  nextInputs: AssessmentInputSlice
): DischargeRecord {
  const nextFingerprint = computeAssessmentInputFingerprint(nextInputs);

  if (
    record.assessmentStatus === "not_assessed" &&
    !record.pendingAssessment &&
    !record.environmentalRefresh
  ) {
    return {
      ...record,
      ...nextInputs,
      reassessmentRequired: false,
    };
  }

  if (
    record.pendingAssessment &&
    nextFingerprint !== record.pendingAssessment.inputFingerprint
  ) {
    const hadOnlyPendingProcessing =
      record.assessmentStatus === "processing" && !record.assessment;

    return {
      ...record,
      ...nextInputs,
      assessmentStatus: record.assessment ? "stale" : "not_assessed",
      pendingAssessment: null,
      environmentalRefreshFailure: null,
      reassessmentRequired: hadOnlyPendingProcessing,
      environmentalFailure: null,
      ...(record.assessment
        ? {
            assessment: null,
            assessedAt: null,
            assessmentInputFingerprint: null,
            actions: [],
          }
        : {}),
    };
  }

  if (
    record.environmentalRefresh &&
    nextFingerprint !== record.environmentalRefresh.inputFingerprint
  ) {
    let next: DischargeRecord = {
      ...record,
      ...nextInputs,
      environmentalRefresh: null,
      environmentalRefreshFailure: null,
    };

    if (
      record.assessmentInputFingerprint &&
      nextFingerprint !== record.assessmentInputFingerprint
    ) {
      next = {
        ...clearAssessmentState(next),
        ...nextInputs,
        assessmentStatus: "stale",
        reassessmentRequired: false,
      };
    }

    return next;
  }

  if (record.assessmentStatus === "not_assessed" || !record.assessmentInputFingerprint) {
    return {
      ...record,
      ...nextInputs,
      reassessmentRequired: false,
    };
  }

  if (nextFingerprint === record.assessmentInputFingerprint) {
    return {
      ...record,
      ...nextInputs,
      reassessmentRequired: false,
    };
  }

  return {
    ...clearAssessmentState(record),
    ...nextInputs,
    assessmentStatus: "stale",
    reassessmentRequired: false,
  };
}

export function updateAssessmentInputs(
  record: DischargeRecord,
  updates: Partial<AssessmentInputSlice>
): DischargeRecord {
  const nextInputs: AssessmentInputSlice = {
    origin: updates.origin ?? record.origin,
    destination: updates.destination ?? record.destination,
    journey: updates.journey ?? record.journey,
    profile: updates.profile ?? record.profile,
  };

  return invalidateAssessmentIfInputsChanged(record, nextInputs);
}

export function updateWorkflowActions(
  record: DischargeRecord,
  actions: DischargeActionTask[]
): DischargeRecord {
  return {
    ...record,
    actions,
    updatedAt: new Date().toISOString(),
  };
}

export function isAssessmentCurrent(record: DischargeRecord): boolean {
  if (record.assessmentStatus !== "assessed" || !record.assessment) {
    return false;
  }

  if (!record.assessmentInputFingerprint) {
    return false;
  }

  return (
    computeAssessmentInputFingerprint(record) === record.assessmentInputFingerprint
  );
}

export function isPendingAssessmentCurrent(record: DischargeRecord): boolean {
  if (record.assessmentStatus !== "processing" || !record.pendingAssessment) {
    return false;
  }

  return (
    computeAssessmentInputFingerprint(record) ===
    record.pendingAssessment.inputFingerprint
  );
}

export function isEnvironmentalRefreshCurrent(record: DischargeRecord): boolean {
  if (
    record.environmentalRefresh?.status !== "processing" ||
    !record.environmentalRefresh
  ) {
    return false;
  }

  return (
    computeAssessmentInputFingerprint(record) ===
    record.environmentalRefresh.inputFingerprint
  );
}

export function applySuccessfulAssessment(
  record: DischargeRecord,
  assessment: NonNullable<DischargeRecord["assessment"]>,
  actions: DischargeActionTask[],
  assessedAt: string,
  fingerprint: string
): DischargeRecord {
  return {
    ...record,
    assessment,
    environmentalFailure: assessment.environmentalFailure,
    environmentalRefreshFailure: null,
    reassessmentRequired: false,
    assessmentStatus: assessment.environmentalAvailable ? "assessed" : "environmental_unavailable",
    assessedAt,
    assessmentInputFingerprint: fingerprint,
    pendingAssessment: null,
    environmentalRefresh: null,
    actions,
    updatedAt: assessedAt,
  };
}

export function applyProcessingAssessment(
  record: DischargeRecord,
  pendingAssessment: PendingEnvironmentalAssessment
): DischargeRecord {
  return {
    ...record,
    assessmentStatus: "processing",
    pendingAssessment,
    environmentalFailure: null,
    environmentalRefreshFailure: null,
    reassessmentRequired: false,
    updatedAt: pendingAssessment.submittedAt,
  };
}

export function applyEnvironmentalRefresh(
  record: DischargeRecord,
  refresh: Omit<EnvironmentalRefreshState, "status" | "failureMessage">
): DischargeRecord {
  return {
    ...record,
    environmentalRefresh: {
      ...refresh,
      status: "processing",
    },
    environmentalRefreshFailure: null,
    environmentalFailure: null,
    reassessmentRequired: false,
    updatedAt: refresh.submittedAt,
  };
}

export function applyEnvironmentalRefreshFailure(
  record: DischargeRecord,
  failureMessage: string,
  assessedAt: string
): DischargeRecord {
  return {
    ...record,
    environmentalRefresh: record.environmentalRefresh
      ? {
          ...record.environmentalRefresh,
          status: "failed",
          failureMessage,
        }
      : null,
    environmentalRefreshFailure: failureMessage,
    updatedAt: assessedAt,
  };
}

export function clearEnvironmentalRefresh(record: DischargeRecord): DischargeRecord {
  return {
    ...record,
    environmentalRefresh: null,
    environmentalRefreshFailure: null,
  };
}

export function applyEnvironmentalFailure(
  record: DischargeRecord,
  assessment: NonNullable<DischargeRecord["assessment"]>,
  fingerprint: string,
  assessedAt: string,
  options?: { preserveExistingAssessment?: boolean }
): DischargeRecord {
  const preserveExistingAssessment = options?.preserveExistingAssessment === true;

  if (preserveExistingAssessment) {
    return {
      ...record,
      environmentalRefresh: record.environmentalRefresh
        ? {
            ...record.environmentalRefresh,
            status: "failed",
            failureMessage: assessment.environmentalFailure ?? undefined,
          }
        : null,
      environmentalRefreshFailure: assessment.environmentalFailure,
      pendingAssessment: null,
      updatedAt: assessedAt,
    };
  }

  return {
    ...record,
    assessment,
    environmentalFailure: assessment.environmentalFailure,
    environmentalRefreshFailure: null,
    reassessmentRequired: false,
    assessmentStatus: "environmental_unavailable",
    assessedAt,
    assessmentInputFingerprint: fingerprint,
    pendingAssessment: null,
    environmentalRefresh: null,
    actions: [],
    updatedAt: assessedAt,
  };
}
