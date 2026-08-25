"use client";

import {
  PRIORITY_STYLES,
  PriorityBadge,
} from "@/components/ui/clinical-ui";
import {
  getOutstandingActionCount,
  getTopFlagReasons,
} from "@/lib/discharge-display";
import type { DischargeRecord } from "@/types/discharge-workflow";

type AssessmentSummaryPanelProps = {
  record: DischargeRecord;
};

export function AssessmentSummaryPanel({ record }: AssessmentSummaryPanelProps) {
  const assessment = record.assessment;

  if (!assessment?.environmentalAvailable || !assessment.riskLevel) {
    return null;
  }

  const priorityStyle = PRIORITY_STYLES[assessment.riskLevel];
  const reasons = getTopFlagReasons(assessment.scoreContributions);
  const outstanding = getOutstandingActionCount(record);

  return (
    <section
      className={`rounded-xl border bg-white p-5 shadow-sm ring-2 sm:p-6 ${priorityStyle.ring}`}
      aria-label="Assessment summary"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={`text-sm font-semibold uppercase tracking-wide ${priorityStyle.text}`}>
            {priorityStyle.label}
          </p>
          <p className="mt-1 text-4xl font-bold text-slate-900 sm:text-5xl">
            {assessment.totalRiskScore}
            <span className="ml-1 text-lg font-medium text-slate-500">/ 100</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Workflow score · not clinically validated
          </p>
        </div>
        <PriorityBadge priority={assessment.riskLevel} />
      </div>

      {reasons.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-900">Why this patient was flagged</p>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className="text-slate-400" aria-hidden>
                  •
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <p className="text-sm font-medium text-slate-900">
          {outstanding === 0
            ? "All assigned actions completed"
            : `${outstanding} action${outstanding === 1 ? "" : "s"} need attention`}
        </p>
        {outstanding > 0 ? (
          <a
            href="#discharge-actions"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 sm:w-auto"
          >
            View actions
          </a>
        ) : null}
      </div>

      {assessment.riskLevel === "urgent" ? (
        <p className="mt-4 text-sm text-red-900">
          Coordinate immediate discharge-support review. Workflow prioritization only — not
          a clinical outcome prediction.
        </p>
      ) : null}
    </section>
  );
}
