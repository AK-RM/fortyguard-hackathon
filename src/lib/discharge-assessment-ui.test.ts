import { describe, expect, it } from "vitest";

import {
  getFirstInvalidFieldTarget,
} from "@/lib/discharge-assessment-ui";

describe("discharge assessment UI helpers", () => {
  it("returns the first invalid field target in priority order", () => {
    expect(
      getFirstInvalidFieldTarget([
        { error: null, elementId: "destination" },
        { error: "Enter age.", elementId: "age" },
        { error: "Enter duration.", elementId: "duration" },
      ])
    ).toEqual({ error: "Enter age.", elementId: "age" });
  });

  it("returns null when all fields are valid", () => {
    expect(
      getFirstInvalidFieldTarget([
        { error: null, elementId: "destination" },
        { error: null, elementId: "age" },
      ])
    ).toBeNull();
  });
});

describe("discharge workspace assessment button placement", () => {
  it("defines one primary run button after Home & support", async () => {
    const source = await import("fs/promises").then((fs) =>
      fs.readFile(
        new URL("../components/discharge-workspace.tsx", import.meta.url),
        "utf8"
      )
    );

    const homeSupportIndex = source.indexOf('title="Home & support"');
    const formRunButtonIndex = source.indexOf(
      '{showEditDetails || !isDemoCase\n            ? renderPrimaryAssessmentButton()'
    );
    const dischargeDetailsIndex = source.indexOf(
      '{hasCurrentResult ? "Edit discharge details" : "Discharge details"}'
    );

    expect(homeSupportIndex).toBeGreaterThan(-1);
    expect(formRunButtonIndex).toBeGreaterThan(homeSupportIndex);
    expect(source.match(/renderPrimaryAssessmentButton/g)).toHaveLength(3);
    expect(source).toContain("renderPrimaryAssessmentButton");
    expect(source).toContain("scrollToAssessmentStatus");
    expect(source).toContain("scrollToFirstInvalidField");
    expect(source).toContain("HEATSAFE_ASSESSMENT_STATUS_ID");
    expect(source).toContain("HEATSAFE_RUN_ASSESSMENT_BUTTON_ID");
    expect(source).toContain("assessmentBlocked");
    expect(source).not.toMatch(
      /Complete discharge details, then run assessment[\s\S]{0,400}Run HeatSafe assessment/
    );
    expect(formRunButtonIndex).toBeGreaterThan(dischargeDetailsIndex);
  });

  it("keeps the primary button full-width on mobile and right-aligned on desktop", async () => {
    const source = await import("fs/promises").then((fs) =>
      fs.readFile(
        new URL("../components/discharge-workspace.tsx", import.meta.url),
        "utf8"
      )
    );

    expect(source).toContain("w-full");
    expect(source).toContain("sm:justify-end");
    expect(source).toContain("sm:w-auto");
    expect(source).toContain("sm:min-w-[16rem]");
  });

  it("preserves loading and disabled submission guards on the primary button", async () => {
    const source = await import("fs/promises").then((fs) =>
      fs.readFile(
        new URL("../components/discharge-workspace.tsx", import.meta.url),
        "utf8"
      )
    );

    expect(source).toContain('disabled={loading || (pendingIsCurrent && !loading)}');
    expect(source).toContain("if (assessmentBlocked)");
    expect(source).toContain('"Running assessment…"');
    expect(source).toContain('"Processing…"');
    expect(source).toContain("Submitting assessment…");
  });
});
