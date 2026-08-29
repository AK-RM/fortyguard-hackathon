import { NextResponse } from "next/server";

import {
  ActivityTokenConfigError,
  assertActivityTokenMatchesAssessment,
  signActivityToken,
  verifyActivityToken,
} from "@/lib/activity-token";
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
import { buildEnvironmentalQueryFromDischarge } from "@/lib/environmental-query";
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

  const payload = body as Partial<HeatRiskStatusRequest> & Record<string, unknown>;

  if (!payload.request || typeof payload.activityToken !== "string") {
    return {
      error: "activityToken and the original HeatSafe request are required.",
    };
  }

  const parsedRequest = parseHeatRiskRequest(payload.request);

  if ("error" in parsedRequest) {
    return parsedRequest;
  }

  return {
    request: parsedRequest,
    activityToken: payload.activityToken,
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

  const verifiedToken = verifyActivityToken(parsed.activityToken);

  if (!verifiedToken.ok) {
    return NextResponse.json({ error: verifiedToken.reason }, { status: 400 });
  }

  const environmentalQuery = buildEnvironmentalQueryFromDischarge(
    parsed.request.destination,
    parsed.request.journey,
    { aoiSideMeters: verifiedToken.payload.aoiSideMeters }
  );
  const inputFingerprint = fingerprintFromRequest(parsed.request);
  const tokenMatch = assertActivityTokenMatchesAssessment({
    payload: verifiedToken.payload,
    environmentalQuery,
    inputFingerprint,
  });

  if (!tokenMatch.ok) {
    return NextResponse.json({ error: tokenMatch.reason }, { status: 400 });
  }

  const activityId = verifiedToken.payload.activityId;

  try {
    const statusCheck = await checkHeatmapStatusOnce(activityId);

    if (statusCheck.processing) {
      const response: HeatRiskStatusResponse = {
        status: "processing",
        activityToken: parsed.activityToken,
        activityId,
        environmentalQuery,
        inputFingerprint,
        submittedAt: new Date().toISOString(),
        isRefresh: parsed.isRefresh === true,
      };

      return NextResponse.json(response);
    }

    if (statusCheck.failed) {
      return NextResponse.json(
        buildEnvironmentalUnavailableAssessment({
          parsed: parsed.request,
          environmentalQuery,
          environmentalFailureReason: "upstream_failed",
          environmentalFailure: getEnvironmentalFailureMessage("upstream_failed"),
        })
      );
    }

    const acquisition = acquireCompletedEnvironmentalData({
      activityId,
      query: environmentalQuery,
      statusCheck,
    });

    if (acquisition.kind === "retry_expanded") {
      if (verifiedToken.payload.retryCount >= 1) {
        return NextResponse.json(
          buildEnvironmentalUnavailableAssessment({
            parsed: parsed.request,
            environmentalQuery,
            environmentalFailureReason: "empty_expanded_aoi",
            environmentalFailure: getEnvironmentalFailureMessage("empty_expanded_aoi"),
          })
        );
      }

      const datetimeValidation = validateEnvironmentalQueryDatetime({
        journey: parsed.request.journey,
      });

      if (!datetimeValidation.ok) {
        return NextResponse.json(
          buildEnvironmentalUnavailableAssessment({
            parsed: parsed.request,
            environmentalQuery,
            environmentalFailureReason: datetimeValidation.reasonCode,
            environmentalFailure: datetimeValidation.message,
          })
        );
      }

      const fallbackActivityId = await submitHeatmapJobForQuery(acquisition.expandedQuery);
      const fallbackToken = signActivityToken({
        activityId: fallbackActivityId,
        environmentalQuery: acquisition.expandedQuery,
        inputFingerprint,
        retryCount: 1,
      });

      const response: HeatRiskStatusResponse = {
        status: "processing",
        activityToken: fallbackToken,
        activityId: fallbackActivityId,
        environmentalQuery: acquisition.expandedQuery,
        inputFingerprint,
        submittedAt: new Date().toISOString(),
        isRefresh: parsed.isRefresh === true,
      };

      return NextResponse.json(response);
    }

    if (acquisition.kind === "unavailable") {
      return NextResponse.json(
        buildEnvironmentalUnavailableAssessment({
          parsed: parsed.request,
          environmentalQuery,
          environmentalFailureReason: acquisition.reasonCode,
          environmentalFailure: getEnvironmentalFailureMessage(acquisition.reasonCode),
        })
      );
    }

    return NextResponse.json(
      buildCompletedHeatRiskAssessment({
        parsed: parsed.request,
        environmentalQuery,
        environmentalResult: acquisition.result,
      })
    );
  } catch (error) {
    if (error instanceof ActivityTokenConfigError) {
      return NextResponse.json(
        { error: "Heat risk service is not configured." },
        { status: 503 }
      );
    }

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
          environmentalQuery,
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
