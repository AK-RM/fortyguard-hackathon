import { NextResponse } from "next/server";

import {
  buildCompletedHeatRiskAssessment,
  buildEnvironmentalUnavailableAssessment,
} from "@/lib/assessment-orchestration";
import { fingerprintFromRequest } from "@/lib/discharge-record-state";
import { acquireCompletedEnvironmentalData } from "@/lib/environmental-acquisition";
import {
  getEnvironmentalFailureMessage,
  mapFortyGuardErrorKindToReasonCode,
} from "@/lib/environmental-failure";
import { validateEnvironmentalQueryDatetime } from "@/lib/environmental-datetime-validation";
import {
  FortyGuardError,
  checkHeatmapStatusOnce,
  submitHeatmapJobForQuery,
} from "@/lib/fortyguard";
import { parseHeatRiskRequest } from "@/lib/parse-heat-risk-request";
import type {
  HeatRiskStatusRequest,
  HeatRiskStatusResponse,
} from "@/types/heat-risk-api";

function parseStatusRequest(body: unknown): HeatRiskStatusRequest | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be an object." };
  }

  const payload = body as Partial<HeatRiskStatusRequest>;

  if (!payload.request || !payload.activityId || !payload.environmentalQuery) {
    return {
      error:
        "activityId, environmentalQuery, and the original HeatSafe request are required.",
    };
  }

  const parsedRequest = parseHeatRiskRequest(payload.request);

  if ("error" in parsedRequest) {
    return parsedRequest;
  }

  const inputFingerprint = fingerprintFromRequest(parsedRequest);

  if (
    payload.inputFingerprint &&
    payload.inputFingerprint !== inputFingerprint
  ) {
    return {
      error: "Input fingerprint does not match the current request snapshot.",
    };
  }

  return {
    request: parsedRequest,
    activityId: payload.activityId,
    inputFingerprint,
    environmentalQuery: payload.environmentalQuery,
    isRefresh: payload.isRefresh === true,
  };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = parseStatusRequest(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const statusCheck = await checkHeatmapStatusOnce(parsed.activityId);

    if (statusCheck.processing) {
      const response: HeatRiskStatusResponse = {
        status: "processing",
        activityId: parsed.activityId,
        environmentalQuery: parsed.environmentalQuery,
        inputFingerprint: parsed.inputFingerprint,
        submittedAt: new Date().toISOString(),
        isRefresh: parsed.isRefresh === true,
      };

      return NextResponse.json(response);
    }

    if (statusCheck.failed) {
      return NextResponse.json(
        buildEnvironmentalUnavailableAssessment({
          parsed: parsed.request,
          environmentalQuery: parsed.environmentalQuery,
          environmentalFailureReason: "upstream_failed",
          environmentalFailure: getEnvironmentalFailureMessage("upstream_failed"),
        })
      );
    }

    const acquisition = acquireCompletedEnvironmentalData({
      activityId: parsed.activityId,
      query: parsed.environmentalQuery,
      statusCheck,
    });

    if (acquisition.kind === "retry_expanded") {
      const datetimeValidation = validateEnvironmentalQueryDatetime({
        journey: parsed.request.journey,
      });

      if (!datetimeValidation.ok) {
        return NextResponse.json(
          buildEnvironmentalUnavailableAssessment({
            parsed: parsed.request,
            environmentalQuery: parsed.environmentalQuery,
            environmentalFailureReason: datetimeValidation.reasonCode,
            environmentalFailure: datetimeValidation.message,
          })
        );
      }

      const fallbackActivityId = await submitHeatmapJobForQuery(acquisition.expandedQuery);

      const response: HeatRiskStatusResponse = {
        status: "processing",
        activityId: fallbackActivityId,
        environmentalQuery: acquisition.expandedQuery,
        inputFingerprint: parsed.inputFingerprint,
        submittedAt: new Date().toISOString(),
        isRefresh: parsed.isRefresh === true,
      };

      return NextResponse.json(response);
    }

    if (acquisition.kind === "unavailable") {
      return NextResponse.json(
        buildEnvironmentalUnavailableAssessment({
          parsed: parsed.request,
          environmentalQuery: parsed.environmentalQuery,
          environmentalFailureReason: acquisition.reasonCode,
          environmentalFailure: getEnvironmentalFailureMessage(acquisition.reasonCode),
        })
      );
    }

    return NextResponse.json(
      buildCompletedHeatRiskAssessment({
        parsed: parsed.request,
        environmentalQuery: parsed.environmentalQuery,
        environmentalResult: acquisition.result,
      })
    );
  } catch (error) {
    if (error instanceof FortyGuardError) {
      console.error("[heat-risk/status]", error.message);

      if (error.kind === "config") {
        return NextResponse.json(
          { error: "Heat risk service is not configured." },
          { status: 503 }
        );
      }

      const reasonCode = mapFortyGuardErrorKindToReasonCode(error.kind);

      return NextResponse.json(
        buildEnvironmentalUnavailableAssessment({
          parsed: parsed.request,
          environmentalQuery: parsed.environmentalQuery,
          environmentalFailureReason: reasonCode,
          environmentalFailure: getEnvironmentalFailureMessage(reasonCode),
        })
      );
    }

    console.error("[heat-risk/status] Unexpected error during status check.");

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
