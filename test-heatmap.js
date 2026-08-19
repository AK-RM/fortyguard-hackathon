const apiKey = process.env.FORTYGUARD_API_KEY;

if (!apiKey) {
  throw new Error("FORTYGUARD_API_KEY was not found");
}

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 120;
const SUCCESS_STATUSES = new Set(["completed", "succeeded"]);
const FAILURE_STATUSES = new Set(["failed", "error"]);

// Small GeoJSON polygon in central Phoenix (lng, lat pairs; closed ring).
const PHOENIX_POLYGON_AOI = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-112.0760, 33.4464],
            [-112.0720, 33.4464],
            [-112.0720, 33.4504],
            [-112.0760, 33.4504],
            [-112.0760, 33.4464],
          ],
        ],
      },
    },
  ],
};

function authHeaders() {
  return {
    "api-key": apiKey,
    "Content-Type": "application/json",
  };
}

async function submitHeatmapJob() {
  // Submission: POST the area of interest and analysis parameters to FortyGuard.
  // Heatmap generation is asynchronous — the API queues work and returns immediately
  // with an activity_id that identifies this specific background job.
  const response = await fetch("https://api.fortyguard.com/v1/heatmap", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      polygon_aoi: PHOENIX_POLYGON_AOI,
      date_time: {
        start_date: "2026-08-18",
        start_time: "14:00",
        filter_type: 1,
      },
      granularity: 100,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      `Heatmap submission failed (${response.status}): ${JSON.stringify(result)}`
    );
  }

  // activity_id is the handle used to track this job until results are ready.
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
  // Polling: repeatedly query the status endpoint with the activity_id until the
  // analysis finishes. Jobs move through states such as "Processing" before
  // reaching a terminal success or failure status.
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
