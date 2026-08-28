import type { VersionedEnvironmentalCacheStore } from "@/lib/environmental-cache";
import {
  createEmptyEnvironmentalCacheStore,
  normalizeEnvironmentalCacheStore,
} from "@/lib/environmental-cache";
import type { DischargeRecord } from "@/types/discharge-workflow";
import {
  DEMO_CASES,
  createDischargeRecordFromDemoCase,
} from "@/lib/demo-cases";
import {
  DEMO_DATA_VERSION,
  ensureBuiltinDemoRecords,
  migratePersistedState,
} from "@/lib/demo-storage-migration";
import { isEnvironmentalRefreshCurrent } from "@/lib/discharge-record-state";
import type { HeatDischargePriority } from "@/lib/heat-discharge-risk";
import { countOutstandingActions } from "@/lib/discharge-actions";
import { dedupeFlagReasons } from "@/lib/discharge-display";
import { formatLocalDateTimeDisplay } from "@/lib/discharge-timezone";
import { TRANSPORT_MODE_LABELS } from "@/lib/transition-exposure";
import type { DischargeDashboardSummary } from "@/types/discharge-workflow";

export const STORAGE_KEY = "heatsafe-discharge-v1";
export const STORAGE_VERSION = 3;

export type PersistedDischargeState = {
  version: typeof STORAGE_VERSION;
  demoDataVersion?: number;
  discharges: Record<string, DischargeRecord>;
  environmentalCache: VersionedEnvironmentalCacheStore;
  actionUiState?: Record<string, Record<string, { expanded?: boolean }>>;
};

export function createInitialPersistedState(
  timestamp = new Date().toISOString()
): PersistedDischargeState {
  const discharges: Record<string, DischargeRecord> = {};

  for (const demoCase of DEMO_CASES) {
    discharges[demoCase.id] = createDischargeRecordFromDemoCase(
      demoCase,
      timestamp
    );
  }

  return {
    version: STORAGE_VERSION,
    demoDataVersion: DEMO_DATA_VERSION,
    discharges,
    environmentalCache: createEmptyEnvironmentalCacheStore(),
    actionUiState: {},
  };
}

function normalizeDischargeRecord(record: DischargeRecord): DischargeRecord {
  return {
    ...record,
    environmentalRefreshFailure: record.environmentalRefreshFailure ?? null,
    reassessmentRequired: record.reassessmentRequired ?? false,
    environmentalRefresh: record.environmentalRefresh ?? null,
    pendingAssessment: record.pendingAssessment
      ? {
          activityToken: record.pendingAssessment.activityToken,
          activityId: record.pendingAssessment.activityId,
          environmentalQuery: record.pendingAssessment.environmentalQuery,
          inputFingerprint: record.pendingAssessment.inputFingerprint,
          submittedAt: record.pendingAssessment.submittedAt,
        }
      : null,
  };
}

function migratePersistedStateVersion(state: PersistedDischargeState): PersistedDischargeState {
  const discharges = Object.fromEntries(
    Object.entries(state.discharges).map(([id, record]) => [
      id,
      {
        ...normalizeDischargeRecord(record),
        pendingAssessment:
          record.pendingAssessment && "activityToken" in record.pendingAssessment
            ? record.pendingAssessment
            : null,
        environmentalRefresh:
          record.environmentalRefresh && "activityToken" in record.environmentalRefresh
            ? record.environmentalRefresh
            : null,
        assessmentStatus:
          record.assessmentStatus === "processing" &&
          record.pendingAssessment &&
          !("activityToken" in record.pendingAssessment)
            ? record.assessment
              ? "assessed"
              : "not_assessed"
            : record.assessmentStatus,
      },
    ])
  );

  return {
    ...state,
    version: STORAGE_VERSION,
    discharges,
    environmentalCache: normalizeEnvironmentalCacheStore(state.environmentalCache),
    actionUiState: state.actionUiState ?? {},
  };
}

function normalizePersistedState(state: PersistedDischargeState): PersistedDischargeState {
  const migrated =
    (state.version ?? 0) < STORAGE_VERSION ? migratePersistedStateVersion(state) : state;

  const discharges = Object.fromEntries(
    Object.entries(migrated.discharges).map(([id, record]) => [
      id,
      normalizeDischargeRecord(record),
    ])
  );

  return {
    ...migrated,
    version: STORAGE_VERSION,
    discharges,
    environmentalCache: normalizeEnvironmentalCacheStore(migrated.environmentalCache),
    actionUiState: migrated.actionUiState ?? {},
  };
}

export function summarizeDischargeRecord(record: DischargeRecord): DischargeDashboardSummary {
  const hasCurrentAssessment =
    record.assessmentStatus === "assessed" && record.assessment !== null;
  const priority = hasCurrentAssessment ? record.assessment?.riskLevel ?? null : null;
  const keyReasons = hasCurrentAssessment
    ? dedupeFlagReasons(
        record.assessment?.scoreContributions
          .slice()
          .sort((left, right) => right.points - left.points)
          .slice(0, 3)
          .map((contribution) => contribution.label) ?? []
      ).slice(0, 2)
    : [];

  const environmentalRefreshStatus = isEnvironmentalRefreshCurrent(record)
    ? "processing"
    : record.environmentalRefresh?.status === "failed"
      ? "failed"
      : null;

  return {
    id: record.id,
    destinationLabel: record.destination.label,
    plannedDischargeDisplay: formatLocalDateTimeDisplay(
      { date: record.journey.date, time: record.journey.time },
      record.journey.timeZone
    ),
    transportMode: record.journey.transportMode,
    transportLabel: TRANSPORT_MODE_LABELS[record.journey.transportMode],
    priority,
    keyReasons,
    outstandingActionCount: countOutstandingActions(record.actions),
    assessmentStatus: record.assessmentStatus,
    environmentalRefreshStatus,
    reassessmentRequired: record.reassessmentRequired,
  };
}

export function getPriorityLabel(priority: HeatDischargePriority | null): string {
  if (!priority) {
    return "Not assessed";
  }

  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined";
}

export function loadPersistedState(): PersistedDischargeState {
  if (!isBrowserEnvironment()) {
    return createInitialPersistedState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const initial = createInitialPersistedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedDischargeState;

    if (!parsed.discharges) {
      const initial = createInitialPersistedState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    let next = normalizePersistedState(parsed);

    if ((next.demoDataVersion ?? 0) < DEMO_DATA_VERSION) {
      next = migratePersistedState(next, next.demoDataVersion ?? 0);
    }

    next = ensureBuiltinDemoRecords(next);

    if (
      next.version !== STORAGE_VERSION ||
      (next.demoDataVersion ?? 0) !== DEMO_DATA_VERSION ||
      JSON.stringify(next) !== raw
    ) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }

    return next;
  } catch {
    const initial = createInitialPersistedState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

export function savePersistedState(state: PersistedDischargeState): void {
  if (!isBrowserEnvironment()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function upsertDischargeRecord(
  state: PersistedDischargeState,
  record: DischargeRecord
): PersistedDischargeState {
  return {
    ...state,
    discharges: {
      ...state.discharges,
      [record.id]: record,
    },
  };
}

export function createBlankDischargeRecord(id: string): DischargeRecord {
  const timestamp = new Date().toISOString();
  const demo = DEMO_CASES[0];

  return {
    id,
    origin: { ...demo.origin },
    destination: { ...demo.destination },
    journey: { ...demo.journey },
    profile: {
      patient: {
        age: 0,
        cardiovascularDisease: false,
        heartFailure: false,
        kidneyDisease: false,
        respiratoryDisease: false,
        diabetes: false,
        cognitiveImpairment: false,
        limitedMobility: false,
      },
      medications: {
        diuretic: false,
        aceArbArni: false,
        betaBlocker: false,
        anticholinergic: false,
        psychotropic: false,
        lithium: false,
        nsaid: false,
      },
      homeSocial: {
        workingAirConditioning: false,
        livesAlone: false,
        reliableTransport: true,
        caregiverCheckInAvailable: false,
        powerDependentMedicalEquipment: false,
      },
    },
    assessmentStatus: "not_assessed",
    assessment: null,
    environmentalFailure: null,
    environmentalRefreshFailure: null,
    reassessmentRequired: false,
    assessedAt: null,
    assessmentInputFingerprint: null,
    pendingAssessment: null,
    environmentalRefresh: null,
    actions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function resetBuiltinDemoState(): PersistedDischargeState {
  return createInitialPersistedState();
}

export function generateDischargeId(existing: Record<string, DischargeRecord>): string {
  let counter = 1;

  while (existing[`HS-${String(counter).padStart(3, "0")}`]) {
    counter += 1;
  }

  return `HS-${String(counter).padStart(3, "0")}`;
}
