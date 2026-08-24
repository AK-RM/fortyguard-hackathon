import type { EnvironmentalQuery } from "@/lib/environmental-query";

const FORTYGUARD_BASE_URL = "https://api.fortyguard.com/v1";

const SUCCESS_STATUSES = new Set(["completed", "succeeded"]);
const FAILURE_STATUSES = new Set(["failed", "error"]);

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

type FortyGuardEnvelope<T> = {
  error?: boolean;
  status_code?: number;
  message?: string;
  data?: T;
};

type HeatmapSubmissionData = {
  activity_id?: string;
};

export type HeatmapStatusData = {
  activity_id?: string;
  status?: string;
  result?: {
    map_data?: unknown;
    stats_data?: unknown;
  };
};

export type HeatmapStatusCheckResult = {
  activityId: string;
  normalizedStatus: string;
  rawStatus: string;
  completed: boolean;
  failed: boolean;
  processing: boolean;
  statsData: unknown;
  mapData: unknown;
  envelope: FortyGuardEnvelope<HeatmapStatusData>;
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

const METERS_PER_DEGREE_LAT = 111_320;

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

export async function submitHeatmapJobForQuery(
  query: EnvironmentalQuery
): Promise<string> {
  const apiKey = getApiKey();
  const polygonAoi = buildSquarePolygonAroundPoint(
    query.latitude,
    query.longitude,
    query.aoiSideMeters
  );

  const response = await fetch(`${FORTYGUARD_BASE_URL}/heatmap`, {
    method: "POST",
    headers: authHeaders(apiKey, true),
    body: JSON.stringify({
      polygon_aoi: polygonAoi,
      date_time: {
        start_date: query.startDate,
        start_time: query.startTime,
        filter_type: 1,
      },
      granularity: query.granularity,
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

export async function checkHeatmapStatusOnce(
  activityId: string
): Promise<HeatmapStatusCheckResult> {
  const apiKey = getApiKey();

  const response = await fetch(`${FORTYGUARD_BASE_URL}/status/${activityId}`, {
    method: "GET",
    headers: authHeaders(apiKey),
  });

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

  const rawStatus = String(result.data?.status ?? "");
  const normalizedStatus = rawStatus.toLowerCase();

  return {
    activityId,
    normalizedStatus,
    rawStatus,
    completed: SUCCESS_STATUSES.has(normalizedStatus),
    failed: FAILURE_STATUSES.has(normalizedStatus),
    processing: !SUCCESS_STATUSES.has(normalizedStatus) && !FAILURE_STATUSES.has(normalizedStatus),
    statsData: result.data?.result?.stats_data ?? null,
    mapData: result.data?.result?.map_data ?? null,
    envelope: result,
  };
}

export function normalizeFortyGuardStatus(status: string | undefined): string {
  return String(status ?? "").toLowerCase();
}

export function isFortyGuardCompletedStatus(status: string | undefined): boolean {
  return SUCCESS_STATUSES.has(normalizeFortyGuardStatus(status));
}

export function isFortyGuardFailedStatus(status: string | undefined): boolean {
  return FAILURE_STATUSES.has(normalizeFortyGuardStatus(status));
}
