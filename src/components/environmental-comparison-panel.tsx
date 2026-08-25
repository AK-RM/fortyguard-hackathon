"use client";

import { useState } from "react";

import { PriorityBadge } from "@/components/ui/clinical-ui";
import { buildMatchedPatientEnvironmentalComparison } from "@/lib/environmental-comparison";

export function EnvironmentalComparisonPanel() {
  const comparison = buildMatchedPatientEnvironmentalComparison();
  const [showDetails, setShowDetails] = useState(false);

  const hot = comparison.scenarioA;
  const cool = comparison.scenarioB;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold text-slate-900">Why arrival time matters</h2>
      <p className="mt-1 text-sm text-slate-600">
        Same patient. Same destination. Different arrival time.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">
            Hotter arrival
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">{hot.queryWindowLabel}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {hot.meanTemperatureC.toFixed(2)} °C
          </p>
          <div className="mt-3">
            <PriorityBadge priority={hot.priority} />
          </div>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Cooler arrival
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">{cool.queryWindowLabel}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {cool.meanTemperatureC.toFixed(2)} °C
          </p>
          <div className="mt-3">
            <PriorityBadge priority={cool.priority} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-800">
        Only the arrival window changed.
        {comparison.deltas.priorityChanged
          ? ` Priority shifts from ${hot.priority} to ${cool.priority}.`
          : null}
      </p>

      <button
        type="button"
        onClick={() => setShowDetails((current) => !current)}
        className="mt-3 min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
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
