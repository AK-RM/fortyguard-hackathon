"use client";

import { useState } from "react";

import {
  ACTION_STATUS_LABELS,
  formatActionTimestamp,
  getSuggestedOwnerLabel,
  updateActionNote,
  updateActionStatus,
} from "@/lib/discharge-actions";
import {
  getActionDisplayTitle,
  getActionWhyPreview,
} from "@/lib/discharge-display";
import { getSourcesForAction } from "@/lib/clinical-methodology";
import type { DischargeActionTask } from "@/types/discharge-workflow";

type ActionWorkflowCardProps = {
  action: DischargeActionTask;
  allActions: DischargeActionTask[];
  onUpdate: (actions: DischargeActionTask[]) => void;
};

export function ActionWorkflowCard({
  action,
  allActions,
  onUpdate,
}: ActionWorkflowCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const title = getActionDisplayTitle(action.id, "Discharge action");
  const why = getActionWhyPreview(action.action);
  const sources = getSourcesForAction(action.id);
  const isOutstanding = action.status !== "completed";

  return (
    <div
      className={`rounded-lg border p-4 text-sm ${
        isOutstanding
          ? "border-amber-200 bg-amber-50/50"
          : "border-emerald-200 bg-emerald-50/40"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="mt-2 text-slate-700">{action.action}</p>
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Why: </span>
            {why}
          </p>
        </div>
        <select
          value={action.status}
          onChange={(event) =>
            onUpdate(
              updateActionStatus(
                allActions,
                action.id,
                event.target.value as DischargeActionTask["status"]
              )
            )
          }
          className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium sm:w-auto sm:min-w-[9rem]"
          aria-label={`Status for ${title}`}
        >
          {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
        <div>
          <dt className="inline font-medium">Owner: </dt>
          <dd className="inline">{getSuggestedOwnerLabel(action.suggestedOwner)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Status: </dt>
          <dd className="inline">{ACTION_STATUS_LABELS[action.status]}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => setShowDetails((current) => !current)}
        className="mt-3 min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
      >
        {showDetails ? "Hide notes" : "Add note"}
      </button>

      {showDetails ? (
        <div className="mt-2 space-y-2">
          {action.completedAt ? (
            <p className="text-xs text-slate-600">
              Completed {formatActionTimestamp(action.completedAt)}
            </p>
          ) : null}
          {action.escalatedAt ? (
            <p className="text-xs text-slate-600">
              Escalated {formatActionTimestamp(action.escalatedAt)}
            </p>
          ) : null}
          <label className="block">
            <span className="sr-only">Coordinator note for {title}</span>
            <textarea
              value={action.note ?? ""}
              onChange={(event) =>
                onUpdate(updateActionNote(allActions, action.id, event.target.value))
              }
              rows={2}
              placeholder="What was done, who was contacted, or escalation context"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            />
          </label>
          {sources.length > 0 ? (
            <p className="text-xs text-slate-500">
              Basis:{" "}
              {sources.map((source, index) => (
                <span key={source.id}>
                  {index > 0 ? " · " : ""}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 hover:underline"
                  >
                    {source.label.replace(/^CDC |^AHRQ |^WHO /, "")}
                  </a>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
