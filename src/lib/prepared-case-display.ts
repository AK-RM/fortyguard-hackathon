import { isBuiltinDemoId } from "@/lib/demo-storage-migration";
import { formatLocalDateTimeDisplay } from "@/lib/discharge-timezone";
import { TRANSPORT_MODE_LABELS } from "@/lib/transition-exposure";
import type { DischargeRecord } from "@/types/discharge-workflow";

export function isStandardizedDemoCase(record: DischargeRecord): boolean {
  return isBuiltinDemoId(record.id);
}

function listPatientConditions(record: DischargeRecord): string[] {
  const { patient } = record.profile;
  const items: string[] = [];

  if (patient.heartFailure) items.push("Heart failure");
  if (patient.kidneyDisease) items.push("CKD");
  if (patient.cardiovascularDisease) items.push("Cardiovascular disease");
  if (patient.respiratoryDisease) items.push("Respiratory disease");
  if (patient.diabetes) items.push("Diabetes");
  if (patient.cognitiveImpairment) items.push("Cognitive impairment");
  if (patient.limitedMobility) items.push("Limited mobility");

  return items.length > 0 ? items : ["None documented"];
}

function listMedications(record: DischargeRecord): string[] {
  const { medications } = record.profile;
  const items: string[] = [];

  if (medications.diuretic) items.push("Diuretic");
  if (medications.aceArbArni) items.push("ACE inhibitor / ARB / ARNI");
  if (medications.betaBlocker) items.push("Beta-blocker");
  if (medications.anticholinergic) items.push("Anticholinergic");
  if (medications.psychotropic) items.push("Psychotropic");
  if (medications.lithium) items.push("Lithium");
  if (medications.nsaid) items.push("NSAID");

  return items.length > 0 ? items : ["None flagged"];
}

function listHomeSupport(record: DischargeRecord): string[] {
  const { homeSocial } = record.profile;
  const items: string[] = [];

  items.push(
    homeSocial.workingAirConditioning
      ? "Working air conditioning"
      : "No functioning AC"
  );
  items.push(homeSocial.livesAlone ? "Lives alone" : "Not living alone");
  items.push(
    homeSocial.caregiverCheckInAvailable
      ? "Caregiver check-in available"
      : "No caregiver check-in"
  );
  if (homeSocial.powerDependentMedicalEquipment) {
    items.push("Power-dependent medical equipment");
  }

  return items;
}

export type PreparedCaseSection = {
  title: string;
  items: string[];
};

export function buildPreparedCaseSections(record: DischargeRecord): PreparedCaseSection[] {
  const departure = formatLocalDateTimeDisplay(
    { date: record.journey.date, time: record.journey.time },
    record.journey.timeZone
  );

  return [
    {
      title: "Patient",
      items: [`${record.profile.patient.age} years`],
    },
    {
      title: "Major conditions",
      items: listPatientConditions(record),
    },
    {
      title: "Relevant medications",
      items: listMedications(record),
    },
    {
      title: "Home & support",
      items: listHomeSupport(record),
    },
    {
      title: "Journey",
      items: [
        `${TRANSPORT_MODE_LABELS[record.journey.transportMode]} · ${record.journey.durationMinutes} min`,
        `Leaving ${record.origin.label}`,
      ],
    },
    {
      title: "Destination / arrival",
      items: [record.destination.label, `Expected departure ${departure}`],
    },
  ];
}
