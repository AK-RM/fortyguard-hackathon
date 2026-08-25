"use client";

import Link from "next/link";
import { useState } from "react";

import { AssessmentSummaryPanel } from "@/components/assessment-summary-panel";
import { JourneyMap } from "@/components/journey-map";
import { ActionWorkflowCard } from "@/components/action-workflow-card";
import { ClinicalBasisPanel } from "@/components/clinical-basis-panel";
import { EnvironmentalExposurePanel } from "@/components/environmental-exposure-panel";
import { ScoreExplainer } from "@/components/score-explainer";
import {
  CheckboxField,
  SectionCard,
} from "@/components/ui/clinical-ui";
import { useDischargeStorage } from "@/hooks/use-discharge-storage";
import { useEnvironmentalAssessment } from "@/hooks/use-environmental-assessment";
import {
  ARIZONA_LOCATION_PRESETS,
} from "@/lib/arizona-locations";
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
  buildPatientSummaryLine,
  getCaseHeaderLabel,
} from "@/lib/discharge-display";
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
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);

  const record = state?.discharges[dischargeId] ?? null;

  const caseHeaderLabel = record ? getCaseHeaderLabel(record) : null;
  const patientSummaryLine = record ? buildPatientSummaryLine(record) : "";

  const assessmentIsCurrent = record ? isAssessmentCurrent(record) : false;
  const pendingIsCurrent = record ? isPendingAssessmentCurrent(record) : false;
  const refreshIsCurrent = record ? isEnvironmentalRefreshCurrent(record) : false;

  const hasCurrentResult = Boolean(
    record &&
      assessmentIsCurrent &&
      record.assessment?.environmentalAvailable &&
      record.assessment.riskLevel
  );

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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 border-b border-slate-200 pb-5">
        <Link href="/" className="text-sm font-medium text-sky-700 hover:text-sky-800">
          ← Today&apos;s discharges
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{record.id}</h1>
            {caseHeaderLabel ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {caseHeaderLabel}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-slate-700">{patientSummaryLine}</p>
            <p className="mt-1 text-sm text-slate-600">
              {record.destination.label} · {record.journey.date} {record.journey.time}
            </p>
          </div>
          <details className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium text-slate-800">
              Load demo case
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["A", "B", "C"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => loadPreset(preset)}
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Case {preset}
                </button>
              ))}
            </div>
          </details>
        </div>
      </header>

      {hasCurrentResult && record.assessment ? (
        <div className="mb-6 space-y-6">
          <AssessmentSummaryPanel record={record} />
          <section
            id="discharge-actions"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <h2 className="text-lg font-bold text-slate-900">Actions</h2>
            <p className="mt-1 text-sm text-slate-600">
              Assign, complete, or escalate discharge follow-up.
            </p>
            <div className="mt-4 space-y-3">
              {record.actions.map((action) => (
                <ActionWorkflowCard
                  key={action.id}
                  action={action}
                  allActions={record.actions}
                  onUpdate={updateActions}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {!hasCurrentResult ? (
          <p className="mb-3 text-sm text-slate-600">
            Review discharge details, then run assessment.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => runAssessment()}
            disabled={loading || (pendingIsCurrent && !loading)}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60 sm:w-auto"
          >
            {loading
              ? "Running assessment…"
              : pendingIsCurrent
                ? "Processing…"
                : hasCurrentResult
                  ? "Update assessment"
                  : "Run HeatSafe assessment"}
          </button>
          {assessmentIsCurrent && record.assessment?.environmentalAvailable ? (
            <button
              type="button"
              onClick={() => runAssessment({ forceRefresh: true })}
              disabled={loading || refreshIsCurrent}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-900 hover:bg-sky-50 disabled:opacity-60 sm:w-auto"
            >
              {refreshIsCurrent ? "Refreshing…" : "Refresh environmental data"}
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
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 sm:w-auto"
            >
              Check status
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Submitting assessment…</p>
        ) : null}
        {record.assessmentStatus === "processing" && record.pendingAssessment ? (
          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
            <p className="font-medium">Environmental data processing</p>
            <p className="mt-1">
              You can leave and return — assessment will resume automatically.
            </p>
            <p className="mt-2 break-all font-mono text-xs text-sky-800">
              {record.pendingAssessment.activityId}
            </p>
          </div>
        ) : null}
        {refreshIsCurrent && record.environmentalRefresh ? (
          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
            <p className="font-medium">Refreshing environmental data…</p>
            <p className="mt-1">Current result stays visible until refresh completes.</p>
            <p className="mt-2 break-all font-mono text-xs text-sky-800">
              {record.environmentalRefresh.activityId}
            </p>
          </div>
        ) : null}
        {record.reassessmentRequired ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <p className="font-medium">Assessment needs updating</p>
            <p className="mt-1">Discharge details changed since last assessment.</p>
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <details
            className="group rounded-xl border border-slate-200 bg-white shadow-sm"
            open={!hasCurrentResult}
          >
            <summary className="cursor-pointer list-none px-5 py-4 text-base font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
              {hasCurrentResult ? "Review discharge details" : "Discharge details"}
            </summary>
            <div className="space-y-6 border-t border-slate-100 px-5 pb-5 pt-4">
          <SectionCard title="Discharge">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Leaving from</h3>
                <input
                  value={record.origin.label}
                  onChange={(event) =>
                    updateInputs({
                      origin: { ...record.origin, label: event.target.value },
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  onChange={(event) => applyLocationPreset("origin", event.target.value)}
                  defaultValue=""
                  className="w-full min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Arizona location preset
                  </option>
                  {ARIZONA_LOCATION_PRESETS.map((preset) => (
                    <option key={`origin-${preset.id}`} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Destination</h3>
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
                <select
                  onChange={(event) =>
                    applyLocationPreset("destination", event.target.value)
                  }
                  defaultValue=""
                  className="w-full min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Arizona location preset
                  </option>
                  {ARIZONA_LOCATION_PRESETS.map((preset) => (
                    <option key={`destination-${preset.id}`} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedLocation((current) => !current)}
              className="mt-3 min-h-11 text-sm font-medium text-sky-700 hover:text-sky-800"
            >
              {showAdvancedLocation ? "Hide coordinates" : "Edit coordinates"}
            </button>
            {showAdvancedLocation ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
                    placeholder="Origin lat"
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
                    placeholder="Origin lng"
                  />
                </div>
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
                    placeholder="Dest lat"
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
                    placeholder="Dest lng"
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Expected departure date</span>
                <input
                  type="date"
                  value={record.journey.date}
                  onChange={(event) =>
                    updateInputs({
                      journey: { ...record.journey, date: event.target.value },
                    })
                  }
                  className="w-full min-h-11 rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Expected departure time</span>
                <input
                  type="time"
                  value={record.journey.time}
                  onChange={(event) =>
                    updateInputs({
                      journey: { ...record.journey, time: event.target.value },
                    })
                  }
                  className="w-full min-h-11 rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Journey">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block font-medium">Transport</span>
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
                  className="w-full min-h-11 rounded-md border border-slate-300 px-3 py-2"
                >
                  {TRANSPORT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {TRANSPORT_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium">Duration (minutes)</span>
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

          <SectionCard title="Patient">
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
                className="w-full max-w-[8rem] min-h-11 rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Major conditions</h3>
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
          </SectionCard>

          <SectionCard title="Medications">
            <div className="space-y-2">
              <h3 className="sr-only">Heat-sensitive medications</h3>
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
          </SectionCard>

          <SectionCard title="Home & support">
            <div className="space-y-2">
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
          </SectionCard>
            </div>
          </details>
        </div>

        <aside className="space-y-6">
          {record.assessmentStatus === "stale" ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Assessment needs updating</p>
              <p className="mt-1">
                Discharge details changed. Run assessment again to refresh priority and
                actions.
              </p>
            </div>
          ) : null}

          {record.assessment?.environmentalAvailable === false &&
          record.assessmentStatus === "environmental_unavailable" &&
          !loading &&
          !pendingIsCurrent ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
              <p className="font-semibold">Environmental data unavailable</p>
              <p className="mt-2">
                {record.environmentalFailure ??
                  "Environmental data could not be retrieved. HeatSafe will not assign an environmental priority without verified data."}
              </p>
            </div>
          ) : null}

          {hasCurrentResult && record.assessment ? (
            <>
              <EnvironmentalExposurePanel
                assessment={record.assessment}
                assessedAt={record.assessedAt}
              />

              <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                  Score breakdown
                </summary>
                <div className="border-t border-slate-100 px-5 py-4">
                  <ScoreExplainer
                    score={record.assessment.totalRiskScore ?? 0}
                    rawScore={record.assessment.rawRiskScore ?? 0}
                    contributions={record.assessment.scoreContributions}
                  />
                </div>
              </details>

              {record.assessment.transitionEnvironmental ? (
                <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
                    Journey exposure
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-700">
                    <p>
                      {record.assessment.transitionEnvironmental.transportLabel} ·{" "}
                      {record.assessment.transitionEnvironmental.durationMinutes} min · +
                      {record.assessment.transitionEnvironmental.transitionPoints} pts
                    </p>
                    <p className="mt-2 text-slate-600">
                      {record.assessment.transitionEnvironmental.transitionExplanation}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {record.assessment.transitionEnvironmental.transitionAssumptions}
                    </p>
                  </div>
                </details>
              ) : null}

              <ClinicalBasisPanel />
            </>
          ) : null}

          <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
              Safety & oversight
            </summary>
            <dl className="space-y-2 border-t border-slate-100 px-5 py-4 text-sm text-slate-700">
              <div>
                <dt className="font-medium">Clinical validation</dt>
                <dd>Not clinically validated</dd>
              </div>
              <div>
                <dt className="font-medium">Clinician oversight</dt>
                <dd>
                  Treating clinician retains full responsibility; no automatic medication
                  or hydration changes
                </dd>
              </div>
              <div>
                <dt className="font-medium">Environmental source</dt>
                <dd>FortyGuard heatmap API at estimated arrival time</dd>
              </div>
              <div>
                <dt className="font-medium">Transition modifier</dt>
                <dd>{TRANSITION_EXPOSURE_ASSUMPTIONS}</dd>
              </div>
              <div>
                <dt className="font-medium">PHI status</dt>
                <dd>Synthetic patient IDs only — no names, MRNs, or addresses</dd>
              </div>
            </dl>
          </details>

          <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
              {CLINICIAN_VALIDATION.title}
            </summary>
            <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-700">
              <p>{CLINICIAN_VALIDATION.summary}</p>
              {CLINICIAN_VALIDATION.status === "evaluation_in_progress" ? (
                <p className="mt-3 font-medium text-slate-800">
                  {CLINICIAN_VALIDATION.emptyStateLabel}
                </p>
              ) : (
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium">Clinicians</dt>
                    <dd>{CLINICIAN_VALIDATION.metrics.clinicianCount ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">Case reviews</dt>
                    <dd>{CLINICIAN_VALIDATION.metrics.caseReviewCount ?? "—"}</dd>
                  </div>
                </dl>
              )}
            </div>
          </details>

          {hasCurrentResult && record.assessment ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {record.assessment.disclaimer}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
