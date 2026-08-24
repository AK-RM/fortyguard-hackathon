import { NextResponse } from "next/server";

import {
  buildCompletedHeatRiskAssessment,
  buildEnvironmentalUnavailableAssessment,
} from "@/lib/assessment-orchestration";
import { fingerprintFromRequest } from "@/lib/discharge-record-state";
import { lookupEnvironmentalResult } from "@/lib/environmental-cache";
import { buildEnvironmentalQueryFromDischarge } from "@/lib/environmental-query";
import { FortyGuardError, submitHeatmapJobForQuery } from "@/lib/fortyguard";
import { parseHeatRiskRequest } from "@/lib/parse-heat-risk-request";

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

  const parsed = parseHeatRiskRequest(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const forceRefresh = parsed.forceRefresh === true;
  const environmentalQuery = buildEnvironmentalQueryFromDischarge(
    parsed.destination,
    parsed.journey
  );
  const inputFingerprint = fingerprintFromRequest(parsed);

  try {
    if (!forceRefresh) {
      const cachedResult = lookupEnvironmentalResult(
        environmentalQuery,
        parsed.clientEnvironmentalCache ?? {}
      );

      if (cachedResult) {
        return NextResponse.json(
          buildCompletedHeatRiskAssessment({
            parsed,
            environmentalQuery,
            environmentalResult: cachedResult,
          })
        );
      }
    }

    const activityId = await submitHeatmapJobForQuery(environmentalQuery);

    return NextResponse.json({
      status: "processing",
      activityId,
      environmentalQuery,
      inputFingerprint,
      submittedAt: new Date().toISOString(),
      isRefresh: forceRefresh,
    });
  } catch (error) {
    if (error instanceof FortyGuardError) {
      console.error("[heat-risk]", error.message);

      if (error.kind === "config") {
        return NextResponse.json(
          { error: "Heat risk service is not configured." },
          { status: 503 }
        );
      }

      return NextResponse.json(
        buildEnvironmentalUnavailableAssessment({
          parsed,
          environmentalQuery,
          environmentalFailure:
            error.kind === "failed"
              ? "FortyGuard heat analysis failed. Environmental assessment is unavailable."
              : "FortyGuard is unavailable. Environmental assessment is unavailable.",
        })
      );
    }

    console.error("[heat-risk] Unexpected error during heat-risk submission.");

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
