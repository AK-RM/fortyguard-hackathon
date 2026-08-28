import { NextResponse } from "next/server";

import { searchArizonaAddresses } from "@/lib/geocoding";

const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 180;
const MIN_INTERVAL_MS = 1000;
const requestTimestamps = new Map<string, number>();

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "local";
}

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const lastRequest = requestTimestamps.get(clientKey) ?? 0;

  if (now - lastRequest < MIN_INTERVAL_MS) {
    return true;
  }

  requestTimestamps.set(clientKey, now);
  return false;
}

export async function POST(request: Request) {
  let body: { address?: unknown };

  try {
    body = (await request.json()) as { address?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const address = typeof body.address === "string" ? body.address.trim() : "";

  if (address.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { error: "Enter at least 3 characters to search." },
      { status: 400 }
    );
  }

  if (address.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Address is too long." }, { status: 400 });
  }

  const clientKey = getClientKey(request);

  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { error: "Please wait a moment before searching again." },
      { status: 429 }
    );
  }

  try {
    const { candidates, outsideArizonaCount, rejectedExplicitNonArizona } =
      await searchArizonaAddresses(address);

    if (rejectedExplicitNonArizona) {
      return NextResponse.json({
        candidates: [],
        outsideArizonaCount: 1,
        rejectedExplicitNonArizona: true,
        error:
          "Location outside supported area. This hackathon deployment currently supports Arizona destinations only.",
      });
    }

    return NextResponse.json({
      candidates,
      outsideArizonaCount,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Location lookup is temporarily unavailable. You can still enter coordinates manually.",
        unavailable: true,
      },
      { status: 503 }
    );
  }
}
