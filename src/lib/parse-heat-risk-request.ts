import { isValidIanaTimeZone } from "@/lib/discharge-timezone";
import {
  HACKATHON_DEMO_ENVIRONMENT_ERROR,
  isSupportedHackathonDemoEnvironment,
} from "@/lib/discharge-locations";
import type {
  HomeSocialInput,
  MedicationRiskInput,
  PatientFactorsInput,
} from "@/lib/heat-discharge-risk";
import type { HeatRiskAssessmentRequest } from "@/types/heat-risk-api";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_AGE = 120;

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

  if (record.age < 0 || record.age > MAX_AGE) {
    return { error: `patient.age must be between 0 and ${MAX_AGE}.` };
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
    age: record.age,
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

  const {
    latitude,
    longitude,
    date,
    time,
    timeZone,
    patient,
    medications,
    homeSocial,
  } = body as Record<string, unknown>;

  if (typeof latitude !== "number" || !Number.isFinite(latitude)) {
    return { error: "latitude must be a finite number." };
  }

  if (latitude < -90 || latitude > 90) {
    return { error: "latitude must be between -90 and 90." };
  }

  if (typeof longitude !== "number" || !Number.isFinite(longitude)) {
    return { error: "longitude must be a finite number." };
  }

  if (longitude < -180 || longitude > 180) {
    return { error: "longitude must be between -180 and 180." };
  }

  if (typeof date !== "string" || !DATE_PATTERN.test(date)) {
    return { error: "date must be a string in YYYY-MM-DD format." };
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return { error: "date must be a valid calendar date." };
  }

  if (typeof time !== "string" || !TIME_PATTERN.test(time)) {
    return { error: "time must be a string in HH:MM format." };
  }

  if (typeof timeZone !== "string" || timeZone.trim().length === 0) {
    return {
      error:
        "timeZone must be a non-empty IANA time zone for the discharge destination.",
    };
  }

  if (!isValidIanaTimeZone(timeZone)) {
    return { error: "timeZone must be a valid IANA time zone identifier." };
  }

  if (
    !isSupportedHackathonDemoEnvironment({
      latitude,
      longitude,
      date,
      time,
      timeZone,
    })
  ) {
    return { error: HACKATHON_DEMO_ENVIRONMENT_ERROR };
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
    latitude,
    longitude,
    date,
    time,
    timeZone,
    patient: parsedPatient,
    medications: parsedMedications,
    homeSocial: parsedHomeSocial,
  };
}
