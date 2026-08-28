"use client";

import {
  ACTION_STATUS_LABELS,
  finalizeActionNote,
  formatActionTimestamp,
  getSuggestedOwnerLabel,
  MAX_ACTION_NOTE_LENGTH,
  sanitizeActionNoteDraft,
  updateActionNote,
  updateActionStatus,
} from "@/lib/discharge-actions";
import {
  buildActionTriggerContextFromRecord,
  getActionTriggeredBy,
} from "@/lib/action-triggers";
import { getActionDisplayTitle } from "@/lib/discharge-display";
import { getSourcesForAction } from "@/lib/clinical-methodology";
import type { DischargeActionTask, DischargeRecord } from "@/types/discharge-workflow";
import { AutoResizeTextarea } from "@/components/auto-resize-textarea";

type ActionWorkflowCardProps = {
  action: DischargeActionTask;
  record: DischargeRecord;
  allActions: DischargeActionTask[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onUpdate: (actions: DischargeActionTask[]) => void;
};

export function ActionWorkflowCard({
  action,
  record,
  allActions,
  expanded,
  onExpandedChange,
  onUpdate,
}: ActionWorkflowCardProps) {
  const title = getActionDisplayTitle(action.id, "Discharge action");
  const triggerContext = buildActionTriggerContextFromRecord(record);
  const triggeredBy = getActionTriggeredBy(action.id, triggerContext);
  const sources = getSourcesForAction(action.id);
  const isOutstanding = action.status !== "completed";

  return (
    <div
      className={`rounded-lg border p-3 text-sm sm:p-4 ${
        isOutstanding
          ? "border-amber-200 bg-amber-50/50"
          : "border-emerald-200 bg-emerald-50/40"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-700">{action.action}</p>
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Triggered by: </span>
            {triggeredBy}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Owner: </span>
            {getSuggestedOwnerLabel(action.suggestedOwner)}
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
          className="min-h-11 w-full shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium sm:w-auto sm:min-w-[9rem]"
          aria-label={`Status for ${title}`}
        >
          {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {sources.length > 0 || action.completedAt || action.escalatedAt ? (
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className="mt-2 min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          {expanded ? "Hide details" : "Details"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className="mt-2 min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
        >
          {expanded ? "Hide note" : "Add note"}
        </button>
      )}

      {expanded ? (
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
          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-800">Notes</span>
            <AutoResizeTextarea
              value={action.note ?? ""}
              onChange={(event) =>
                onUpdate(
                  updateActionNote(
                    allActions,
                    action.id,
                    sanitizeActionNoteDraft(event.target.value)
                  )
                )
              }
              onBlur={(event) =>
                onUpdate(
                  finalizeActionNote(allActions, action.id, event.target.value)
                )
              }
              maxLength={MAX_ACTION_NOTE_LENGTH}
              placeholder="What was done, who was contacted, or escalation context"
              aria-label={`Notes for ${title}`}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            />
            <span className="block text-xs text-slate-500">
              Saved on this device. Synthetic demo information only.
            </span>
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
