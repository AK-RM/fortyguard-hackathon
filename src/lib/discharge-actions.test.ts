import { describe, expect, it } from "vitest";

import {
  countOutstandingActions,
  createActionTasksFromRecommendations,
  mergeActionTasksOnReassessment,
  updateActionStatus,
} from "./discharge-actions";

describe("discharge action workflow", () => {
  it("creates pending tasks from recommended actions", () => {
    const tasks = createActionTasksFromRecommendations([
      {
        id: "medication-review",
        action: "Review medications",
        suggestedOwner: "pharmacist",
      },
    ]);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe("pending");
    expect(tasks[0]?.suggestedOwner).toBe("pharmacist");
  });

  it("counts escalated actions as outstanding", () => {
    const tasks = createActionTasksFromRecommendations([
      {
        id: "follow-up-24-48",
        action: "Follow up",
        suggestedOwner: "discharge coordinator",
      },
    ]);

    const escalated = updateActionStatus(tasks, "follow-up-24-48", "escalated");

    expect(countOutstandingActions(escalated)).toBe(1);
    expect(escalated[0]?.escalatedAt).toBeTruthy();
    expect(escalated[0]?.completedAt).toBeUndefined();
  });

  it("sets completedAt only for completed tasks", () => {
    const tasks = createActionTasksFromRecommendations([
      {
        id: "follow-up-24-48",
        action: "Follow up",
        suggestedOwner: "discharge coordinator",
      },
    ]);

    const completed = updateActionStatus(tasks, "follow-up-24-48", "completed");
    expect(completed[0]?.completedAt).toBeTruthy();
    expect(completed[0]?.escalatedAt).toBeUndefined();
  });

  it("clears completedAt when a completed task returns to pending", () => {
    const tasks = updateActionStatus(
      createActionTasksFromRecommendations([
        {
          id: "follow-up-24-48",
          action: "Follow up",
          suggestedOwner: "discharge coordinator",
        },
      ]),
      "follow-up-24-48",
      "completed"
    );

    const reopened = updateActionStatus(tasks, "follow-up-24-48", "pending");

    expect(reopened[0]?.completedAt).toBeUndefined();
    expect(reopened[0]?.escalatedAt).toBeUndefined();
  });

  it("preserves existing task status when the same recommendation is regenerated", () => {
    const existing = [
      {
        id: "medication-review",
        action: "Old wording",
        suggestedOwner: "pharmacist" as const,
        status: "in_progress" as const,
        createdAt: "2026-08-18T10:00:00.000Z",
      },
    ];

    const merged = mergeActionTasksOnReassessment(
      existing,
      [
        {
          id: "medication-review",
          action: "Updated wording",
          suggestedOwner: "pharmacist",
        },
        {
          id: "follow-up-24-48",
          action: "Follow up",
          suggestedOwner: "discharge coordinator",
        },
      ],
      "2026-08-18T14:00:00.000Z"
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]?.status).toBe("in_progress");
    expect(merged[0]?.action).toBe("Updated wording");
    expect(merged[1]?.status).toBe("pending");
  });
});
