import { NextResponse } from "next/server";

import { findDischargeLocation } from "@/lib/discharge-locations";
import {
  TimezoneConversionError,
  buildLocalDateTimeMetadata,
  buildUtcDateTimeMetadata,
  convertLocalDateTimeToUtc,
} from "@/lib/discharge-timezone";
import {
  FortyGuardError,
  fetchHeatRiskAnalysis,
} from "@/lib/fortyguard";
import { evaluateHeatDischargeRisk } from "@/lib/heat-discharge-risk";
import {
  FortyGuardMappingError,
  extractFortyGuardMinimumTemperature,
  mapFortyGuardEnvironmentalData,
} from "@/lib/map-fortyguard-environment";
import { parseHeatRiskRequest } from "@/lib/parse-heat-risk-request";

// Allow the route to run for the full polling window on supported platforms.
export const maxDuration = 120;

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

  try {
    const localDateTime = { date: parsed.date, time: parsed.time };
    const utcDateTime = convertLocalDateTimeToUtc(localDateTime, parsed.timeZone);
    const matchedLocation = findDischargeLocation(parsed.latitude, parsed.longitude);

    // Step 1: Retrieve live environmental heat data from FortyGuard using the
    // UTC date/time required by the upstream heatmap API.
    const fortyGuardResult = await fetchHeatRiskAnalysis({
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      date: utcDateTime.date,
      time: utcDateTime.time,
    });

    // Step 2: Map FortyGuard stats into the environmental input shape used by
    // the discharge risk engine (mean and maximum temperature in °C).
    const environmental = mapFortyGuardEnvironmentalData({
      statsData: fortyGuardResult.temperatureStats,
      mapData: fortyGuardResult.mapData,
    });

    // Step 3: Combine live environmental data with the submitted discharge
    // profile and run the existing explainable risk engine unchanged.
    const riskAssessment = evaluateHeatDischargeRisk({
      environmental,
      patient: parsed.patient,
      medications: parsed.medications,
      homeSocial: parsed.homeSocial,
    });

    return NextResponse.json({
      fortyGuardDataUsed: true,
      fortyGuardActivityId: fortyGuardResult.activityId,
      environmentalData: {
        dischargeLocation: {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          label: matchedLocation?.label ?? null,
          timeZone: parsed.timeZone,
        },
        dischargeDateTimeLocal: buildLocalDateTimeMetadata(
          localDateTime,
          parsed.timeZone
        ),
        fortyGuardRequestDateTimeUtc: buildUtcDateTimeMetadata(utcDateTime),
        analysisDate: utcDateTime.date,
        analysisTime: utcDateTime.time,
        meanTemperatureC: environmental.meanTemperature,
        maximumTemperatureC: environmental.maximumTemperature,
        minimumTemperatureC: extractFortyGuardMinimumTemperature({
          statsData: fortyGuardResult.temperatureStats,
          mapData: fortyGuardResult.mapData,
        }),
        dataSource: "FortyGuard heatmap API (stats_data.temperature_stats)",
      },
      totalRiskScore: riskAssessment.score,
      riskLevel: riskAssessment.priority,
      triggeredRiskFactors: riskAssessment.riskFactors,
      recommendedDischargeActions: riskAssessment.recommendedActions,
      disclaimer: riskAssessment.disclaimer,
    });
  } catch (error) {
    if (error instanceof TimezoneConversionError) {
      console.error("[heat-risk]", error.message);

      return NextResponse.json(
        { error: "Unable to convert discharge time to UTC for FortyGuard." },
        { status: 400 }
      );
    }

    if (error instanceof FortyGuardMappingError) {
      console.error("[heat-risk]", error.message);

      return NextResponse.json(
        {
          error:
            "FortyGuard returned data in an unexpected format. Unable to complete heat discharge assessment.",
        },
        { status: 502 }
      );
    }

    if (error instanceof FortyGuardError) {
      console.error("[heat-risk]", error.message);

      if (error.kind === "config") {
        return NextResponse.json(
          { error: "Heat risk service is not configured." },
          { status: 503 }
        );
      }

      if (error.kind === "timeout") {
        return NextResponse.json(
          {
            error:
              "FortyGuard heat analysis timed out. Unable to complete heat discharge assessment.",
          },
          { status: 504 }
        );
      }

      if (error.kind === "failed") {
        return NextResponse.json(
          {
            error:
              "FortyGuard heat analysis failed. Unable to complete heat discharge assessment.",
          },
          { status: 502 }
        );
      }

      return NextResponse.json(
        {
          error:
            "FortyGuard is unavailable at this time. Unable to complete heat discharge assessment.",
        },
        { status: 502 }
      );
    }

    console.error("[heat-risk] Unexpected error during heat discharge assessment.");

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
