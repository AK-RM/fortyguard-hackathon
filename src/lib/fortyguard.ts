const FORTYGUARD_BASE_URL = "https://api.fortyguard.com/v1";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
const MAX_POLL_ATTEMPTS = POLL_TIMEOUT_MS / POLL_INTERVAL_MS;

const SUCCESS_STATUSES = new Set(["completed", "succeeded"]);
const FAILURE_STATUSES = new Set(["failed", "error"]);

const METERS_PER_DEGREE_LAT = 111_320;

export type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, never>;
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    };
  }>;
};

export type HeatRiskInput = {
  latitude: number;
  longitude: number;
  date: string;
  time: string;
};

export type HeatRiskResult = {
  activityId: string;
  status: string;
  temperatureStats: unknown;
  mapData: unknown;
};

type FortyGuardEnvelope<T> = {
  error?: boolean;
  status_code?: number;
  message?: string;
  data?: T;
};

type HeatmapSubmissionData = {
  activity_id?: string;
};

type HeatmapStatusData = {
  activity_id?: string;
  status?: string;
  result?: {
    map_data?: unknown;
    stats_data?: unknown;
  };
};

export class FortyGuardError extends Error {
  readonly kind: "config" | "submission" | "polling" | "failed" | "timeout";

  constructor(
    message: string,
    kind: "config" | "submission" | "polling" | "failed" | "timeout"
  ) {
    super(message);
    this.name = "FortyGuardError";
    this.kind = kind;
  }
}

function getApiKey(): string {
  const apiKey = process.env.FORTYGUARD_API_KEY;

  if (!apiKey) {
    throw new FortyGuardError(
      "FORTYGUARD_API_KEY is not configured on the server.",
      "config"
    );
  }

  return apiKey;
}

function authHeaders(apiKey: string, includeJsonContentType = false) {
  return {
    "api-key": apiKey,
    ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds a closed square GeoJSON polygon centered on a point.
 * FortyGuard expects polygon_aoi as a FeatureCollection with lng/lat pairs.
 */
export function buildSquarePolygonAroundPoint(
  latitude: number,
  longitude: number,
  sideMeters = 400
): GeoJSONFeatureCollection {
  const halfSideMeters = sideMeters / 2;
  const deltaLat = halfSideMeters / METERS_PER_DEGREE_LAT;
  const deltaLng =
    halfSideMeters /
    (METERS_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180));

  const ring = [
    [longitude - deltaLng, latitude - deltaLat],
    [longitude + deltaLng, latitude - deltaLat],
    [longitude + deltaLng, latitude + deltaLat],
    [longitude - deltaLng, latitude + deltaLat],
    [longitude - deltaLng, latitude - deltaLat],
  ];

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        },
      },
    ],
  };
}

async function submitHeatmapJob(
  apiKey: string,
  polygonAoi: GeoJSONFeatureCollection,
  date: string,
  time: string
): Promise<string> {
  // Submission: POST the area of interest and analysis parameters to FortyGuard.
  // Heatmap generation is asynchronous — the API queues work and returns immediately
  // with an activity_id that identifies this specific background job.
  const response = await fetch(`${FORTYGUARD_BASE_URL}/heatmap`, {
    method: "POST",
    headers: authHeaders(apiKey, true),
    body: JSON.stringify({
      polygon_aoi: polygonAoi,
      date_time: {
        start_date: date,
        start_time: time,
        filter_type: 1,
      },
      granularity: 100,
    }),
  });

  let result: FortyGuardEnvelope<HeatmapSubmissionData>;

  try {
    result = await response.json();
  } catch {
    throw new FortyGuardError(
      "FortyGuard returned an unreadable submission response.",
      "submission"
    );
  }

  if (!response.ok) {
    throw new FortyGuardError(
      `FortyGuard heatmap submission failed with status ${response.status}.`,
      "submission"
    );
  }

  const activityId = result.data?.activity_id;

  if (!activityId) {
    throw new FortyGuardError(
      "FortyGuard did not return an activity_id for the heatmap job.",
      "submission"
    );
  }

  return activityId;
}

async function pollUntilComplete(
  apiKey: string,
  activityId: string
): Promise<FortyGuardEnvelope<HeatmapStatusData>> {
  // Polling: repeatedly query the status endpoint with the activity_id until the
  // analysis finishes. Jobs move through states such as "Processing" before
  // reaching a terminal success or failure status.
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const response = await fetch(
      `${FORTYGUARD_BASE_URL}/status/${activityId}`,
      {
        method: "GET",
        headers: authHeaders(apiKey),
      }
    );

    let result: FortyGuardEnvelope<HeatmapStatusData>;

    try {
      result = await response.json();
    } catch {
      throw new FortyGuardError(
        "FortyGuard returned an unreadable status response.",
        "polling"
      );
    }

    if (!response.ok) {
      throw new FortyGuardError(
        `FortyGuard status poll failed with status ${response.status}.`,
        "polling"
      );
    }

    const status = String(result.data?.status ?? "").toLowerCase();

    if (SUCCESS_STATUSES.has(status)) {
      return result;
    }

    if (FAILURE_STATUSES.has(status)) {
      throw new FortyGuardError(
        `FortyGuard reported a failed heatmap analysis (${status}).`,
        "failed"
      );
    }

    if (attempt < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  throw new FortyGuardError(
    "FortyGuard heatmap analysis timed out before completion.",
    "timeout"
  );
}

export async function fetchHeatRiskAnalysis(
  input: HeatRiskInput
): Promise<HeatRiskResult> {
  const apiKey = getApiKey();
  const polygonAoi = buildSquarePolygonAroundPoint(
    input.latitude,
    input.longitude
  );

  const activityId = await submitHeatmapJob(
    apiKey,
    polygonAoi,
    input.date,
    input.time
  );

  const completed = await pollUntilComplete(apiKey, activityId);

  return {
    activityId,
    status: completed.data?.status ?? "completed",
    temperatureStats: completed.data?.result?.stats_data ?? null,
    mapData: completed.data?.result?.map_data ?? null,
  };
}
