"use client";

import { useState } from "react";

import type { HeatRiskAssessmentResponse } from "@/types/heat-risk-api";
import { HEAT_THRESHOLDS } from "@/lib/heat-discharge-risk";

type EnvironmentalExposurePanelProps = {
  assessment: HeatRiskAssessmentResponse;
  assessedAt: string | null;
};

function getHeatSeverityLabel(meanTemperatureC: number, maximumTemperatureC: number): string {
  if (
    meanTemperatureC >= HEAT_THRESHOLDS.meanHigh ||
    maximumTemperatureC >= HEAT_THRESHOLDS.maxHigh
  ) {
    return "Extreme";
  }

  if (
    meanTemperatureC >= HEAT_THRESHOLDS.meanModerate ||
    maximumTemperatureC >= HEAT_THRESHOLDS.maxModerate
  ) {
    return "Elevated";
  }

  return "Moderate";
}

function formatArrivalTime(display: string): string {
  const match = display.match(/(\d{1,2}:\d{2})/);

  return match?.[1] ?? display;
}

export function EnvironmentalExposurePanel({
  assessment,
  assessedAt,
}: EnvironmentalExposurePanelProps) {
  const [showDetails, setShowDetails] = useState(false);
  const env = assessment.destinationEnvironmental;

  if (!env) {
    return null;
  }

  const severity = getHeatSeverityLabel(env.meanTemperatureC, env.maximumTemperatureC);
  const arrivalTime = formatArrivalTime(env.estimatedArrivalDateTimeLocal.display);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Heat at destination</h2>
      <p className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
        {env.meanTemperatureC.toFixed(1)}°C · {severity}
      </p>
      <p className="mt-2 text-sm text-slate-700">Expected arrival {arrivalTime}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">
        {env.environmentalProvenanceLabel}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Configured historical window: {env.configuredHistoricalQueryDate} ·{" "}
        {env.configuredHistoricalQueryHour} local
      </p>
      {env.aoiFallbackUsed ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Expanded neighbourhood AOI used ({env.aoiSideMeters} m) because the initial
          hyperlocal request returned no usable temperature cells.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowDetails((current) => !current)}
        className="mt-3 min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
      >
        {showDetails ? "Hide data details" : "Data details"}
      </button>

      {showDetails ? (
        <dl className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div>
            <dt className="font-medium text-slate-900">Location</dt>
            <dd>{env.label}</dd>
          </div>
          {assessedAt ? (
            <div>
              <dt className="font-medium text-slate-900">Assessed</dt>
              <dd>{new Date(assessedAt).toLocaleString()}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-medium text-slate-900">Departure</dt>
            <dd>{env.departureDateTimeLocal.display}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Arrival window</dt>
            <dd>{env.fortyGuardQueryWindowLocal}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Peak / min</dt>
            <dd>
              {env.maximumTemperatureC.toFixed(1)} °C /{" "}
              {env.minimumTemperatureC?.toFixed(1) ?? "—"} °C
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">AOI / granularity / cells</dt>
            <dd>
              {env.aoiSideMeters} m · granularity {env.granularity} · {env.cellCount}{" "}
              cells
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Activity ID</dt>
            <dd className="break-all font-mono text-xs">{env.fortyGuardActivityId}</dd>
          </div>
          {env.environmentalProvenanceNote ? (
            <div>
              <dt className="font-medium text-slate-900">Provenance note</dt>
              <dd>{env.environmentalProvenanceNote}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}
