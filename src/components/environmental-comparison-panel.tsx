"use client";

import { useState } from "react";

import { buildMatchedPatientEnvironmentalComparison } from "@/lib/environmental-comparison";
import { PRIORITY_STYLES } from "@/components/ui/clinical-ui";

function extractHourLabel(queryWindowLabel: string): string {
  const match = queryWindowLabel.match(/^(\d{2}:\d{2})/);

  return match?.[1] ?? queryWindowLabel;
}

export function EnvironmentalComparisonPanel() {
  const comparison = buildMatchedPatientEnvironmentalComparison();
  const [showDetails, setShowDetails] = useState(false);

  const hot = comparison.scenarioA;
  const cool = comparison.scenarioB;
  const hotStyle = PRIORITY_STYLES[hot.priority];
  const coolStyle = PRIORITY_STYLES[cool.priority];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Why arrival time matters</h2>
      <p className="mt-1 text-sm text-slate-600">Same patient.</p>
      <p className="text-sm text-slate-600">Same destination.</p>
      <p className="text-sm font-medium text-slate-800">Only arrival time changes.</p>

      <div className="mt-5 space-y-3">
        <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-4 text-center">
          <p className="text-lg font-semibold text-slate-900">{extractHourLabel(hot.queryWindowLabel)}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {hot.meanTemperatureC.toFixed(1)}°C
          </p>
          <p className={`mt-2 text-sm font-bold uppercase ${hotStyle.text}`}>
            {hotStyle.label}
          </p>
        </div>

        <p className="text-center text-2xl text-slate-400" aria-hidden>
          ↓
        </p>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 text-center">
          <p className="text-lg font-semibold text-slate-900">{extractHourLabel(cool.queryWindowLabel)}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {cool.meanTemperatureC.toFixed(1)}°C
          </p>
          <p className={`mt-2 text-sm font-bold uppercase ${coolStyle.text}`}>
            {coolStyle.label}
          </p>
        </div>
      </div>

      {comparison.deltas.priorityChanged ? (
        <p className="mt-4 text-center text-base font-bold uppercase text-slate-900">
          {hotStyle.label} → {coolStyle.label}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowDetails((current) => !current)}
        className="mt-4 min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
      >
        {showDetails ? "Hide details" : "View details"}
      </button>

      {showDetails ? (
        <dl className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div>
            <dt className="font-medium text-slate-900">Patient profile</dt>
            <dd>{comparison.profileLabel}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Score change</dt>
            <dd>
              {hot.totalScore} → {cool.totalScore} (environmental contribution{" "}
              {comparison.deltas.environmentalPoints} pts)
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">FortyGuard activities</dt>
            <dd className="break-all font-mono text-xs">{hot.activityId}</dd>
            <dd className="mt-1 break-all font-mono text-xs">{cool.activityId}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
