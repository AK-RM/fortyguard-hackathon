import type { DischargeAction, SuggestedOwner } from "@/lib/heat-discharge-risk";
import type { DischargeActionTask } from "@/types/discharge-workflow";

export function createActionTasksFromRecommendations(
  recommendedActions: DischargeAction[],
  createdAt = new Date().toISOString()
): DischargeActionTask[] {
  return recommendedActions.map((action) => ({
    id: action.id,
    action: action.action,
    suggestedOwner: action.suggestedOwner,
    status: "pending",
    createdAt,
  }));
}

export function mergeActionTasksOnReassessment(
  existingActions: DischargeActionTask[],
  recommendedActions: DischargeAction[],
  createdAt = new Date().toISOString()
): DischargeActionTask[] {
  const existingById = new Map(existingActions.map((action) => [action.id, action]));

  return recommendedActions.map((recommended) => {
    const existing = existingById.get(recommended.id);

    if (existing) {
      return {
        ...existing,
        action: recommended.action,
        suggestedOwner: recommended.suggestedOwner,
      };
    }

    return {
      id: recommended.id,
      action: recommended.action,
      suggestedOwner: recommended.suggestedOwner,
      status: "pending",
      createdAt,
    };
  });
}

export function countOutstandingActions(actions: DischargeActionTask[]): number {
  return actions.filter((action) => action.status !== "completed").length;
}

export function updateActionStatus(
  actions: DischargeActionTask[],
  actionId: string,
  status: DischargeActionTask["status"],
  note?: string
): DischargeActionTask[] {
  const timestamp = new Date().toISOString();

  return actions.map((action) => {
    if (action.id !== actionId) {
      return action;
    }

    return {
      ...action,
      status,
      note: note ?? action.note,
      completedAt: status === "completed" ? timestamp : undefined,
      escalatedAt: status === "escalated" ? timestamp : undefined,
    };
  });
}

export function formatActionTimestamp(
  iso: string,
  timeZone = "America/Phoenix"
): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function updateActionNote(
  actions: DischargeActionTask[],
  actionId: string,
  note: string
): DischargeActionTask[] {
  return actions.map((action) =>
    action.id === actionId ? { ...action, note: note.trim() || undefined } : action
  );
}

export function getSuggestedOwnerLabel(owner: SuggestedOwner): string {
  return owner.charAt(0).toUpperCase() + owner.slice(1);
}

export const ACTION_STATUS_LABELS: Record<DischargeActionTask["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  escalated: "Escalated",
};
