const apiKey = process.env.FORTYGUARD_API_KEY;

if (!apiKey) {
  throw new Error("FORTYGUARD_API_KEY was not found");
}

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 120;
const SUCCESS_STATUSES = new Set(["completed", "succeeded"]);
const FAILURE_STATUSES = new Set(["failed", "error"]);
const TEST_HEATMAP_TIME = process.env.TEST_HEATMAP_TIME ?? "14:00";

/** HeatSafe Case A — Central Phoenix destination at estimated arrival time. */
const CASE_A = {
  label: "Central Phoenix, Arizona",
  latitude: 33.4484,
  longitude: -112.074,
  departureDate: "2026-08-18",
  departureTimeLocal: "14:00",
  timeZone: "America/Phoenix",
  journeyDurationMinutes: 45,
  estimatedArrivalLocal: "14:45",
  fortyGuardQueryDate: "2026-08-18",
  fortyGuardQueryHourLocal: "14:00",
};

const METERS_PER_DEGREE_LAT = 111_320;
const AOI_SIDE_METERS = 400;

/**
 * Mirrors src/lib/fortyguard.ts buildSquarePolygonAroundPoint().
 * Keep geometry logic aligned with the application helper.
 */
function buildSquarePolygonAroundPoint(latitude, longitude, sideMeters = AOI_SIDE_METERS) {
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

const polygonAoi = buildSquarePolygonAroundPoint(
  CASE_A.latitude,
  CASE_A.longitude
);

const heatmapRequestBody = {
  polygon_aoi: polygonAoi,
  date_time: {
    start_date: CASE_A.fortyGuardQueryDate,
    start_time: TEST_HEATMAP_TIME,
    filter_type: 1,
  },
  granularity: 100,
};

function formatFortyGuardQueryWindowLocal(date, queryHourTime, timeZone) {
  const [hour] = queryHourTime.split(":").map(Number);
  const endHour = `${String(hour + 1).padStart(2, "0")}:00`;
  return `${date} ${queryHourTime}–${endHour} ${timeZone}`;
}

function authHeaders() {
  return {
    "api-key": apiKey,
    "Content-Type": "application/json",
  };
}

function printSanitizedRequest() {
  console.log(`Diagnostic test time: ${TEST_HEATMAP_TIME}`);
  console.log("HeatSafe Case A manual FortyGuard request (sanitized):");
  console.log(
    JSON.stringify(
      {
        scenario: {
          destination: CASE_A.label,
          latitude: CASE_A.latitude,
          longitude: CASE_A.longitude,
          plannedDepartureLocal: `${CASE_A.departureDate} ${CASE_A.departureTimeLocal} ${CASE_A.timeZone}`,
          configuredJourneyDurationMinutes: CASE_A.journeyDurationMinutes,
          estimatedArrivalLocal: `${CASE_A.departureDate} ${CASE_A.estimatedArrivalLocal} ${CASE_A.timeZone}`,
          fortyGuardQueryWindowLocal: formatFortyGuardQueryWindowLocal(
            CASE_A.fortyGuardQueryDate,
            TEST_HEATMAP_TIME,
            CASE_A.timeZone
          ),
        },
        requestBody: heatmapRequestBody,
      },
      null,
      2
    )
  );
}

async function submitHeatmapJob() {
  printSanitizedRequest();

  const response = await fetch("https://api.fortyguard.com/v1/heatmap", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(heatmapRequestBody),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Heatmap submission failed (${response.status}): ${JSON.stringify(result)}`
    );
  }

  const activityId = result.data?.activity_id;

  if (!activityId) {
    throw new Error(
      `Heatmap submission did not return an activity_id: ${JSON.stringify(result)}`
    );
  }

  console.log(`Submitted heatmap job. activity_id: ${activityId}`);
  return activityId;
}

async function pollUntilComplete(activityId) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(
      `https://api.fortyguard.com/v1/status/${activityId}`,
      {
        method: "GET",
        headers: {
          "api-key": apiKey,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        `Status poll failed (${response.status}): ${JSON.stringify(result)}`
      );
    }

    const status = String(result.data?.status ?? "").toLowerCase();

    console.log(
      `Attempt ${attempt}/${MAX_ATTEMPTS}: status = ${status || "(missing)"}`
    );

    if (SUCCESS_STATUSES.has(status)) {
      console.log("Analysis finished successfully.");
      console.log(JSON.stringify(result, null, 2));
      return result;
    }

    if (FAILURE_STATUSES.has(status)) {
      throw new Error(
        `Heatmap analysis failed with status "${status}": ${JSON.stringify(result)}`
      );
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  throw new Error(
    `Timed out after ${MAX_ATTEMPTS} polling attempts (${(MAX_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s) waiting for activity_id ${activityId}`
  );
}

async function testHeatmap() {
  const activityId = await submitHeatmapJob();
  await pollUntilComplete(activityId);
}

testHeatmap().catch(console.error);
