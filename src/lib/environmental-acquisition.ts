import type { EnvironmentalFailureReasonCode } from "@/lib/environmental-failure";
import { isEmptyEnvironmentalParseFailure } from "@/lib/environmental-failure";
import type { EnvironmentalQuery } from "@/lib/environmental-query";
import {
  buildExpandedEnvironmentalQuery,
  INITIAL_AOI_SIDE_METERS,
  isInitialAoiQuery,
} from "@/lib/environmental-query";
import type { EnvironmentalProvenance, EnvironmentalResult } from "@/lib/environmental-result";
import { parseFortyGuardEnvironmentalSource } from "@/lib/parse-fortyguard-environment";
import type { HeatmapStatusCheckResult } from "@/lib/fortyguard";

export type CompletedEnvironmentalAcquisitionResult =
  | {
      kind: "success";
      result: EnvironmentalResult;
    }
  | {
      kind: "retry_expanded";
      expandedQuery: EnvironmentalQuery;
    }
  | {
      kind: "unavailable";
      reasonCode: EnvironmentalFailureReasonCode;
    };

export function buildEnvironmentalResultFromParsedSource(params: {
  activityId: string;
  query: EnvironmentalQuery;
  statsData: unknown;
  mapData: unknown;
  provenance: EnvironmentalProvenance;
  provenanceNote?: string;
}): CompletedEnvironmentalAcquisitionResult {
  const parsed = parseFortyGuardEnvironmentalSource(
    {
      statsData: params.statsData,
      mapData: params.mapData,
    },
    { aoiSideMeters: params.query.aoiSideMeters }
  );

  if (!parsed.ok) {
    if (
      isInitialAoiQuery(params.query) &&
      isEmptyEnvironmentalParseFailure(parsed.reasonCode)
    ) {
      return {
        kind: "retry_expanded",
        expandedQuery: buildExpandedEnvironmentalQuery(params.query),
      };
    }

    const reasonCode =
      parsed.reasonCode === "empty_initial_aoi" && !isInitialAoiQuery(params.query)
        ? "empty_expanded_aoi"
        : parsed.reasonCode;

    return {
      kind: "unavailable",
      reasonCode,
    };
  }

  const aoiFallbackUsed = params.query.aoiSideMeters > INITIAL_AOI_SIDE_METERS;

  return {
    kind: "success",
    result: {
      source: "FortyGuard",
      activityId: params.activityId,
      query: params.query,
      minimumTemperatureC: parsed.data.minimumTemperatureC,
      maximumTemperatureC: parsed.data.maximumTemperatureC,
      meanTemperatureC: parsed.data.meanTemperatureC,
      standardDeviation: parsed.data.standardDeviationC,
      cellCount: parsed.data.cellCount,
      provenance: params.provenance,
      provenanceNote: params.provenanceNote,
      aoiSideMetersUsed: params.query.aoiSideMeters,
      aoiFallbackUsed,
      granularityUsed: params.query.granularity,
      status: "completed",
    },
  };
}

export function acquireCompletedEnvironmentalData(params: {
  activityId: string;
  query: EnvironmentalQuery;
  statusCheck: HeatmapStatusCheckResult;
}): CompletedEnvironmentalAcquisitionResult {
  if (params.statusCheck.failed) {
    return {
      kind: "unavailable",
      reasonCode: "upstream_failed",
    };
  }

  return buildEnvironmentalResultFromParsedSource({
    activityId: params.activityId,
    query: params.query,
    statsData: params.statusCheck.statsData,
    mapData: params.statusCheck.mapData,
    provenance: "live_fortyguard",
    provenanceNote: params.query.aoiSideMeters > INITIAL_AOI_SIDE_METERS
      ? "Live FortyGuard result retrieved using an expanded neighbourhood AOI because the initial hyperlocal request returned no usable temperature cells."
      : "Live FortyGuard result retrieved asynchronously for this exact environmental query.",
  });
}

export function classifyEmptyParseFailure(
  query: EnvironmentalQuery,
  reasonCode: EnvironmentalFailureReasonCode
): EnvironmentalFailureReasonCode {
  if (reasonCode === "empty_initial_aoi" && !isInitialAoiQuery(query)) {
    return "empty_expanded_aoi";
  }

  return reasonCode;
}
