"use client";

import Link from "next/link";
import { useMemo } from "react";

import { EnvironmentalComparisonPanel } from "@/components/environmental-comparison-panel";
import { PriorityBadge } from "@/components/ui/clinical-ui";
import {
  buildPatientSummaryLine,
  getCaseHeaderLabel,
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

function getStatusLabel(summary: DischargeDashboardSummary): string {
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

  return "Assessed";
}

export default function DischargeDashboard() {
  const { state, ready } = useDischargeStorage();

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

  if (!ready || !state) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-600">
        Loading discharges…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              HeatSafe Discharge
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Today&apos;s heat-sensitive discharges. Open a case, run assessment, assign
              actions. Synthetic cases · not clinically validated.
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
            const profileLine = buildPatientSummaryLine(record);

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
                      <p className="mt-1 text-sm text-slate-700">{profileLine}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {summary.destinationLabel} · {summary.plannedDischargeDisplay}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <PriorityBadge priority={summary.priority} />
                      <span className="text-xs text-slate-600">{getStatusLabel(summary)}</span>
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
                      <span>{summary.keyReasons.slice(0, 2).join(" · ")}</span>
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
            About this workflow
          </summary>
          <p className="mt-3">
            For discharge coordinators and clinicians before the patient leaves — identify
            heat-sensitive transitions and assign owned follow-up actions.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Does not replace clinician judgment or automatically change medications.
          </p>
        </details>
      </div>
    </div>
  );
}
