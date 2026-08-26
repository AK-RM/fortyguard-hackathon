"use client";

import {
  PRIORITY_STYLES,
} from "@/components/ui/clinical-ui";
import {
  getOutstandingActionCount,
  getTopFlagReasons,
} from "@/lib/discharge-display";
import type { DischargeRecord } from "@/types/discharge-workflow";

type AssessmentSummaryPanelProps = {
  record: DischargeRecord;
};

function getPriorityGuidance(priority: string): string {
  switch (priority) {
    case "urgent":
      return "Coordinate discharge-support review before the patient leaves.";
    case "high":
      return "Prioritize discharge-support coordination today.";
    case "enhanced":
      return "Review heat-sensitive discharge steps before departure.";
    default:
      return "Standard heat-aware discharge review.";
  }
}

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
      <p className={`text-3xl font-bold uppercase tracking-wide sm:text-4xl ${priorityStyle.text}`}>
        {priorityStyle.label}
      </p>
      <p className="mt-2 text-base text-slate-800 sm:text-lg">
        {getPriorityGuidance(assessment.riskLevel)}
      </p>

      {reasons.length > 0 ? (
        <div className="mt-5">
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

      <p className="mt-5 text-sm font-semibold text-slate-900">
        {outstanding === 0
          ? "All assigned actions completed"
          : `${outstanding} action${outstanding === 1 ? "" : "s"} need attention`}
      </p>

      {outstanding > 0 ? (
        <a
          href="#discharge-actions"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 sm:w-auto"
        >
          View actions
        </a>
      ) : null}

      <p className="mt-5 text-sm text-slate-500">
        Supporting score: {assessment.totalRiskScore}/100 · experimental
      </p>
    </section>
  );
}
