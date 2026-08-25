"use client";

import { PriorityBadge } from "@/components/ui/clinical-ui";
import {
  FORTYGUARD_PRODUCT_COPY,
  HEATSAFE_ROLE_COPY,
  getActionShortTitle,
} from "@/lib/clinical-methodology";
import { buildMatchedPatientEnvironmentalComparison } from "@/lib/environmental-comparison";

function formatDelta(value: number, suffix = ""): string {
  if (value === 0) {
    return `0${suffix}`;
  }

  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

export function EnvironmentalComparisonPanel() {
  const comparison = buildMatchedPatientEnvironmentalComparison();

  return (
    <section className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm ring-1 ring-sky-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
        Why location &amp; timing matter
      </p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">
        Compare environmental exposure
      </h2>
      <p className="mt-2 text-sm text-slate-700">{FORTYGUARD_PRODUCT_COPY}</p>
      <p className="mt-2 text-sm text-slate-600">{HEATSAFE_ROLE_COPY}</p>

      <div className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Same patient
        </p>
        <p className="mt-1 font-semibold text-slate-900">{comparison.profileLabel}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
          {comparison.heldConstantSummary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {[comparison.scenarioA, comparison.scenarioB].map((scenario) => (
          <div
            key={scenario.id}
            className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {scenario.arrivalLabel}
            </p>
            <p className="mt-1 font-semibold text-slate-900">{scenario.label}</p>
            <p className="mt-1 text-slate-600">{scenario.destinationLabel}</p>
            <dl className="mt-3 space-y-1 text-slate-700">
              <div className="flex justify-between gap-3">
                <dt>FortyGuard window</dt>
                <dd className="text-right">{scenario.queryWindowLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Mean temperature</dt>
                <dd className="font-medium">{scenario.meanTemperatureC.toFixed(2)} °C</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Environmental contribution</dt>
                <dd className="font-medium">+{scenario.environmentalPoints}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Total workflow score</dt>
                <dd className="font-medium">
                  {scenario.totalScore}/100
                  {scenario.rawScore !== scenario.totalScore ? (
                    <span className="text-xs text-slate-500">
                      {" "}
                      (raw {scenario.rawScore})
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Priority</dt>
                <dd>
                  <PriorityBadge priority={scenario.priority} />
                </dd>
              </div>
              <div>
                <dt className="font-medium">Surfaced actions</dt>
                <dd className="mt-1 text-slate-600">
                  {scenario.actionIds.length > 0
                    ? scenario.actionIds
                        .map((id) => getActionShortTitle(id, id))
                        .join(" · ")
                    : "None"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 pt-1">
                <dt>FortyGuard activity</dt>
                <dd className="max-w-[12rem] truncate font-mono text-xs">
                  {scenario.activityId}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
        <p className="font-semibold">FortyGuard changed the workflow</p>
        <p className="mt-2">{comparison.workflowEffectSummary}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            Environmental contribution:{" "}
            {formatDelta(comparison.deltas.environmentalPoints, " points")}
          </li>
          <li>
            Total workflow score: {formatDelta(comparison.deltas.totalScore, " points")}
            {comparison.deltas.totalScore !== comparison.deltas.rawScore ? (
              <span className="text-emerald-800">
                {" "}
                · Raw score delta: {formatDelta(comparison.deltas.rawScore, " points")}
              </span>
            ) : null}
          </li>
          <li>
            Priority:{" "}
            {comparison.deltas.priorityChanged
              ? `${comparison.scenarioA.priority} → ${comparison.scenarioB.priority}`
              : `Unchanged (${comparison.scenarioA.priority})`}
          </li>
          <li>
            Actions added in cooler arrival:{" "}
            {comparison.deltas.actionsAdded.length > 0
              ? comparison.deltas.actionsAdded
                  .map((id) => getActionShortTitle(id, id))
                  .join(", ")
              : "None"}
          </li>
          <li>
            Actions removed in cooler arrival:{" "}
            {comparison.deltas.actionsRemoved.length > 0
              ? comparison.deltas.actionsRemoved
                  .map((id) => getActionShortTitle(id, id))
                  .join(", ")
              : "None"}
          </li>
        </ul>
        <p className="mt-2 text-xs text-emerald-900">
          Deterministic HeatSafe workflow interpretation only — not a clinical outcome
          prediction. Both snapshots are verified completed FortyGuard results with
          activity ID provenance.
        </p>
      </div>
    </section>
  );
}
