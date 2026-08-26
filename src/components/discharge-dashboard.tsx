"use client";

import Link from "next/link";
import { useMemo } from "react";

import { EnvironmentalComparisonPanel } from "@/components/environmental-comparison-panel";
import { PriorityBadge } from "@/components/ui/clinical-ui";
import { CLINICIAN_VALIDATION } from "@/lib/clinician-validation";
import {
  formatShortArrivalDisplay,
  getCaseHeaderLabel,
  getDashboardDifferentiators,
} from "@/lib/discharge-display";
import { useDischargeStorage } from "@/hooks/use-discharge-storage";
import { summarizeDischargeRecord } from "@/lib/discharge-storage";
import type { DischargeDashboardSummary } from "@/types/discharge-workflow";
import type { HeatDischargePriority } from "@/lib/heat-discharge-risk";

const PRIORITY_RANK: Record<HeatDischargePriority | "none", number> = {
  urgent: 0,
  high: 1,
  enhanced: 2,
  routine: 3,
  none: 4,
};

function getStatusLabel(summary: DischargeDashboardSummary): string | null {
  if (summary.reassessmentRequired) {
    return "Update assessment";
  }

  if (summary.environmentalRefreshStatus === "processing" && summary.priority) {
    return "Refreshing data";
  }

  if (summary.assessmentStatus === "processing" && !summary.priority) {
    return "Processing";
  }

  if (summary.assessmentStatus === "stale") {
    return "Needs reassessment";
  }

  if (summary.assessmentStatus === "not_assessed") {
    return "Not assessed";
  }

  return null;
}

export default function DischargeDashboard() {
  const { state, ready, resetToInitial } = useDischargeStorage();

  const rows = useMemo(() => {
    if (!state) {
      return [];
    }

    return Object.values(state.discharges)
      .map((record) => ({
        record,
        summary: summarizeDischargeRecord(record),
      }))
      .sort((left, right) => {
        const leftRank = PRIORITY_RANK[left.summary.priority ?? "none"];
        const rightRank = PRIORITY_RANK[right.summary.priority ?? "none"];

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return left.record.id.localeCompare(right.record.id);
      });
  }, [state]);

  function handleResetDemoData() {
    const confirmed = window.confirm(
      "Reset HS-001, HS-002, and HS-003 to their built-in demo state? Custom cases like HS-004 will be removed from this browser."
    );

    if (confirmed) {
      resetToInitial();
    }
  }

  if (!ready || !state) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-600">
        Loading discharges…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              HeatSafe Discharge
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Heat-sensitive discharges ranked by priority. Synthetic cases · not clinically
              validated.
            </p>
          </div>
          <Link
            href="/discharge/new"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 sm:w-auto"
          >
            New discharge
          </Link>
        </div>
      </header>

      <section aria-label="Today's discharges">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Today&apos;s discharges
        </h2>
        <ul className="mt-3 space-y-3">
          {rows.map(({ record, summary }) => {
            const caseLabel = getCaseHeaderLabel(record);
            const differentiators = getDashboardDifferentiators(record);
            const statusLabel = getStatusLabel(summary);
            const arrival = formatShortArrivalDisplay(
              record.journey.date,
              record.journey.time,
              record.journey.timeZone
            );

            return (
              <li key={summary.id}>
                <Link
                  href={`/discharge/${summary.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sky-800">{summary.id}</p>
                      {caseLabel ? (
                        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                          {caseLabel}
                        </p>
                      ) : null}
                      {differentiators.length > 0 ? (
                        <p className="mt-1 text-sm text-slate-700">
                          {differentiators.join(" · ")}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-slate-600">
                        {summary.destinationLabel} · {arrival}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <PriorityBadge priority={summary.priority} />
                      {statusLabel ? (
                        <span className="text-xs text-slate-600">{statusLabel}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                    {summary.outstandingActionCount > 0 ? (
                      <span className="font-medium text-amber-900">
                        {summary.outstandingActionCount} action
                        {summary.outstandingActionCount === 1 ? "" : "s"} outstanding
                      </span>
                    ) : summary.priority ? (
                      <span>No outstanding actions</span>
                    ) : null}
                    {summary.keyReasons.length > 0 ? (
                      <span>{summary.keyReasons.join(" · ")}</span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-8 space-y-6">
        <EnvironmentalComparisonPanel />
        <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium text-slate-900">
            About / pilot info
          </summary>
          <div className="mt-3 space-y-3">
            <p>
              For discharge coordinators and clinicians before the patient leaves — identify
              heat-sensitive transitions and assign owned follow-up actions.
            </p>
            <p className="text-xs text-slate-500">
              Does not replace clinician judgment or automatically change medications.
            </p>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="font-medium text-slate-900">{CLINICIAN_VALIDATION.title}</p>
              <p className="mt-1">{CLINICIAN_VALIDATION.summary}</p>
            </div>
            <button
              type="button"
              onClick={handleResetDemoData}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Reset demo data
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
