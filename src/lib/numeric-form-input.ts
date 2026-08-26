export const MAX_AGE = 120;
export const MIN_JOURNEY_DURATION_MINUTES = 1;
export const MAX_JOURNEY_DURATION_MINUTES = 480;

export function isIncompleteNumericDraft(value: string): boolean {
  const trimmed = value.trim();

  return trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.";
}

export function parseNumericDraft(value: string): number | null {
  if (isIncompleteNumericDraft(value)) {
    return null;
  }

  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function validateAgeInput(value: string): string | null {
  if (isIncompleteNumericDraft(value)) {
    return "Enter the patient's age.";
  }

  const parsed = parseNumericDraft(value);

  if (parsed === null) {
    return "Enter the patient's age.";
  }

  if (!Number.isInteger(parsed)) {
    return "Enter a whole-number age.";
  }

  if (parsed < 0 || parsed > MAX_AGE) {
    return `Age must be between 0 and ${MAX_AGE}.`;
  }

  return null;
}

export function validateDurationInput(value: string): string | null {
  if (isIncompleteNumericDraft(value)) {
    return "Enter a valid journey duration.";
  }

  const parsed = parseNumericDraft(value);

  if (parsed === null) {
    return "Enter a valid journey duration.";
  }

  if (!Number.isInteger(parsed)) {
    return "Enter a valid journey duration in whole minutes.";
  }

  if (
    parsed < MIN_JOURNEY_DURATION_MINUTES ||
    parsed > MAX_JOURNEY_DURATION_MINUTES
  ) {
    return `Journey duration must be between ${MIN_JOURNEY_DURATION_MINUTES} and ${MAX_JOURNEY_DURATION_MINUTES} minutes.`;
  }

  return null;
}

export function validateLatitudeDraft(value: string): string | null {
  if (isIncompleteNumericDraft(value)) {
    return "Enter a latitude value.";
  }

  const parsed = parseNumericDraft(value);

  if (parsed === null) {
    return "Enter a valid latitude.";
  }

  if (parsed < -90 || parsed > 90) {
    return "Latitude must be between -90 and 90.";
  }

  return null;
}

export function validateLongitudeDraft(value: string): string | null {
  if (isIncompleteNumericDraft(value)) {
    return "Enter a longitude value.";
  }

  const parsed = parseNumericDraft(value);

  if (parsed === null) {
    return "Enter a valid longitude.";
  }

  if (parsed < -180 || parsed > 180) {
    return "Longitude must be between -180 and 180.";
  }

  return null;
}

export function parseCoordinateDraftPair(
  latitudeInput: string,
  longitudeInput: string
): { latitude: number; longitude: number } | { error: string } {
  const latitudeError = validateLatitudeDraft(latitudeInput);

  if (latitudeError) {
    return { error: latitudeError };
  }

  const longitudeError = validateLongitudeDraft(longitudeInput);

  if (longitudeError) {
    return { error: longitudeError };
  }

  const latitude = parseNumericDraft(latitudeInput);
  const longitude = parseNumericDraft(longitudeInput);

  if (latitude === null || longitude === null) {
    return { error: "Enter valid destination coordinates." };
  }

  return { latitude, longitude };
}
