"use client";

import { useState } from "react";

import { DEMO_DISCHARGE_SCENARIO } from "@/lib/demo-patient";
import type { HeatRiskInput } from "@/lib/fortyguard";
import type {
  HomeSocialInput,
  MedicationRiskInput,
  PatientFactorsInput,
} from "@/lib/heat-discharge-risk";
import type { HeatRiskAssessmentResponse } from "@/types/heat-risk-api";

const DEMO_DISCHARGE_LOCATION: Pick<HeatRiskInput, "latitude" | "longitude" | "date" | "time"> = {
  latitude: 33.4484,
  longitude: -112.074,
  date: "2026-08-18",
  time: "14:00",
};

const EMPTY_PATIENT: PatientFactorsInput = {
  age: 0,
  cardiovascularDisease: false,
  heartFailure: false,
  kidneyDisease: false,
  respiratoryDisease: false,
  diabetes: false,
  cognitiveImpairment: false,
  limitedMobility: false,
};

const EMPTY_MEDICATIONS: MedicationRiskInput = {
  diuretic: false,
  aceArbArni: false,
  betaBlocker: false,
  anticholinergic: false,
  psychotropic: false,
  lithium: false,
  nsaid: false,
};

const EMPTY_HOME_SOCIAL: HomeSocialInput = {
  workingAirConditioning: false,
  livesAlone: false,
  reliableTransport: false,
  caregiverCheckInAvailable: false,
  powerDependentMedicalEquipment: false,
};

function createEmptyFormState() {
  return {
    latitude: "",
    longitude: "",
    date: "",
    time: "",
    age: "",
    patient: { ...EMPTY_PATIENT },
    medications: { ...EMPTY_MEDICATIONS },
    homeSocial: { ...EMPTY_HOME_SOCIAL },
  };
}

function createDemoFormState() {
  return {
    latitude: String(DEMO_DISCHARGE_LOCATION.latitude),
    longitude: String(DEMO_DISCHARGE_LOCATION.longitude),
    date: DEMO_DISCHARGE_LOCATION.date,
    time: DEMO_DISCHARGE_LOCATION.time,
    age: String(DEMO_DISCHARGE_SCENARIO.patient.age),
    patient: { ...DEMO_DISCHARGE_SCENARIO.patient },
    medications: { ...DEMO_DISCHARGE_SCENARIO.medications },
    homeSocial: { ...DEMO_DISCHARGE_SCENARIO.homeSocial },
  };
}

const PRIORITY_STYLES: Record<
  HeatRiskAssessmentResponse["riskLevel"],
  { badge: string; ring: string; label: string }
> = {
  routine: {
    badge: "bg-emerald-100 text-emerald-900 border-emerald-200",
    ring: "ring-emerald-200",
    label: "Routine",
  },
  enhanced: {
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    ring: "ring-amber-200",
    label: "Enhanced",
  },
  high: {
    badge: "bg-orange-100 text-orange-900 border-orange-200",
    ring: "ring-orange-200",
    label: "High",
  },
  urgent: {
    badge: "bg-red-100 text-red-900 border-red-200",
    ring: "ring-red-200",
    label: "Urgent",
  },
};

function CheckboxField({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked === true}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500 disabled:opacity-70"
      />
      <span>{label}</span>
    </label>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function DischargeAssessment() {
  const [form, setForm] = useState(createEmptyFormState);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HeatRiskAssessmentResponse | null>(null);
  const [checkedActions, setCheckedActions] = useState<Record<string, boolean>>(
    {}
  );

  function loadDemoPatient() {
    setForm(createDemoFormState());
    setDemoLoaded(true);
    setError(null);
  }

  function updatePatient(
    updater: (current: PatientFactorsInput) => PatientFactorsInput
  ) {
    setForm((current) => ({
      ...current,
      patient: updater(current.patient),
    }));
  }

  function updateMedications(
    updater: (current: MedicationRiskInput) => MedicationRiskInput
  ) {
    setForm((current) => ({
      ...current,
      medications: updater(current.medications),
    }));
  }

  function updateHomeSocial(
    updater: (current: HomeSocialInput) => HomeSocialInput
  ) {
    setForm((current) => ({
      ...current,
      homeSocial: updater(current.homeSocial),
    }));
  }

  function buildApiPayload(): HeatRiskInput | { error: string } {
    const parsedLatitude = Number(form.latitude);
    const parsedLongitude = Number(form.longitude);

    if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
      return { error: "Enter a valid discharge latitude between -90 and 90." };
    }

    if (
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      return { error: "Enter a valid discharge longitude between -180 and 180." };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) {
      return { error: "Enter a valid discharge date in YYYY-MM-DD format." };
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) {
      return { error: "Enter a valid discharge time in HH:MM format." };
    }

    return {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      date: form.date,
      time: form.time,
    };
  }

  async function handleAssess(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const payload = buildApiPayload();

    if ("error" in payload) {
      setError(payload.error);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/heat-risk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Unable to complete the discharge risk assessment."
        );
        return;
      }

      setResult(data as HeatRiskAssessmentResponse);
      setCheckedActions({});
    } catch {
      setError(
        "Unable to reach the assessment service. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const priorityStyle = result ? PRIORITY_STYLES[result.riskLevel] : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-sky-700">
              Discharge coordination
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              HeatSafe Discharge
            </h1>
            <p className="mt-3 max-w-3xl text-base text-slate-600">
              Assess environmental heat exposure at the planned US discharge
              location before hospital discharge. Live FortyGuard temperature
              data is combined with patient and home-risk factors to support
              coordinator workflow prioritization.
            </p>
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <p className="font-medium">Prototype decision support</p>
            <p className="mt-1 text-sky-800">No patient identifiers collected</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleAssess} className="space-y-6">
          <SectionCard
            title="Discharge location and timing"
            description="These fields are submitted to the live FortyGuard heat analysis service."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Latitude
                </span>
                <input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      latitude: event.target.value,
                    }))
                  }
                  placeholder="33.4484"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Longitude
                </span>
                <input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      longitude: event.target.value,
                    }))
                  }
                  placeholder="-112.0740"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Discharge date
                </span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">
                  Discharge time
                </span>
                <input
                  type="time"
                  value={form.time}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      time: event.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title="Patient and discharge profile"
            description={
              demoLoaded
                ? "Demo profile loaded from the configured discharge scenario. No names, MRNs, or addresses are stored."
                : "Enter the discharge coordination profile, or load the demo patient to pre-fill all fields."
            }
          >
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2 sm:max-w-xs">
                <span className="mb-1 block font-medium text-slate-700">Age</span>
                <input
                  type="number"
                  min={0}
                  value={form.age}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      age: event.target.value,
                      patient: {
                        ...current.patient,
                        age:
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value),
                      },
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 shadow-sm"
                />
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-800">
                  Clinical factors
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckboxField
                    label="Cardiovascular disease"
                    checked={form.patient.cardiovascularDisease}
                    onChange={(checked) =>
                      updatePatient((current) => ({
                        ...current,
                        cardiovascularDisease: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Heart failure"
                    checked={form.patient.heartFailure}
                    onChange={(checked) =>
                      updatePatient((current) => ({ ...current, heartFailure: checked }))
                    }
                  />
                  <CheckboxField
                    label="Kidney disease"
                    checked={form.patient.kidneyDisease}
                    onChange={(checked) =>
                      updatePatient((current) => ({
                        ...current,
                        kidneyDisease: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Respiratory disease"
                    checked={form.patient.respiratoryDisease}
                    onChange={(checked) =>
                      updatePatient((current) => ({
                        ...current,
                        respiratoryDisease: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Diabetes"
                    checked={form.patient.diabetes}
                    onChange={(checked) =>
                      updatePatient((current) => ({ ...current, diabetes: checked }))
                    }
                  />
                  <CheckboxField
                    label="Cognitive impairment"
                    checked={form.patient.cognitiveImpairment}
                    onChange={(checked) =>
                      updatePatient((current) => ({
                        ...current,
                        cognitiveImpairment: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Limited mobility"
                    checked={form.patient.limitedMobility}
                    onChange={(checked) =>
                      updatePatient((current) => ({
                        ...current,
                        limitedMobility: checked,
                      }))
                    }
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-800">
                  Heat-sensitive medications
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckboxField
                    label="Diuretic"
                    checked={form.medications.diuretic}
                    onChange={(checked) =>
                      updateMedications((current) => ({ ...current, diuretic: checked }))
                    }
                  />
                  <CheckboxField
                    label="ACE inhibitor / ARB / ARNI"
                    checked={form.medications.aceArbArni}
                    onChange={(checked) =>
                      updateMedications((current) => ({
                        ...current,
                        aceArbArni: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Beta-blocker"
                    checked={form.medications.betaBlocker}
                    onChange={(checked) =>
                      updateMedications((current) => ({
                        ...current,
                        betaBlocker: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Anticholinergic"
                    checked={form.medications.anticholinergic}
                    onChange={(checked) =>
                      updateMedications((current) => ({
                        ...current,
                        anticholinergic: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Psychotropic"
                    checked={form.medications.psychotropic}
                    onChange={(checked) =>
                      updateMedications((current) => ({
                        ...current,
                        psychotropic: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Lithium"
                    checked={form.medications.lithium}
                    onChange={(checked) =>
                      updateMedications((current) => ({ ...current, lithium: checked }))
                    }
                  />
                  <CheckboxField
                    label="NSAID"
                    checked={form.medications.nsaid}
                    onChange={(checked) =>
                      updateMedications((current) => ({ ...current, nsaid: checked }))
                    }
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-800">
                  Home and social factors
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CheckboxField
                    label="Working air conditioning"
                    checked={form.homeSocial.workingAirConditioning}
                    onChange={(checked) =>
                      updateHomeSocial((current) => ({
                        ...current,
                        workingAirConditioning: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Lives alone"
                    checked={form.homeSocial.livesAlone}
                    onChange={(checked) =>
                      updateHomeSocial((current) => ({ ...current, livesAlone: checked }))
                    }
                  />
                  <CheckboxField
                    label="Reliable transport available"
                    checked={form.homeSocial.reliableTransport}
                    onChange={(checked) =>
                      updateHomeSocial((current) => ({
                        ...current,
                        reliableTransport: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Caregiver check-in available"
                    checked={form.homeSocial.caregiverCheckInAvailable}
                    onChange={(checked) =>
                      updateHomeSocial((current) => ({
                        ...current,
                        caregiverCheckInAvailable: checked,
                      }))
                    }
                  />
                  <CheckboxField
                    label="Power-dependent medical equipment"
                    checked={form.homeSocial.powerDependentMedicalEquipment}
                    onChange={(checked) =>
                      updateHomeSocial((current) => ({
                        ...current,
                        powerDependentMedicalEquipment: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadDemoPatient}
              className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Load demo patient
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-sky-400"
            >
              {loading ? "Assessing discharge risk..." : "Assess discharge risk"}
            </button>
          </div>

          {loading ? (
            <div
              role="status"
              className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"
            >
              <p className="font-medium">Retrieving live FortyGuard heat data</p>
              <p className="mt-1 text-sky-800">
                This may take up to two minutes while environmental analysis
                completes. Please keep this page open.
              </p>
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
            >
              <p className="font-medium">Assessment could not be completed</p>
              <p className="mt-1">{error}</p>
            </div>
          ) : null}
        </form>

        <aside className="space-y-6">
          {result && priorityStyle ? (
            <>
              <section
                className={`rounded-xl border bg-white p-6 shadow-sm ring-1 ${priorityStyle.ring}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                      Discharge heat risk
                    </p>
                    <div className="mt-2 flex items-end gap-3">
                      <p className="text-5xl font-bold text-slate-900">
                        {result.totalRiskScore}
                      </p>
                      <p className="pb-2 text-sm text-slate-500">/ 100</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-sm font-semibold ${priorityStyle.badge}`}
                  >
                    {priorityStyle.label} priority
                  </span>
                </div>

                {result.fortyGuardDataUsed ? (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    Live FortyGuard environmental data was used for this
                    assessment.
                  </div>
                ) : null}
              </section>

              <SectionCard title="FortyGuard environmental data">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-slate-500">Mean temperature</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-900">
                      {result.environmentalData.meanTemperatureC} °C
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-slate-500">Maximum temperature</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-900">
                      {result.environmentalData.maximumTemperatureC} °C
                    </dd>
                  </div>
                  {result.environmentalData.minimumTemperatureC !== null ? (
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-slate-500">Minimum temperature</dt>
                      <dd className="mt-1 text-lg font-semibold text-slate-900">
                        {result.environmentalData.minimumTemperatureC} °C
                      </dd>
                    </div>
                  ) : null}
                  <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
                    <dt className="text-slate-500">Discharge coordinates</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {result.environmentalData.dischargeLocation.latitude},{" "}
                      {result.environmentalData.dischargeLocation.longitude}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-slate-500">Analysis date</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {result.environmentalData.analysisDate}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-slate-500">Analysis time</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {result.environmentalData.analysisTime}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">
                  {result.environmentalData.dataSource}
                </p>
              </SectionCard>

              <SectionCard title="Triggered risk factors">
                {result.triggeredRiskFactors.length > 0 ? (
                  <ul className="space-y-2">
                    {result.triggeredRiskFactors.map((factor) => (
                      <li
                        key={factor}
                        className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        {factor}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-600">
                    No additional risk factors were triggered for this profile.
                  </p>
                )}
              </SectionCard>

              <SectionCard title="Recommended discharge actions">
                <ul className="space-y-2">
                  {result.recommendedDischargeActions.map((action) => (
                    <li
                      key={action}
                      className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checkedActions[action] === true}
                        onChange={(event) =>
                          setCheckedActions((current) => ({
                            ...current,
                            [action]: event.target.checked,
                          }))
                        }
                        aria-label={`Coordinator checklist item: ${action}`}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-500"
                      />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-medium">Clinical decision-support disclaimer</p>
                <p className="mt-2 leading-relaxed">{result.disclaimer}</p>
              </section>
            </>
          ) : (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
              <p className="font-medium text-slate-900">Assessment results</p>
              <p className="mt-2">
                Load the demo patient, confirm discharge location and timing,
                then run the assessment to view live FortyGuard heat data, risk
                score, triggered factors, and coordinator actions.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
