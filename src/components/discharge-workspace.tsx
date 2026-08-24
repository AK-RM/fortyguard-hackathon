"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { JourneyMap } from "@/components/journey-map";
import { ScoreExplainer } from "@/components/score-explainer";
import {
  CheckboxField,
  PRIORITY_STYLES,
  PriorityBadge,
  SectionCard,
} from "@/components/ui/clinical-ui";
import { useDischargeStorage } from "@/hooks/use-discharge-storage";
import { useEnvironmentalAssessment } from "@/hooks/use-environmental-assessment";
import {
  ARIZONA_LOCATION_PRESETS,
  PHOENIX_DEMO_PRESET,
  getPhoenixDemoDateTime,
} from "@/lib/arizona-locations";
import {
  ACTION_STATUS_LABELS,
  updateActionStatus,
} from "@/lib/discharge-actions";
import {
  getDemoCaseByPreset,
} from "@/lib/demo-cases";
import {
  isAssessmentCurrent,
  isEnvironmentalRefreshCurrent,
  isPendingAssessmentCurrent,
  updateAssessmentInputs,
  updateWorkflowActions,
} from "@/lib/discharge-record-state";
import {
  upsertDischargeRecord,
} from "@/lib/discharge-storage";
import { CLINICIAN_VALIDATION } from "@/lib/clinician-validation";
import {
  TRANSPORT_MODE_LABELS,
  TRANSITION_EXPOSURE_ASSUMPTIONS,
} from "@/lib/transition-exposure";
import type { HeatRiskAssessmentRequest } from "@/types/heat-risk-api";
import type { DischargeRecord, TransportMode } from "@/types/discharge-workflow";

const TRANSPORT_MODES = Object.keys(TRANSPORT_MODE_LABELS) as TransportMode[];

function applyDemoCaseToRecord(
  record: DischargeRecord,
  preset: "A" | "B" | "C"
): DischargeRecord {
  const demoCase = getDemoCaseByPreset(preset);

  return {
    ...updateAssessmentInputs(record, {
      origin: { ...demoCase.origin },
      destination: { ...demoCase.destination },
      journey: { ...demoCase.journey },
      profile: {
        patient: { ...demoCase.profile.patient },
        medications: { ...demoCase.profile.medications },
        homeSocial: { ...demoCase.profile.homeSocial },
      },
    }),
    casePreset: preset,
  };
}

function buildRequest(record: DischargeRecord): HeatRiskAssessmentRequest {
  return {
    origin: record.origin,
    destination: record.destination,
    journey: record.journey,
    patient: record.profile.patient,
    medications: record.profile.medications,
    homeSocial: record.profile.homeSocial,
  };
}

export default function DischargeWorkspace({ dischargeId }: { dischargeId: string }) {
  const { state, ready, persist } = useDischargeStorage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScoreExplainer, setShowScoreExplainer] = useState(false);
  const [showSafetyPanel, setShowSafetyPanel] = useState(false);

  const record = state?.discharges[dischargeId] ?? null;

  const priorityStyle = useMemo(() => {
    const priority = record?.assessment?.riskLevel ?? null;
    return priority ? PRIORITY_STYLES[priority] : null;
  }, [record?.assessment?.riskLevel]);

  const assessmentIsCurrent = record ? isAssessmentCurrent(record) : false;
  const pendingIsCurrent = record ? isPendingAssessmentCurrent(record) : false;
  const refreshIsCurrent = record ? isEnvironmentalRefreshCurrent(record) : false;

  const { submitAssessment, checkPendingStatus } = useEnvironmentalAssessment({
    record,
    state,
    persist,
    buildRequest,
  });

  function persistRecord(next: DischargeRecord) {
    if (!state) {
      return;
    }

    persist(
      upsertDischargeRecord(state, {
        ...next,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  function updateInputs(
    updates: Parameters<typeof updateAssessmentInputs>[1]
  ) {
    if (!record) {
      return;
    }

    persistRecord(updateAssessmentInputs(record, updates));
  }

  function updateActions(actions: DischargeRecord["actions"]) {
    if (!record) {
      return;
    }

    persistRecord(updateWorkflowActions(record, actions));
  }

  function loadPreset(preset: "A" | "B" | "C") {
    if (!record) {
      return;
    }

    persistRecord(applyDemoCaseToRecord(record, preset));
    setError(null);
  }

  function applyLocationPreset(
    target: "origin" | "destination",
    presetId: string
  ) {
    if (!record) {
      return;
    }

    const preset = ARIZONA_LOCATION_PRESETS.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    updateInputs({
      [target]: {
        label: preset.label,
        latitude: preset.latitude,
        longitude: preset.longitude,
      },
      ...(target === "destination"
        ? {
            journey: {
              ...record.journey,
              timeZone: preset.timeZone,
            },
          }
        : {}),
    });
  }

  function applyPhoenixDemoDateTime() {
    if (!record) {
      return;
    }

    const demoDateTime = getPhoenixDemoDateTime();

    updateInputs({
      destination: {
        label: PHOENIX_DEMO_PRESET.label,
        latitude: PHOENIX_DEMO_PRESET.latitude,
        longitude: PHOENIX_DEMO_PRESET.longitude,
      },
      journey: {
        ...record.journey,
        ...demoDateTime,
      },
    });
  }

  async function runAssessment(options?: { forceRefresh?: boolean }) {
    if (!record) {
      return;
    }

    setLoading(true);
    setError(null);

    const result = await submitAssessment(options);

    if (!result.ok) {
      setError(result.error);
    }

    setLoading(false);
  }

  if (!ready || !state) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-slate-600">
        Loading discharge workspace…
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <Link href="/" className="text-sm font-medium text-sky-700">
          ← Today&apos;s discharges
        </Link>
        <p className="mt-4 text-sm text-slate-600">
          Discharge record `{dischargeId}` was not found in local workflow storage.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link href="/" className="text-sm font-medium text-sky-700 hover:text-sky-800">
            ← Today&apos;s discharges
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Discharge workspace · {record.id}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Synthetic patient profile · Arizona hackathon deployment · workflow
            state stored locally in this browser
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["A", "B", "C"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => loadPreset(preset)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Load Case {preset}
            </button>
          ))}
          <button
            type="button"
            onClick={applyPhoenixDemoDateTime}
            className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-100"
          >
            Validated Phoenix demo
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <SectionCard
            title="Hospital → journey → home"
            description="Origin and destination support Arizona locations in this hackathon deployment. Journey duration is coordinator-entered — not a calculated route."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Origin / hospital</h3>
                <input
                  value={record.origin.label}
                  onChange={(event) =>
                    updateInputs({
                      origin: { ...record.origin, label: event.target.value },
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={record.origin.latitude}
                    onChange={(event) =>
                      updateInputs({
                        origin: {
                          ...record.origin,
                          latitude: Number(event.target.value),
                        },
                      })
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Latitude"
                  />
                  <input
                    type="number"
                    step="any"
                    value={record.origin.longitude}
                    onChange={(event) =>
                      updateInputs({
                        origin: {
                          ...record.origin,
                          longitude: Number(event.target.value),
                        },
                      })
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Longitude"
                  />
                </div>
                <select
                  onChange={(event) => applyLocationPreset("origin", event.target.value)}
                  defaultValue=""
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Apply Arizona origin preset
                  </option>
                  {ARIZONA_LOCATION_PRESETS.map((preset) => (
                    <option key={`origin-${preset.id}`} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Post-discharge destination
                </h3>
                <input
                  value={record.destination.label}
                  onChange={(event) =>
                    updateInputs({
                      destination: {
                        ...record.destination,
                        label: event.target.value,
                      },
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={record.destination.latitude}
                    onChange={(event) =>
                      updateInputs({
                        destination: {
                          ...record.destination,
                          latitude: Number(event.target.value),
                        },
                      })
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    value={record.destination.longitude}
                    onChange={(event) =>
                      updateInputs({
                        destination: {
                          ...record.destination,
                          longitude: Number(event.target.value),
                        },
                      })
                    }
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <select
                  onChange={(event) =>
                    applyLocationPreset("destination", event.target.value)
                  }
                  defaultValue=""
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Apply Arizona destination preset
                  </option>
                  {ARIZONA_LOCATION_PRESETS.map((preset) => (
                    <option key={`destination-${preset.id}`} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Departure date</span>
                <input
                  type="date"
                  value={record.journey.date}
                  onChange={(event) =>
                    updateInputs({
                      journey: { ...record.journey, date: event.target.value },
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Departure time</span>
                <input
                  type="time"
                  value={record.journey.time}
                  onChange={(event) =>
                    updateInputs({
                      journey: { ...record.journey, time: event.target.value },
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Transport mode</span>
                <select
                  value={record.journey.transportMode}
                  onChange={(event) =>
                    updateInputs({
                      journey: {
                        ...record.journey,
                        transportMode: event.target.value as TransportMode,
                      },
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                >
                  {TRANSPORT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {TRANSPORT_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Journey duration (min)</span>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={record.journey.durationMinutes}
                  onChange={(event) =>
                    updateInputs({
                      journey: {
                        ...record.journey,
                        durationMinutes: Number(event.target.value),
                      },
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="mt-4">
              <JourneyMap origin={record.origin} destination={record.destination} />
            </div>
          </SectionCard>

          <SectionCard title="Patient and discharge profile">
            <label className="mb-4 block text-sm">
              <span className="mb-1 block font-medium">Age</span>
              <input
                type="number"
                min={0}
                max={120}
                value={record.profile.patient.age}
                onChange={(event) =>
                  updateInputs({
                    profile: {
                      ...record.profile,
                      patient: {
                        ...record.profile.patient,
                        age: Number(event.target.value),
                      },
                    },
                  })
                }
                className="w-32 rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Clinical factors</h3>
                {(
                  [
                    ["cardiovascularDisease", "Cardiovascular disease"],
                    ["heartFailure", "Heart failure"],
                    ["kidneyDisease", "Kidney disease"],
                    ["respiratoryDisease", "Respiratory disease"],
                    ["diabetes", "Diabetes"],
                    ["cognitiveImpairment", "Cognitive impairment"],
                    ["limitedMobility", "Limited mobility"],
                  ] as const
                ).map(([key, label]) => (
                  <CheckboxField
                    key={key}
                    label={label}
                    checked={record.profile.patient[key]}
                    onChange={(checked) =>
                      updateInputs({
                        profile: {
                          ...record.profile,
                          patient: { ...record.profile.patient, [key]: checked },
                        },
                      })
                    }
                  />
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Heat-sensitive medications</h3>
                {(
                  [
                    ["diuretic", "Diuretic"],
                    ["aceArbArni", "ACE inhibitor / ARB / ARNI"],
                    ["betaBlocker", "Beta-blocker"],
                    ["anticholinergic", "Anticholinergic"],
                    ["psychotropic", "Psychotropic"],
                    ["lithium", "Lithium"],
                    ["nsaid", "NSAID"],
                  ] as const
                ).map(([key, label]) => (
                  <CheckboxField
                    key={key}
                    label={label}
                    checked={record.profile.medications[key]}
                    onChange={(checked) =>
                      updateInputs({
                        profile: {
                          ...record.profile,
                          medications: {
                            ...record.profile.medications,
                            [key]: checked,
                          },
                        },
                      })
                    }
                  />
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Home / social support</h3>
                {(
                  [
                    ["workingAirConditioning", "Working air conditioning"],
                    ["livesAlone", "Lives alone"],
                    ["reliableTransport", "Reliable transport available"],
                    ["caregiverCheckInAvailable", "Caregiver check-in available"],
                    [
                      "powerDependentMedicalEquipment",
                      "Power-dependent medical equipment",
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <CheckboxField
                    key={key}
                    label={label}
                    checked={record.profile.homeSocial[key]}
                    onChange={(checked) =>
                      updateInputs({
                        profile: {
                          ...record.profile,
                          homeSocial: {
                            ...record.profile.homeSocial,
                            [key]: checked,
                          },
                        },
                      })
                    }
                  />
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => runAssessment()}
                disabled={loading || (pendingIsCurrent && !loading)}
                className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
              >
                {loading
                  ? "Submitting HeatSafe assessment…"
                  : pendingIsCurrent
                    ? "FortyGuard processing…"
                    : "Run HeatSafe assessment"}
              </button>
              {assessmentIsCurrent && record.assessment?.environmentalAvailable ? (
                <button
                  type="button"
                  onClick={() => runAssessment({ forceRefresh: true })}
                  disabled={loading || refreshIsCurrent}
                  className="rounded-md border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-60"
                >
                  Refresh from FortyGuard
                </button>
              ) : null}
              {pendingIsCurrent || refreshIsCurrent ? (
                <button
                  type="button"
                  onClick={() =>
                    void checkPendingStatus({
                      isRefresh: refreshIsCurrent,
                    })
                  }
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Check status
                </button>
              ) : null}
            </div>

            {loading ? (
              <p className="mt-3 text-sm text-slate-600">
                Submitting the environmental query. HeatSafe returns immediately when
                verified data is available, or enters a transparent processing state
                while FortyGuard completes asynchronously.
              </p>
            ) : null}
            {record.assessmentStatus === "processing" && record.pendingAssessment ? (
              <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
                <p className="font-medium">
                  FortyGuard environmental intelligence processing
                </p>
                <p className="mt-1">
                  Activity ID:{" "}
                  <span className="font-mono text-xs">
                    {record.pendingAssessment.activityId}
                  </span>
                </p>
                <p className="mt-1">
                  You can navigate away, open another discharge, or refresh the browser.
                  HeatSafe will resume this same activity when you return.
                </p>
              </div>
            ) : null}
            {refreshIsCurrent && record.environmentalRefresh ? (
              <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
                <p className="font-medium">
                  Refreshing environmental intelligence from FortyGuard…
                </p>
                <p className="mt-1">
                  Activity ID:{" "}
                  <span className="font-mono text-xs">
                    {record.environmentalRefresh.activityId}
                  </span>
                </p>
                <p className="mt-1">
                  The currently available verified result remains visible below until
                  this refresh completes.
                </p>
              </div>
            ) : null}
            {record.reassessmentRequired ? (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <p className="font-medium">Inputs changed. Run assessment again.</p>
                <p className="mt-1">
                  The prior FortyGuard activity no longer matches the current patient
                  inputs and will not finalize this discharge.
                </p>
              </div>
            ) : null}
            {record.environmentalRefreshFailure ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {record.environmentalRefreshFailure}
              </p>
            ) : null}
            {error ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}
          </SectionCard>
        </div>

        <aside className="space-y-6">
          {record.assessmentStatus === "stale" ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Inputs changed — rerun HeatSafe assessment</p>
              <p className="mt-1">
                Assessment inputs no longer match the last environmental query. Previous
                scores and FortyGuard results are hidden until you rerun the assessment.
              </p>
            </div>
          ) : null}

          {record.assessment?.environmentalAvailable === false &&
          record.assessmentStatus === "environmental_unavailable" &&
          !loading &&
          !pendingIsCurrent ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
              <p className="font-semibold">Environmental assessment unavailable</p>
              <p className="mt-2">
                {record.environmentalFailure ??
                  "FortyGuard did not return usable environmental data. HeatSafe will not produce a reassuring environmental priority without that data."}
              </p>
            </div>
          ) : null}

          {assessmentIsCurrent && record.assessment?.environmentalAvailable ? (
            <>
              {record.assessment.riskLevel === "urgent" ? (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                  <p className="font-semibold">Urgent workflow escalation</p>
                  <p className="mt-1">
                    Coordinate immediate discharge-support review. This is workflow
                    prioritization — not a clinical outcome prediction.
                  </p>
                </div>
              ) : null}

              <section
                className={`rounded-xl border bg-white p-6 shadow-sm ring-1 ${priorityStyle?.ring ?? "ring-slate-200"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                        Workflow prioritization score
                      </p>
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        Not clinically validated
                      </span>
                    </div>
                    <div className="mt-2 flex items-end gap-3">
                      <p className="text-5xl font-bold text-slate-900">
                        {record.assessment.totalRiskScore}
                      </p>
                      <p className="pb-2 text-sm text-slate-500">/ 100</p>
                    </div>
                  </div>
                  <PriorityBadge priority={record.assessment.riskLevel} />
                </div>
                <button
                  type="button"
                  onClick={() => setShowScoreExplainer((current) => !current)}
                  className="mt-4 text-sm font-medium text-sky-700 hover:text-sky-800"
                >
                  {showScoreExplainer ? "Hide" : "Why"} {record.assessment.totalRiskScore}?
                </button>
                {showScoreExplainer ? (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <ScoreExplainer
                      score={record.assessment.totalRiskScore ?? 0}
                      rawScore={record.assessment.rawRiskScore ?? 0}
                      contributions={record.assessment.scoreContributions}
                    />
                  </div>
                ) : null}
              </section>

              <SectionCard
                title="FortyGuard environmental intelligence"
                description="Destination environmental data for the local hourly window containing estimated arrival. Source: FortyGuard heatmap API (Single Hour)."
              >
                {record.assessment.destinationEnvironmental ? (
                  <div className="space-y-3 text-sm">
                    {record.assessedAt ? (
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                        Assessed at {new Date(record.assessedAt).toLocaleString()} for the
                        current input fingerprint.
                      </p>
                    ) : null}
                    <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950">
                      {
                        record.assessment.destinationEnvironmental
                          .environmentalProvenanceLabel
                      }
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase text-slate-500">Mean temp</p>
                        <p className="text-2xl font-semibold text-slate-900">
                          {record.assessment.destinationEnvironmental.meanTemperatureC} °C
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase text-slate-500">Max temp</p>
                        <p className="text-2xl font-semibold text-slate-900">
                          {record.assessment.destinationEnvironmental.maximumTemperatureC} °C
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase text-slate-500">Min temp</p>
                        <p className="text-2xl font-semibold text-slate-900">
                          {record.assessment.destinationEnvironmental.minimumTemperatureC ??
                            "—"}{" "}
                          {record.assessment.destinationEnvironmental.minimumTemperatureC
                            ? "°C"
                            : ""}
                        </p>
                      </div>
                    </div>
                    <dl className="space-y-1 text-slate-700">
                      <div>
                        <dt className="inline font-medium">Destination: </dt>
                        <dd className="inline">
                          {record.assessment.destinationEnvironmental.label}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Planned departure: </dt>
                        <dd className="inline">
                          {
                            record.assessment.destinationEnvironmental
                              .departureDateTimeLocal.display
                          }
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Configured duration: </dt>
                        <dd className="inline">
                          {record.assessment.destinationEnvironmental.journeyDurationMinutes}{" "}
                          min
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Estimated arrival: </dt>
                        <dd className="inline">
                          {
                            record.assessment.destinationEnvironmental
                              .estimatedArrivalDateTimeLocal.display
                          }
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">FortyGuard hourly window: </dt>
                        <dd className="inline">
                          {
                            record.assessment.destinationEnvironmental
                              .fortyGuardQueryWindowLocal
                          }
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Query hour (local): </dt>
                        <dd className="inline">
                          {
                            record.assessment.destinationEnvironmental
                              .fortyGuardQueryHourLocal.display
                          }{" "}
                          ({record.assessment.destinationEnvironmental.timeZone})
                        </dd>
                      </div>
                      <p className="text-slate-600">
                        {
                          record.assessment.destinationEnvironmental
                            .fortyGuardSingleHourNote
                        }
                      </p>
                      <div>
                        <dt className="inline font-medium">Heatmap cells: </dt>
                        <dd className="inline">
                          {record.assessment.destinationEnvironmental.cellCount}
                        </dd>
                      </div>
                      {record.assessment.destinationEnvironmental.environmentalProvenanceNote ? (
                        <p className="text-slate-600">
                          {
                            record.assessment.destinationEnvironmental
                              .environmentalProvenanceNote
                          }
                        </p>
                      ) : null}
                      <div>
                        <dt className="inline font-medium">Activity ID: </dt>
                        <dd className="inline font-mono text-xs">
                          {
                            record.assessment.destinationEnvironmental
                              .fortyGuardActivityId
                          }
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">AOI: </dt>
                        <dd className="inline">
                          ~{record.assessment.destinationEnvironmental.aoiSideMeters} m
                          square polygon centered on destination coordinates
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : null}

                {record.assessment.transitionEnvironmental ? (
                  <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-950">
                    <p className="font-medium">Transition exposure (workflow heuristic)</p>
                    <p className="mt-1">
                      {record.assessment.transitionEnvironmental.transportLabel} ·{" "}
                      {record.assessment.transitionEnvironmental.durationMinutes} min
                      configured duration · +{" "}
                      {record.assessment.transitionEnvironmental.transitionPoints} workflow
                      points
                    </p>
                    <p className="mt-1 text-sky-900">
                      {record.assessment.transitionEnvironmental.transitionExplanation}
                    </p>
                    <p className="mt-2 text-xs text-sky-900">
                      {record.assessment.transitionEnvironmental.transitionAssumptions}
                    </p>
                  </div>
                ) : null}
              </SectionCard>

              <SectionCard title="HeatSafe-generated discharge considerations">
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {record.assessment.heatsafeAdditions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Assigned discharge interventions">
                <div className="space-y-3">
                  {record.actions.map((action) => (
                    <div
                      key={action.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium text-slate-900">{action.action}</p>
                        <select
                          value={action.status}
                          onChange={(event) =>
                            updateActions(
                              updateActionStatus(
                                record.actions,
                                action.id,
                                event.target.value as typeof action.status
                              )
                            )
                          }
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                        >
                          {Object.entries(ACTION_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-2 text-slate-600">
                        Owner: {action.suggestedOwner}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          ) : null}

          <SectionCard title={CLINICIAN_VALIDATION.title}>
            <p className="text-sm text-slate-600">{CLINICIAN_VALIDATION.summary}</p>
            {CLINICIAN_VALIDATION.status === "evaluation_in_progress" ? (
              <p className="mt-3 text-sm font-medium text-slate-800">
                Evaluation in progress
              </p>
            ) : (
              <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <div>
                  <dt className="font-medium">Clinicians</dt>
                  <dd>{CLINICIAN_VALIDATION.metrics.clinicianCount ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Standardized case reviews</dt>
                  <dd>{CLINICIAN_VALIDATION.metrics.caseReviewCount ?? "—"}</dd>
                </div>
                <div>
                  <dt className="font-medium">Additional consideration surfaced</dt>
                  <dd>
                    {CLINICIAN_VALIDATION.metrics.additionalConsiderationPercent ?? "—"}
                    {CLINICIAN_VALIDATION.metrics.additionalConsiderationPercent !== null
                      ? "%"
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Action reprioritization</dt>
                  <dd>
                    {CLINICIAN_VALIDATION.metrics.reprioritizedActionPercent ?? "—"}
                    {CLINICIAN_VALIDATION.metrics.reprioritizedActionPercent !== null
                      ? "%"
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Mean actionability (/5)</dt>
                  <dd>
                    {CLINICIAN_VALIDATION.metrics.meanActionabilityOutOfFive ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Pilot support</dt>
                  <dd>
                    {CLINICIAN_VALIDATION.metrics.pilotSupportPercent ?? "—"}
                    {CLINICIAN_VALIDATION.metrics.pilotSupportPercent !== null ? "%" : ""}
                  </dd>
                </div>
              </dl>
            )}
          </SectionCard>

          <SectionCard title="Safety & data provenance">
            <button
              type="button"
              onClick={() => setShowSafetyPanel((current) => !current)}
              className="text-sm font-medium text-sky-700"
            >
              {showSafetyPanel ? "Hide details" : "Show details"}
            </button>
            {showSafetyPanel ? (
              <dl className="mt-3 space-y-2 text-sm text-slate-700">
                <div>
                  <dt className="font-medium">Transition modifier</dt>
                  <dd>{TRANSITION_EXPOSURE_ASSUMPTIONS}</dd>
                </div>
                <div>
                  <dt className="font-medium">Environmental source</dt>
                  <dd>
                    FortyGuard heatmap API (destination query at estimated arrival time)
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Scoring type</dt>
                  <dd>
                    Deterministic workflow-prioritization heuristic — not outcome
                    prediction
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Clinical validation</dt>
                  <dd>Not clinically validated</dd>
                </div>
                <div>
                  <dt className="font-medium">PHI status</dt>
                  <dd>
                    Synthetic patient IDs only; no names, MRNs, addresses, or direct
                    identifiers requested
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Clinician oversight</dt>
                  <dd>
                    Treating clinician retains full responsibility; no automatic
                    medication or hydration changes
                  </dd>
                </div>
              </dl>
            ) : null}
          </SectionCard>

          {assessmentIsCurrent && record.assessment ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {record.assessment.disclaimer}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
