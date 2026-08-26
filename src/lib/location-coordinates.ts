import {
  ARIZONA_COVERAGE_ERROR,
  findArizonaLocationPreset,
  isSupportedArizonaLocation,
} from "@/lib/arizona-locations";
import type { DischargeLocation } from "@/types/discharge-workflow";

export const CUSTOM_COORDINATES_LABEL = "Custom coordinates";

export const OUTSIDE_ARIZONA_ERROR =
  "Location outside supported area. This hackathon deployment currently supports Arizona destinations.";

export function validateLatitude(latitude: number): string | null {
  if (!Number.isFinite(latitude)) {
    return "Latitude must be a number.";
  }

  if (latitude < -90 || latitude > 90) {
    return "Latitude must be between -90 and 90.";
  }

  return null;
}

export function validateLongitude(longitude: number): string | null {
  if (!Number.isFinite(longitude)) {
    return "Longitude must be a number.";
  }

  if (longitude < -180 || longitude > 180) {
    return "Longitude must be between -180 and 180.";
  }

  return null;
}

export function validateArizonaDestinationCoordinates(
  latitude: number,
  longitude: number
): string | null {
  const latitudeError = validateLatitude(latitude);
  if (latitudeError) {
    return latitudeError;
  }

  const longitudeError = validateLongitude(longitude);
  if (longitudeError) {
    return longitudeError;
  }

  if (!isSupportedArizonaLocation(latitude, longitude)) {
    return OUTSIDE_ARIZONA_ERROR;
  }

  return null;
}

export function resolveLocationLabelFromCoordinates(
  latitude: number,
  longitude: number
): string {
  const preset = findArizonaLocationPreset(latitude, longitude);

  return preset?.label ?? CUSTOM_COORDINATES_LABEL;
}

export function buildLocationFromCoordinates(
  latitude: number,
  longitude: number
): DischargeLocation {
  return {
    latitude,
    longitude,
    label: resolveLocationLabelFromCoordinates(latitude, longitude),
  };
}

export function buildLocationFromPreset(preset: {
  label: string;
  latitude: number;
  longitude: number;
}): DischargeLocation {
  return {
    label: preset.label,
    latitude: preset.latitude,
    longitude: preset.longitude,
  };
}

export function buildLocationFromGeocodeResult(result: {
  label: string;
  latitude: number;
  longitude: number;
}): DischargeLocation | { error: string } {
  const validationError = validateArizonaDestinationCoordinates(
    result.latitude,
    result.longitude
  );

  if (validationError) {
    return { error: validationError };
  }

  return {
    label: result.label,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

export function validateDestinationForAssessment(destination: DischargeLocation): string | null {
  return validateArizonaDestinationCoordinates(
    destination.latitude,
    destination.longitude
  );
}

export function getDestinationAssessmentBlockedMessage(
  destination: DischargeLocation
): string {
  const error = validateDestinationForAssessment(destination);

  if (error === OUTSIDE_ARIZONA_ERROR) {
    return "Choose a valid Arizona destination before running HeatSafe.";
  }

  if (error) {
    return "Enter valid Arizona destination coordinates before running HeatSafe.";
  }

  return ARIZONA_COVERAGE_ERROR;
}
