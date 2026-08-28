export const HEATSAFE_RUN_ASSESSMENT_BUTTON_ID = "heatsafe-run-assessment";
export const HEATSAFE_ASSESSMENT_STATUS_ID = "heatsafe-assessment-status";

export type InvalidFieldTarget = {
  error: string | null | undefined;
  elementId: string;
};

export function getFirstInvalidFieldTarget(
  targets: InvalidFieldTarget[]
): InvalidFieldTarget | null {
  return targets.find((target) => Boolean(target.error)) ?? null;
}

export function scrollToField(elementId: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const element = document.getElementById(elementId);

  if (!element) {
    return;
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" });

  if (element instanceof HTMLElement && typeof element.focus === "function") {
    element.focus({ preventScroll: true });
  }
}

export function scrollToAssessmentStatus(): void {
  scrollToField(HEATSAFE_ASSESSMENT_STATUS_ID);
}
