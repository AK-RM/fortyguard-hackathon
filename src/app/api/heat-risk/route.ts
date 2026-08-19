import { NextResponse } from "next/server";

import {
  FortyGuardError,
  fetchHeatRiskAnalysis,
  type HeatRiskInput,
} from "@/lib/fortyguard";

// Allow the route to run for the full polling window on supported platforms.
export const maxDuration = 120;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

type ParsedHeatRiskRequest = HeatRiskInput | { error: string };

function parseHeatRiskRequest(body: unknown): ParsedHeatRiskRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const { latitude, longitude, date, time } = body as Record<string, unknown>;

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

  return { latitude, longitude, date, time };
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
    // The heavy lifting lives in the FortyGuard helper: submit a heatmap job,
    // poll by activity_id, then shape the upstream payload for the frontend.
    const result = await fetchHeatRiskAnalysis(parsed);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FortyGuardError) {
      // Log a safe server-side message for debugging without exposing secrets
      // or raw upstream payloads to the browser.
      console.error("[heat-risk]", error.message);

      if (error.kind === "config") {
        return NextResponse.json(
          { error: "Heat risk service is not configured." },
          { status: 503 }
        );
      }

      if (error.kind === "timeout") {
        return NextResponse.json(
          { error: "Heat risk analysis timed out. Please try again." },
          { status: 504 }
        );
      }

      if (error.kind === "failed") {
        return NextResponse.json(
          { error: "Heat risk analysis failed. Please try again." },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { error: "Unable to complete heat risk analysis at this time." },
        { status: 502 }
      );
    }

    console.error("[heat-risk] Unexpected error during heat risk analysis.");

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
