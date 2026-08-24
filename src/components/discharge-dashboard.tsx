"use client";

import Link from "next/link";
import { useMemo } from "react";

import { PriorityBadge, SectionCard } from "@/components/ui/clinical-ui";
import { useDischargeStorage } from "@/hooks/use-discharge-storage";
import {
  summarizeDischargeRecord,
} from "@/lib/discharge-storage";
import type { DischargeDashboardSummary } from "@/types/discharge-workflow";

const STATUS_LABELS = {
  not_assessed: "Not assessed",
  processing: "Processing",
  assessed: "Assessed",
  stale: "Inputs changed — rerun",
  environmental_unavailable: "Environmental unavailable",
} as const;

function getDashboardStatusLabel(summary: DischargeDashboardSummary): string {
  if (summary.reassessmentRequired) {
    return "Inputs changed — run again";
  }

  if (
    summary.environmentalRefreshStatus === "processing" &&
    summary.priority
  ) {
    return "Assessed · Refreshing";
  }

  if (summary.assessmentStatus === "processing" && !summary.priority) {
    return STATUS_LABELS.processing;
  }

  return STATUS_LABELS[summary.assessmentStatus];
}

export default function DischargeDashboard() {
  const { state, ready } = useDischargeStorage();

  const summaries = useMemo(() => {
    if (!state) {
      return [];
    }

    return Object.values(state.discharges)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(summarizeDischargeRecord);
  }, [state]);

  if (!ready || !state) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-600">
        Loading discharge operations dashboard…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-sky-700">
              Discharge coordination
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              HeatSafe Discharge
            </h1>
            <p className="mt-3 max-w-3xl text-base text-slate-600">
              Heat-aware discharge coordination platform for today&apos;s
              discharges. Synthetic demonstration environment — not clinically
              validated.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href="/discharge/new"
              className="inline-flex items-center justify-center rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            >
              New discharge assessment
            </Link>
            <p className="text-xs text-slate-500">
              Synthetic workflow state stored locally in this browser.
            </p>
          </div>
        </div>
      </header>

      <SectionCard
        title="Today's discharges"
        description="Select a synthetic discharge record to open the full HeatSafe workflow — hospital origin, journey, destination environmental exposure, prioritization, and intervention tracking."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Patient ID</th>
                <th className="px-3 py-2">Destination</th>
                <th className="px-3 py-2">Planned discharge</th>
                <th className="px-3 py-2">Transport</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Key reasons</th>
                <th className="px-3 py-2">Outstanding</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summaries.map((summary) => (
                <tr key={summary.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3 font-medium text-sky-700">
                    <Link href={`/discharge/${summary.id}`}>{summary.id}</Link>
                  </td>
                  <td className="px-3 py-3 text-slate-800">
                    {summary.destinationLabel}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {summary.plannedDischargeDisplay}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {summary.transportLabel}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={summary.priority} />
                      {summary.environmentalRefreshStatus === "processing" &&
                      summary.priority ? (
                        <span className="text-xs font-medium text-sky-700">
                          Refreshing
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {summary.keyReasons.length > 0
                      ? summary.keyReasons.join(" · ")
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {summary.outstandingActionCount}
                  </td>
                  <td className="px-3 py-3 text-slate-700">
                    {getDashboardStatusLabel(summary)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
