"use client";

import Link from "next/link";
import { useState } from "react";

import { AssessmentSummaryPanel } from "@/components/assessment-summary-panel";
import { PreparedCaseSummary } from "@/components/prepared-case-summary";
import { DestinationLocationControl } from "@/components/destination-location-control";
import { JourneySummary } from "@/components/journey-summary";
import {
  NumericFieldInput,
  resolveNumericDraft,
} from "@/components/numeric-field-input";
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
import {
  buildPatientSummaryLine,
  getCaseHeaderLabel,
} from "@/lib/discharge-display";
import { isStandardizedDemoCase } from "@/lib/prepared-case-display";
import {
  buildLocationFromPreset,
  validateDestinationForAssessment,
} from "@/lib/location-coordinates";
import {
  parseNumericDraft,
  validateAgeInput,
  validateDurationInput,
} from "@/lib/numeric-form-input";
import {
  TRANSPORT_MODE_LABELS,
  TRANSITION_EXPOSURE_ASSUMPTIONS,
} from "@/lib/transition-exposure";
import type { HeatRiskAssessmentRequest } from "@/types/heat-risk-api";
import type { DischargeRecord, DischargeLocation, TransportMode } from "@/types/discharge-workflow";

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
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [showProcessingDetails, setShowProcessingDetails] = useState(false);
  const [ageDraft, setAgeDraft] = useState<string | undefined>(undefined);
  const [durationDraft, setDurationDraft] = useState<string | undefined>(undefined);
  const [numericFieldSeed, setNumericFieldSeed] = useState(0);

  const record = state?.discharges[dischargeId] ?? null;
  const isDemoCase = record ? isStandardizedDemoCase(record) : false;

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

    const next = applyDemoCaseToRecord(record, preset);
    persistRecord(next);
    setAgeDraft(undefined);
    setDurationDraft(undefined);
    setNumericFieldSeed((seed) => seed + 1);
    setError(null);
    setShowEditDetails(false);
  }

  function buildRecordWithCommittedNumericDrafts(
    current: DischargeRecord
  ): DischargeRecord | { error: string } {
    const ageInput = resolveNumericDraft(ageDraft, current.profile.patient.age);
    const durationInput = resolveNumericDraft(
      durationDraft,
      current.journey.durationMinutes
    );
    const ageError = validateAgeInput(ageInput);

    if (ageError) {
      return { error: ageError };
    }

    const durationError = validateDurationInput(durationInput);

    if (durationError) {
      return { error: durationError };
    }

    const age = Math.round(parseNumericDraft(ageInput)!);
    const durationMinutes = Math.round(parseNumericDraft(durationInput)!);

    return updateAssessmentInputs(current, {
      profile: {
        ...current.profile,
        patient: {
          ...current.profile.patient,
          age,
        },
      },
      journey: {
        ...current.journey,
        durationMinutes,
      },
    });
  }

  function updateDestination(location: DischargeLocation) {
    if (!record) {
      return;
    }

    const preset = ARIZONA_LOCATION_PRESETS.find(
      (item) =>
        Math.abs(item.latitude - location.latitude) < 0.0001 &&
        Math.abs(item.longitude - location.longitude) < 0.0001
    );

    updateInputs({
      destination: location,
      ...(preset
        ? {
            journey: {
              ...record.journey,
              timeZone: preset.timeZone,
            },
          }
        : {}),
    });
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
      [target]: buildLocationFromPreset(preset),
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

  const ageInput = record
    ? resolveNumericDraft(ageDraft, record.profile.patient.age)
    : "";
  const durationInput = record
    ? resolveNumericDraft(durationDraft, record.journey.durationMinutes)
    : "";
  const destinationValidationError = record
    ? validateDestinationForAssessment(record.destination)
    : null;
  const ageValidationError = validateAgeInput(ageInput);
  const durationValidationError = validateDurationInput(durationInput);
  const assessmentBlocked = Boolean(
    destinationValidationError || ageValidationError || durationValidationError
  );

  async function runAssessment(options?: { forceRefresh?: boolean }) {
    if (!record) {
      return;
    }

    const committed = buildRecordWithCommittedNumericDrafts(record);

    if ("error" in committed) {
      setError(committed.error);
      return;
    }

    if (validateDestinationForAssessment(committed.destination)) {
      setError("Choose a valid Arizona destination before running HeatSafe.");
      return;
    }

    persistRecord(committed);
    setLoading(true);
    setError(null);

    const result = await submitAssessment({
      ...options,
      recordOverride: committed,
    });

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
    <div className="mx-auto max-w-3xl overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
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
            {!isDemoCase || hasCurrentResult ? (
              <p className="mt-2 text-sm text-slate-700">{patientSummaryLine}</p>
            ) : null}
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

      {record.assessmentStatus === "stale" ? (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Assessment needs updating</p>
          <p className="mt-1">
            Discharge details changed. Run assessment again to refresh priority and actions.
          </p>
        </div>
      ) : null}

      {record.assessment?.environmentalAvailable === false &&
      record.assessmentStatus === "environmental_unavailable" &&
      !loading &&
      !pendingIsCurrent ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          <p className="font-semibold">Environmental data unavailable</p>
          <p className="mt-2">
            {record.environmentalFailure ??
              "Environmental data could not be retrieved. HeatSafe will not assign an environmental priority without verified data."}
          </p>
        </div>
      ) : null}

      {hasCurrentResult && record.assessment ? (
        <div className="space-y-6">
          <AssessmentSummaryPanel record={record} />
          <section
            id="discharge-actions"
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <h2 className="text-lg font-bold text-slate-900">Actions</h2>
            <div className="mt-4 space-y-3">
              {record.actions.map((action) => (
                <ActionWorkflowCard
                  key={action.id}
                  action={action}
                  record={record}
                  allActions={record.actions}
                  onUpdate={updateActions}
                />
              ))}
            </div>
          </section>
          <EnvironmentalExposurePanel
            assessment={record.assessment}
            assessedAt={record.assessedAt}
          />
        </div>
      ) : null}

      {!hasCurrentResult && isDemoCase && !showEditDetails ? (
        <div className="mb-6">
          <PreparedCaseSummary record={record} />
        </div>
      ) : null}

      <div className="my-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {!hasCurrentResult && isDemoCase && !showEditDetails ? (
          <p className="mb-3 text-sm text-slate-600">
            Review the prepared case above, then run assessment.
          </p>
        ) : !hasCurrentResult ? (
          <p className="mb-3 text-sm text-slate-600">
            Complete discharge details, then run assessment.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => runAssessment()}
            disabled={loading || (pendingIsCurrent && !loading) || assessmentBlocked}
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
          {isDemoCase && !showEditDetails ? (
            <button
              type="button"
              onClick={() => setShowEditDetails(true)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:w-auto"
            >
              Edit details
            </button>
          ) : null}
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

        {destinationValidationError ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            Choose a valid Arizona destination before running HeatSafe.
          </p>
        ) : null}

        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Submitting assessment…</p>
        ) : null}
        {record.assessmentStatus === "processing" && record.pendingAssessment ? (
          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
            <p className="font-medium">Environmental data processing</p>
            <p className="mt-1">
              You can leave and return — assessment will resume automatically.
            </p>
            <button
              type="button"
              onClick={() => setShowProcessingDetails((current) => !current)}
              className="mt-2 min-h-11 text-sm font-medium text-sky-800"
            >
              {showProcessingDetails ? "Hide processing details" : "Processing details"}
            </button>
            {showProcessingDetails ? (
              <p className="mt-2 break-all font-mono text-xs text-sky-800">
                {record.pendingAssessment.activityId}
              </p>
            ) : null}
          </div>
        ) : null}
        {refreshIsCurrent && record.environmentalRefresh ? (
          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
            <p className="font-medium">Refreshing environmental data…</p>
            <p className="mt-1">Current result stays visible until refresh completes.</p>
            <button
              type="button"
              onClick={() => setShowProcessingDetails((current) => !current)}
              className="mt-2 min-h-11 text-sm font-medium text-sky-800"
            >
              {showProcessingDetails ? "Hide processing details" : "Processing details"}
            </button>
            {showProcessingDetails ? (
              <p className="mt-2 break-all font-mono text-xs text-sky-800">
                {record.environmentalRefresh.activityId}
              </p>
            ) : null}
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

      {(showEditDetails || !isDemoCase) ? (
        <div className="space-y-6">
          <details
            className="group rounded-xl border border-slate-200 bg-white shadow-sm"
            open={!hasCurrentResult || showEditDetails}
          >
            <summary className="cursor-pointer list-none px-5 py-4 text-base font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
              {hasCurrentResult ? "Edit discharge details" : "Discharge details"}
            </summary>
            <div className="space-y-6 border-t border-slate-100 px-5 pb-5 pt-4">
          <SectionCard title="Discharge">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Leaving from</h3>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Hospital location</span>
                  <select
                    onChange={(event) => applyLocationPreset("origin", event.target.value)}
                    defaultValue=""
                    className="w-full min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="" disabled>
                      Choose hospital
                    </option>
                    {ARIZONA_LOCATION_PRESETS.map((preset) => (
                      <option key={`origin-${preset.id}`} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium text-slate-900">{record.origin.label}</p>
                </div>
              </div>

              <DestinationLocationControl
                key={`${record.destination.latitude}-${record.destination.longitude}-${record.destination.label}`}
                destination={record.destination}
                onChange={updateDestination}
                showMethodSelectorFirst={!isDemoCase}
              />
            </div>

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
              <NumericFieldInput
                key={`duration-${dischargeId}-${numericFieldSeed}`}
                id={`duration-${dischargeId}`}
                label="Duration (minutes)"
                value={durationInput}
                onChange={setDurationDraft}
                validate={validateDurationInput}
                onCommit={(durationMinutes) => {
                  if (!record || durationMinutes === record.journey.durationMinutes) {
                    return;
                  }

                  updateInputs({
                    journey: {
                      ...record.journey,
                      durationMinutes,
                    },
                  });
                }}
                min={1}
                max={480}
              />
            </div>

            <JourneySummary
              origin={record.origin}
              destination={record.destination}
              transportMode={record.journey.transportMode}
              durationMinutes={
                parseNumericDraft(durationInput) ?? record.journey.durationMinutes
              }
            />
          </SectionCard>

          <SectionCard title="Patient">
            <NumericFieldInput
              key={`age-${dischargeId}-${numericFieldSeed}`}
              id={`age-${dischargeId}`}
              label="Age"
              value={ageInput}
              onChange={setAgeDraft}
              validate={validateAgeInput}
              onCommit={(age) => {
                if (!record || age === record.profile.patient.age) {
                  return;
                }

                updateInputs({
                  profile: {
                    ...record.profile,
                    patient: {
                      ...record.profile.patient,
                      age,
                    },
                  },
                });
              }}
              min={0}
              max={120}
              className="mb-4 block text-sm"
              inputClassName="w-full max-w-[8rem] min-h-11 rounded-md border border-slate-300 px-3 py-2"
            />

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
      ) : null}

      {hasCurrentResult && record.assessment ? (
        <div className="mt-6 space-y-4">
          <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
              How priority was determined
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
                Journey details
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
              </div>
            </details>
          ) : null}

          <ClinicalBasisPanel />

          <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900">
              Safety & limitations
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
            </dl>
          </details>

          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            {record.assessment.disclaimer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
