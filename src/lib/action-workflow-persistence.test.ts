import { describe, expect, it } from "vitest";

import {
  MAX_ACTION_NOTE_LENGTH,
  mergeActionTasksOnReassessment,
  normalizeActionNoteForSave,
  sanitizeActionNoteDraft,
  updateActionNote,
  updateActionStatus,
} from "@/lib/discharge-actions";
import {
  createInitialPersistedState,
  upsertDischargeRecord,
} from "@/lib/discharge-storage";
import { updateWorkflowActions } from "@/lib/discharge-record-state";
import { createDischargeRecordFromDemoCase, DEMO_CASE_A } from "@/lib/demo-cases";
import {
  computeTextareaHeight,
  TEXTAREA_MAX_HEIGHT_PX,
  TEXTAREA_MIN_HEIGHT_PX,
} from "@/lib/auto-resize-textarea";

describe("action note persistence", () => {
  it("preserves notes when collapsing and reopening via stored record state", () => {
    const record = createDischargeRecordFromDemoCase(DEMO_CASE_A);
    const actions = updateActionNote(
      record.actions.length > 0
        ? record.actions
        : [
            {
              id: "medication-review",
              action: "Review medications",
              suggestedOwner: "pharmacist" as const,
              status: "pending" as const,
              createdAt: "2026-08-18T10:00:00.000Z",
            },
          ],
      "medication-review",
      "Coordinator contacted pharmacy"
    );

    const next = updateWorkflowActions(record, actions);

    expect(next.actions.find((action) => action.id === "medication-review")?.note).toBe(
      "Coordinator contacted pharmacy"
    );
  });

  it("persists notes across navigation and reload through discharge storage", () => {
    const initial = createInitialPersistedState("2026-08-18T10:00:00.000Z");
    const record = initial.discharges["HS-001"]!;
    const actions = updateActionNote(
      [
        {
          id: "follow-up-24-48",
          action: "Follow up",
          suggestedOwner: "discharge coordinator",
          status: "pending",
          createdAt: "2026-08-18T10:00:00.000Z",
        },
      ],
      "follow-up-24-48",
      "Distinctive synthetic note for persistence test"
    );
    const saved = upsertDischargeRecord(initial, updateWorkflowActions(record, actions));

    const reloaded = saved.discharges["HS-001"]?.actions.find(
      (action) => action.id === "follow-up-24-48"
    );

    expect(reloaded?.note).toBe("Distinctive synthetic note for persistence test");
  });

  it("persists status changes across navigation and reload", () => {
    const initial = createInitialPersistedState("2026-08-18T10:00:00.000Z");
    const record = initial.discharges["HS-001"]!;
    const actions = updateActionStatus(
      [
        {
          id: "follow-up-24-48",
          action: "Follow up",
          suggestedOwner: "discharge coordinator",
          status: "pending",
          createdAt: "2026-08-18T10:00:00.000Z",
        },
      ],
      "follow-up-24-48",
      "in_progress"
    );
    const saved = upsertDischargeRecord(initial, updateWorkflowActions(record, actions));

    expect(
      saved.discharges["HS-001"]?.actions.find((action) => action.id === "follow-up-24-48")?.status
    ).toBe("in_progress");
  });

  it("does not attach an old note to a regenerated action with a different id", () => {
    const existing = [
      {
        id: "medication-review",
        action: "Old action",
        suggestedOwner: "pharmacist" as const,
        status: "in_progress" as const,
        createdAt: "2026-08-18T10:00:00.000Z",
        note: "Old note",
      },
    ];

    const merged = mergeActionTasksOnReassessment(
      existing,
      [
        {
          id: "transport-planning",
          action: "New action",
          suggestedOwner: "discharge coordinator",
        },
      ],
      "2026-08-18T14:00:00.000Z"
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("transport-planning");
    expect(merged[0]?.note).toBeUndefined();
  });

  it("preserves applicable saved notes after reassessment", () => {
    const existing = [
      {
        id: "medication-review",
        action: "Old wording",
        suggestedOwner: "pharmacist" as const,
        status: "in_progress" as const,
        createdAt: "2026-08-18T10:00:00.000Z",
        note: "Still relevant note",
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
      ],
      "2026-08-18T14:00:00.000Z"
    );

    expect(merged[0]?.note).toBe("Still relevant note");
    expect(merged[0]?.status).toBe("in_progress");
  });

  it("keeps draft characters while typing without trimming prematurely", () => {
    const actions = updateActionNote(
      [
        {
          id: "follow-up-24-48",
          action: "Follow up",
          suggestedOwner: "discharge coordinator",
          status: "pending",
          createdAt: "2026-08-18T10:00:00.000Z",
        },
      ],
      "follow-up-24-48",
      "  trailing space preserved  "
    );

    expect(actions[0]?.note).toBe("  trailing space preserved  ");
    expect(normalizeActionNoteForSave("  trailing space preserved  ")).toBe(
      "trailing space preserved"
    );
  });

  it("enforces the note length limit consistently", () => {
    const longNote = "a".repeat(MAX_ACTION_NOTE_LENGTH + 25);
    const draft = sanitizeActionNoteDraft(longNote);

    expect(draft.length).toBe(MAX_ACTION_NOTE_LENGTH);
    expect(normalizeActionNoteForSave(draft)?.length).toBeLessThanOrEqual(
      MAX_ACTION_NOTE_LENGTH
    );
  });
});

describe("auto-resize textarea constraints", () => {
  it("caps growth at approximately 240px", () => {
    expect(computeTextareaHeight(500, TEXTAREA_MIN_HEIGHT_PX, TEXTAREA_MAX_HEIGHT_PX)).toBe(
      TEXTAREA_MAX_HEIGHT_PX
    );
  });

  it("uses a sensible minimum height", () => {
    expect(computeTextareaHeight(20, TEXTAREA_MIN_HEIGHT_PX, TEXTAREA_MAX_HEIGHT_PX)).toBe(
      TEXTAREA_MIN_HEIGHT_PX
    );
  });

  it("allows internal scrolling once the maximum is reached", () => {
    const height = computeTextareaHeight(500, TEXTAREA_MIN_HEIGHT_PX, TEXTAREA_MAX_HEIGHT_PX);

    expect(height).toBe(TEXTAREA_MAX_HEIGHT_PX);
    expect(500).toBeGreaterThan(TEXTAREA_MAX_HEIGHT_PX);
  });
});
