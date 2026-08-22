import { NextResponse } from "next/server";

import { DEMO_DISCHARGE_SCENARIO } from "@/lib/demo-patient";
import { findDischargeLocation } from "@/lib/discharge-locations";
import {
  TimezoneConversionError,
  buildLocalDateTimeMetadata,
  buildUtcDateTimeMetadata,
  convertLocalDateTimeToUtc,
  isValidIanaTimeZone,
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
import type { HeatRiskAssessmentRequest } from "@/types/heat-risk-api";

// Allow the route to run for the full polling window on supported platforms.
export const maxDuration = 120;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type ParsedHeatRiskRequest = HeatRiskAssessmentRequest | { error: string };

function parseHeatRiskRequest(body: unknown): ParsedHeatRiskRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const { latitude, longitude, date, time, timeZone } = body as Record<
    string,
    unknown
  >;

  if (typeof latitude !== "number" || !Number.isFinite(latitude)) {
    return { error: "latitude must be a finite number." };
  }

  if (latitude < -90 || latitude > 90) {
    return { error: "latitude must be between -90 and 90." };
  }

  if (typeof longitude !== "number" || !Number.isFinite(longitude)) {
    return { error: "longitude must be a finite number." };
  }

  if (longitude < -180 || longitude > 180) {
    return { error: "longitude must be between -180 and 180." };
  }

  if (typeof date !== "string" || !DATE_PATTERN.test(date)) {
    return { error: "date must be a string in YYYY-MM-DD format." };
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return { error: "date must be a valid calendar date." };
  }

  if (typeof time !== "string" || !TIME_PATTERN.test(time)) {
    return { error: "time must be a string in HH:MM format." };
  }

  if (typeof timeZone !== "string" || timeZone.trim().length === 0) {
    return {
      error: "timeZone must be a non-empty IANA time zone for the discharge destination.",
    };
  }

  if (!isValidIanaTimeZone(timeZone)) {
    return { error: "timeZone must be a valid IANA time zone identifier." };
  }

  return { latitude, longitude, date, time, timeZone };
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

    // Step 3: Combine live environmental data with the fixed demo patient
    // scenario and run the existing explainable risk engine unchanged.
    const riskAssessment = evaluateHeatDischargeRisk({
      environmental,
      ...DEMO_DISCHARGE_SCENARIO,
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
