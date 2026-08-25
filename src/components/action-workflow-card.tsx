"use client";

import {
  ACTION_STATUS_LABELS,
  formatActionTimestamp,
  getSuggestedOwnerLabel,
  updateActionNote,
  updateActionStatus,
} from "@/lib/discharge-actions";
import { getActionShortTitle, getSourcesForAction } from "@/lib/clinical-methodology";
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
  const title = getActionShortTitle(action.id, "Discharge intervention");
  const sources = getSourcesForAction(action.id);
  const isOutstanding = action.status !== "completed";

  return (
    <div
      className={`rounded-lg border p-4 text-sm ${
        isOutstanding
          ? "border-amber-200 bg-amber-50/40"
          : "border-emerald-200 bg-emerald-50/30"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-slate-700">{action.action}</p>
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
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium"
          aria-label={`Status for ${title}`}
        >
          {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <dl className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="inline font-medium text-slate-700">Owner: </dt>
          <dd className="inline capitalize">{getSuggestedOwnerLabel(action.suggestedOwner)}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-700">Status: </dt>
          <dd className="inline">{ACTION_STATUS_LABELS[action.status]}</dd>
        </div>
        {action.completedAt ? (
          <div>
            <dt className="inline font-medium text-slate-700">Completed: </dt>
            <dd className="inline">{formatActionTimestamp(action.completedAt)}</dd>
          </div>
        ) : null}
        {action.escalatedAt ? (
          <div>
            <dt className="inline font-medium text-slate-700">Escalated: </dt>
            <dd className="inline">{formatActionTimestamp(action.escalatedAt)}</dd>
          </div>
        ) : null}
      </dl>

      <label className="mt-3 block">
        <span className="text-xs font-medium text-slate-700">Coordinator note</span>
        <textarea
          value={action.note ?? ""}
          onChange={(event) =>
            onUpdate(updateActionNote(allActions, action.id, event.target.value))
          }
          rows={2}
          placeholder="Document what was done, who was contacted, or escalation context."
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
        />
      </label>

      {sources.length > 0 ? (
        <p className="mt-2 text-xs text-slate-500">
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
  );
}
