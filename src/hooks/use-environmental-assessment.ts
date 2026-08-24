"use client";

import { useCallback, useEffect, useRef } from "react";

import { storeEnvironmentalResultInCache } from "@/lib/environmental-cache";
import {
  applyEnvironmentalFailure,
  applyEnvironmentalRefresh,
  applyEnvironmentalRefreshFailure,
  applyProcessingAssessment,
  applySuccessfulAssessment,
  computeAssessmentInputFingerprint,
  isAssessmentCurrent,
  isEnvironmentalRefreshCurrent,
  isPendingAssessmentCurrent,
} from "@/lib/discharge-record-state";
import {
  type PersistedDischargeState,
  upsertDischargeRecord,
} from "@/lib/discharge-storage";
import { mergeActionTasksOnReassessment } from "@/lib/discharge-actions";
import type {
  HeatRiskAssessmentRequest,
  HeatRiskAssessmentResponse,
  HeatRiskProcessingResponse,
  HeatRiskStatusRequest,
  HeatRiskStatusResponse,
  HeatRiskSubmitResponse,
} from "@/types/heat-risk-api";
import type { DischargeRecord } from "@/types/discharge-workflow";

const POLL_INTERVAL_MS = 5000;

type PersistFn = (state: PersistedDischargeState) => void;

function isProcessingResponse(
  data: HeatRiskSubmitResponse | HeatRiskStatusResponse
): data is HeatRiskProcessingResponse {
  return data.status === "processing";
}

function isCompletedResponse(
  data: HeatRiskSubmitResponse | HeatRiskStatusResponse
): data is HeatRiskAssessmentResponse {
  return data.status === "completed";
}

function isFailedResponse(data: HeatRiskAssessmentResponse): boolean {
  return data.status === "failed" || !data.environmentalAvailable;
}

export function useEnvironmentalAssessment(params: {
  record: DischargeRecord | null;
  state: PersistedDischargeState | null;
  persist: PersistFn;
  buildRequest: (record: DischargeRecord) => HeatRiskAssessmentRequest;
}) {
  const { record, state, persist, buildRequest } = params;
  const pollingRef = useRef<number | null>(null);

  const persistRecord = useCallback(
    (next: DischargeRecord) => {
      if (!state) {
        return;
      }

      persist(
        upsertDischargeRecord(state, {
          ...next,
          updatedAt: new Date().toISOString(),
        })
      );
    },
    [persist, state]
  );

  const persistWithEnvironmentalCache = useCallback(
    (next: DischargeRecord, assessment: HeatRiskAssessmentResponse) => {
      if (!state) {
        return;
      }

      const nextState = upsertDischargeRecord(state, {
        ...next,
        updatedAt: assessment.assessedAt,
      });

      if (assessment.environmentalResult) {
        persist({
          ...nextState,
          environmentalCache: storeEnvironmentalResultInCache(
            nextState.environmentalCache,
            assessment.environmentalResult
          ),
        });
        return;
      }

      persist(nextState);
    },
    [persist, state]
  );

  const finalizeAssessment = useCallback(
    (
      currentRecord: DischargeRecord,
      assessment: HeatRiskAssessmentResponse,
      options?: { isRefresh?: boolean }
    ) => {
      const isRefresh = options?.isRefresh === true;

      if (
        isRefresh &&
        assessment.inputFingerprint !== computeAssessmentInputFingerprint(currentRecord)
      ) {
        if (assessment.environmentalResult) {
          persist({
            ...upsertDischargeRecord(state!, {
              ...currentRecord,
              environmentalRefresh: null,
              environmentalRefreshFailure: null,
              updatedAt: assessment.assessedAt,
            }),
            environmentalCache: storeEnvironmentalResultInCache(
              state!.environmentalCache,
              assessment.environmentalResult
            ),
          });
        } else {
          persistRecord({
            ...currentRecord,
            environmentalRefresh: null,
            environmentalRefreshFailure: null,
            updatedAt: assessment.assessedAt,
          });
        }
        return;
      }

      if (
        isRefresh &&
        isFailedResponse(assessment)
      ) {
        persistRecord(
          applyEnvironmentalRefreshFailure(
            currentRecord,
            assessment.environmentalFailure ??
              "FortyGuard refresh did not return usable environmental data.",
            assessment.assessedAt
          )
        );
        return;
      }

      if (isRefresh && isAssessmentCurrent(currentRecord)) {
        if (isFailedResponse(assessment)) {
          persistRecord(
            applyEnvironmentalRefreshFailure(
              currentRecord,
              assessment.environmentalFailure ??
                "FortyGuard refresh did not return usable environmental data.",
              assessment.assessedAt
            )
          );
          return;
        }

        const actions = mergeActionTasksOnReassessment(
          currentRecord.actions,
          assessment.recommendedDischargeActions,
          assessment.assessedAt
        );

        persistWithEnvironmentalCache(
          applySuccessfulAssessment(
            currentRecord,
            assessment,
            actions,
            assessment.assessedAt,
            assessment.inputFingerprint
          ),
          assessment
        );
        return;
      }

      if (isFailedResponse(assessment)) {
        persistRecord(
          applyEnvironmentalFailure(
            currentRecord,
            assessment,
            assessment.inputFingerprint,
            assessment.assessedAt
          )
        );
        return;
      }

      const actions = mergeActionTasksOnReassessment(
        currentRecord.actions,
        assessment.recommendedDischargeActions,
        assessment.assessedAt
      );

      persistWithEnvironmentalCache(
        applySuccessfulAssessment(
          currentRecord,
          assessment,
          actions,
          assessment.assessedAt,
          assessment.inputFingerprint
        ),
        assessment
      );
    },
    [persist, persistRecord, persistWithEnvironmentalCache, state]
  );

  const checkPendingStatus = useCallback(
    async (options?: { isRefresh?: boolean }) => {
      if (!record || !state) {
        return;
      }

      const isRefresh = options?.isRefresh === true;

      if (isRefresh) {
        if (!record.environmentalRefresh || !isEnvironmentalRefreshCurrent(record)) {
          return;
        }
      } else if (!record.pendingAssessment || !isPendingAssessmentCurrent(record)) {
        return;
      }

      const activityId = isRefresh
        ? record.environmentalRefresh!.activityId
        : record.pendingAssessment!.activityId;
      const inputFingerprint = isRefresh
        ? record.environmentalRefresh!.inputFingerprint
        : record.pendingAssessment!.inputFingerprint;
      const environmentalQuery = isRefresh
        ? record.environmentalRefresh!.environmentalQuery
        : record.pendingAssessment!.environmentalQuery;

      const statusRequest: HeatRiskStatusRequest = {
        request: buildRequest(record),
        activityId,
        inputFingerprint,
        environmentalQuery,
        isRefresh,
      };

      try {
        const response = await fetch("/api/heat-risk/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(statusRequest),
        });

        const data = (await response.json()) as HeatRiskStatusResponse | { error: string };

        if (!response.ok || "error" in data) {
          return;
        }

        if (isProcessingResponse(data)) {
          return;
        }

        finalizeAssessment(record, data, { isRefresh });
      } catch {
        // Keep processing state; clinician can manually check again.
      }
    },
    [buildRequest, finalizeAssessment, record, state]
  );

  useEffect(() => {
    const shouldPollPending =
      record &&
      record.assessmentStatus === "processing" &&
      record.pendingAssessment &&
      isPendingAssessmentCurrent(record);

    const shouldPollRefresh =
      record &&
      record.environmentalRefresh?.status === "processing" &&
      isEnvironmentalRefreshCurrent(record);

    if (!shouldPollPending && !shouldPollRefresh) {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    void checkPendingStatus({
      isRefresh: Boolean(shouldPollRefresh && !shouldPollPending),
    });

    pollingRef.current = window.setInterval(() => {
      if (!record) {
        return;
      }

      if (isEnvironmentalRefreshCurrent(record)) {
        void checkPendingStatus({ isRefresh: true });
        return;
      }

      if (isPendingAssessmentCurrent(record)) {
        void checkPendingStatus({ isRefresh: false });
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [checkPendingStatus, record]);

  const submitAssessment = useCallback(
    async (options?: { forceRefresh?: boolean }) => {
      if (!record || !state) {
        return { ok: false as const, error: "Discharge record is unavailable." };
      }

      if (
        !options?.forceRefresh &&
        record.assessmentStatus === "processing" &&
        record.pendingAssessment &&
        isPendingAssessmentCurrent(record)
      ) {
        return {
          ok: false as const,
          error:
            "FortyGuard environmental intelligence is already processing for the current inputs.",
        };
      }

      if (
        options?.forceRefresh &&
        record.environmentalRefresh?.status === "processing" &&
        isEnvironmentalRefreshCurrent(record)
      ) {
        return {
          ok: false as const,
          error:
            "FortyGuard environmental refresh is already processing for the current inputs.",
        };
      }

      const request = {
        ...buildRequest(record),
        clientEnvironmentalCache: state.environmentalCache,
        ...(options?.forceRefresh ? { forceRefresh: true } : {}),
      };

      try {
        const response = await fetch("/api/heat-risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        const data = (await response.json()) as HeatRiskSubmitResponse | { error: string };

        if (!response.ok || "error" in data) {
          return {
            ok: false as const,
            error:
              "error" in data
                ? data.error
                : "Unable to complete the discharge risk assessment.",
          };
        }

        if (isProcessingResponse(data)) {
          if (data.inputFingerprint !== computeAssessmentInputFingerprint(record)) {
            return {
              ok: false as const,
              error: "Assessment inputs changed before FortyGuard submission completed.",
            };
          }

          if (data.isRefresh && isAssessmentCurrent(record)) {
            persistRecord(
              applyEnvironmentalRefresh(record, {
                activityId: data.activityId,
                environmentalQuery: data.environmentalQuery,
                inputFingerprint: data.inputFingerprint,
                submittedAt: data.submittedAt,
              })
            );
          } else {
            persistRecord(
              applyProcessingAssessment(record, {
                activityId: data.activityId,
                environmentalQuery: data.environmentalQuery,
                inputFingerprint: data.inputFingerprint,
                submittedAt: data.submittedAt,
              })
            );
          }

          return { ok: true as const, mode: "processing" as const };
        }

        if (isCompletedResponse(data)) {
          finalizeAssessment(record, data, {
            isRefresh: options?.forceRefresh === true && isAssessmentCurrent(record),
          });
          return { ok: true as const, mode: "completed" as const };
        }

        return {
          ok: false as const,
          error: "Unexpected assessment response from HeatSafe.",
        };
      } catch {
        return {
          ok: false as const,
          error:
            "Unable to reach the assessment service. Check your connection and try again.",
        };
      }
    },
    [buildRequest, finalizeAssessment, persistRecord, record, state]
  );

  return {
    submitAssessment,
    checkPendingStatus,
  };
}
