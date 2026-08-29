import { isSupportedArizonaLocation, ARIZONA_COVERAGE_ERROR } from "@/lib/arizona-locations";
import { isValidIanaTimeZone } from "@/lib/discharge-timezone";
import type {
  HomeSocialInput,
  MedicationRiskInput,
  PatientFactorsInput,
} from "@/lib/heat-discharge-risk";
import type { HeatRiskAssessmentRequest } from "@/types/heat-risk-api";
import type { DischargeLocation, DischargeJourney, TransportMode } from "@/types/discharge-workflow";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_AGE = 120;

const TRANSPORT_MODES = [
  "ac_private_vehicle",
  "taxi_rideshare",
  "ambulance",
  "public_bus",
  "walking",
  "other",
] as const satisfies readonly TransportMode[];

const PATIENT_BOOLEAN_FIELDS = [
  "cardiovascularDisease",
  "heartFailure",
  "kidneyDisease",
  "respiratoryDisease",
  "diabetes",
  "cognitiveImpairment",
  "limitedMobility",
] as const satisfies ReadonlyArray<keyof Omit<PatientFactorsInput, "age">>;

const MEDICATION_FIELDS = [
  "diuretic",
  "aceArbArni",
  "betaBlocker",
  "anticholinergic",
  "psychotropic",
  "lithium",
  "nsaid",
] as const satisfies ReadonlyArray<keyof MedicationRiskInput>;

const HOME_SOCIAL_FIELDS = [
  "workingAirConditioning",
  "livesAlone",
  "reliableTransport",
  "caregiverCheckInAvailable",
  "powerDependentMedicalEquipment",
] as const satisfies ReadonlyArray<keyof HomeSocialInput>;

export type ParsedHeatRiskRequest = HeatRiskAssessmentRequest | { error: string };

function parseStrictInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): number | { error: string } {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { error: `${fieldName} must be an integer between ${min} and ${max}.` };
  }

  if (value < min || value > max) {
    return { error: `${fieldName} must be an integer between ${min} and ${max}.` };
  }

  return value;
}

function parseStrictBoolean(
  value: unknown,
  fieldName: string
): boolean | { error: string } {
  if (typeof value !== "boolean") {
    return { error: `${fieldName} must be a boolean.` };
  }

  return value;
}

function parseBooleanRecord<T extends Record<string, boolean>>(
  value: unknown,
  objectName: string,
  fields: readonly (keyof T & string)[]
): T | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: `${objectName} must be an object.` };
  }

  const record = value as Record<string, unknown>;
  const parsed = {} as T;

  for (const field of fields) {
    if (!(field in record)) {
      return { error: `${objectName}.${field} is required.` };
    }

    const booleanValue = parseStrictBoolean(record[field], `${objectName}.${field}`);

    if (typeof booleanValue === "object") {
      return booleanValue;
    }

    parsed[field as keyof T] = booleanValue as T[keyof T];
  }

  return parsed;
}

function parseLocation(
  value: unknown,
  fieldName: string
): DischargeLocation | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: `${fieldName} must be an object.` };
  }

  const record = value as Record<string, unknown>;

  if (typeof record.label !== "string" || record.label.trim().length === 0) {
    return { error: `${fieldName}.label must be a non-empty string.` };
  }

  if (typeof record.latitude !== "number" || !Number.isFinite(record.latitude)) {
    return { error: `${fieldName}.latitude must be a finite number.` };
  }

  if (record.latitude < -90 || record.latitude > 90) {
    return { error: `${fieldName}.latitude must be between -90 and 90.` };
  }

  if (typeof record.longitude !== "number" || !Number.isFinite(record.longitude)) {
    return { error: `${fieldName}.longitude must be a finite number.` };
  }

  if (record.longitude < -180 || record.longitude > 180) {
    return { error: `${fieldName}.longitude must be between -180 and 180.` };
  }

  if (!isSupportedArizonaLocation(record.latitude, record.longitude)) {
    return { error: ARIZONA_COVERAGE_ERROR };
  }

  return {
    label: record.label.trim(),
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

function parseJourney(value: unknown): DischargeJourney | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "journey must be an object." };
  }

  const record = value as Record<string, unknown>;

  if (typeof record.date !== "string" || !DATE_PATTERN.test(record.date)) {
    return { error: "journey.date must be a string in YYYY-MM-DD format." };
  }

  const [year, month, day] = record.date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return { error: "journey.date must be a valid calendar date." };
  }

  if (typeof record.time !== "string" || !TIME_PATTERN.test(record.time)) {
    return { error: "journey.time must be a string in HH:MM format." };
  }

  if (typeof record.timeZone !== "string" || record.timeZone.trim().length === 0) {
    return {
      error: "journey.timeZone must be a non-empty IANA time zone for the discharge destination.",
    };
  }

  if (!isValidIanaTimeZone(record.timeZone)) {
    return { error: "journey.timeZone must be a valid IANA time zone identifier." };
  }

  if (
    typeof record.transportMode !== "string" ||
    !TRANSPORT_MODES.includes(record.transportMode as TransportMode)
  ) {
    return { error: "journey.transportMode must be a supported transport mode." };
  }

  const parsedDuration = parseStrictInteger(
    record.durationMinutes,
    "journey.durationMinutes",
    1,
    480
  );

  if (typeof parsedDuration === "object") {
    return parsedDuration;
  }

  return {
    date: record.date,
    time: record.time,
    timeZone: record.timeZone.trim(),
    transportMode: record.transportMode as TransportMode,
    durationMinutes: parsedDuration,
  };
}

function parsePatient(value: unknown): PatientFactorsInput | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "patient must be an object." };
  }

  const record = value as Record<string, unknown>;

  if (!("age" in record)) {
    return { error: "patient.age is required." };
  }

  if (typeof record.age !== "number" || !Number.isFinite(record.age)) {
    return { error: "patient.age must be a finite number." };
  }

  const parsedAge = parseStrictInteger(record.age, "patient.age", 0, MAX_AGE);

  if (typeof parsedAge === "object") {
    return parsedAge;
  }

  const booleans = parseBooleanRecord<Omit<PatientFactorsInput, "age">>(
    record,
    "patient",
    PATIENT_BOOLEAN_FIELDS
  );

  if ("error" in booleans) {
    return booleans;
  }

  return {
    age: parsedAge,
    ...booleans,
  };
}

function parseMedications(value: unknown): MedicationRiskInput | { error: string } {
  return parseBooleanRecord<MedicationRiskInput>(
    value,
    "medications",
    MEDICATION_FIELDS
  );
}

function parseHomeSocial(value: unknown): HomeSocialInput | { error: string } {
  return parseBooleanRecord<HomeSocialInput>(
    value,
    "homeSocial",
    HOME_SOCIAL_FIELDS
  );
}

export function parseHeatRiskRequest(body: unknown): ParsedHeatRiskRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Request body must be a JSON object." };
  }

  const { origin, destination, journey, patient, medications, homeSocial, forceRefresh } =
    body as Record<string, unknown>;

  const parsedOrigin = parseLocation(origin, "origin");

  if ("error" in parsedOrigin) {
    return parsedOrigin;
  }

  const parsedDestination = parseLocation(destination, "destination");

  if ("error" in parsedDestination) {
    return parsedDestination;
  }

  const parsedJourney = parseJourney(journey);

  if ("error" in parsedJourney) {
    return parsedJourney;
  }

  const parsedPatient = parsePatient(patient);

  if ("error" in parsedPatient) {
    return parsedPatient;
  }

  const parsedMedications = parseMedications(medications);

  if ("error" in parsedMedications) {
    return parsedMedications;
  }

  const parsedHomeSocial = parseHomeSocial(homeSocial);

  if ("error" in parsedHomeSocial) {
    return parsedHomeSocial;
  }

  return {
    origin: parsedOrigin,
    destination: parsedDestination,
    journey: parsedJourney,
    patient: parsedPatient,
    medications: parsedMedications,
    homeSocial: parsedHomeSocial,
    ...(forceRefresh === true ? { forceRefresh: true } : {}),
  };
}
