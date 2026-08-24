import {
  DEMO_CASES,
  getDemoCaseById,
} from "@/lib/demo-cases";
import {
  computeAssessmentInputFingerprint,
} from "@/lib/discharge-record-state";
import type { DemoCaseDefinition } from "@/types/discharge-workflow";
import type { DischargeRecord } from "@/types/discharge-workflow";

import type { PersistedDischargeState } from "./discharge-storage";
import { createDischargeRecordFromDemoCase } from "./demo-cases";

export const DEMO_DATA_VERSION = 2;

export const BUILTIN_DEMO_IDS = ["HS-001", "HS-002", "HS-003"] as const;

export function isBuiltinDemoId(id: string): id is (typeof BUILTIN_DEMO_IDS)[number] {
  return BUILTIN_DEMO_IDS.includes(id as (typeof BUILTIN_DEMO_IDS)[number]);
}

function demoScenarioFingerprint(demoCase: DemoCaseDefinition): string {
  return computeAssessmentInputFingerprint({
    origin: demoCase.origin,
    destination: demoCase.destination,
    journey: demoCase.journey,
    profile: demoCase.profile,
  });
}

export function migrateDemoDischargeRecord(
  record: DischargeRecord,
  demoCase: DemoCaseDefinition
): DischargeRecord {
  const nextScenario = {
    casePreset: demoCase.preset,
    origin: { ...demoCase.origin },
    destination: { ...demoCase.destination },
    journey: { ...demoCase.journey },
    profile: {
      patient: { ...demoCase.profile.patient },
      medications: { ...demoCase.profile.medications },
      homeSocial: { ...demoCase.profile.homeSocial },
    },
  };

  const nextFingerprint = demoScenarioFingerprint(demoCase);
  const assessmentStillCompatible =
    record.assessmentInputFingerprint !== null &&
    record.assessmentInputFingerprint === nextFingerprint;

  const pendingStillCompatible =
    record.pendingAssessment?.inputFingerprint === nextFingerprint;
  const refreshStillCompatible =
    record.environmentalRefresh?.inputFingerprint === nextFingerprint;

  let migrated: DischargeRecord = {
    ...record,
    ...nextScenario,
    pendingAssessment: pendingStillCompatible ? record.pendingAssessment : null,
    environmentalRefresh: refreshStillCompatible ? record.environmentalRefresh : null,
    environmentalRefreshFailure: refreshStillCompatible
      ? record.environmentalRefreshFailure
      : null,
    reassessmentRequired: false,
  };

  if (!assessmentStillCompatible) {
    if (record.assessment) {
      migrated = {
        ...migrated,
        assessmentStatus: "stale",
        assessment: null,
        environmentalFailure: null,
        assessedAt: null,
        assessmentInputFingerprint: null,
        actions: [],
      };
    } else if (record.assessmentStatus === "assessed") {
      migrated = {
        ...migrated,
        assessmentStatus: "not_assessed",
        assessment: null,
        environmentalFailure: null,
        assessedAt: null,
        assessmentInputFingerprint: null,
        actions: [],
      };
    }
  }

  if (!pendingStillCompatible && record.pendingAssessment) {
    if (!migrated.assessment) {
      migrated = {
        ...migrated,
        assessmentStatus: "not_assessed",
        pendingAssessment: null,
      };
    } else {
      migrated = {
        ...migrated,
        pendingAssessment: null,
        assessmentStatus: assessmentStillCompatible ? "assessed" : migrated.assessmentStatus,
      };
    }
  }

  if (
    migrated.assessmentStatus === "processing" &&
    !migrated.pendingAssessment &&
    !migrated.environmentalRefresh
  ) {
    migrated.assessmentStatus = migrated.assessment ? "assessed" : "not_assessed";
  }

  return migrated;
}

export function migratePersistedState(
  state: PersistedDischargeState,
  demoDataVersion = 0
): PersistedDischargeState {
  if (demoDataVersion >= DEMO_DATA_VERSION) {
    return state;
  }

  const discharges = { ...state.discharges };

  for (const demoCase of DEMO_CASES) {
    const existing = discharges[demoCase.id];

    if (existing) {
      discharges[demoCase.id] = migrateDemoDischargeRecord(existing, demoCase);
    } else {
      discharges[demoCase.id] = createDischargeRecordFromDemoCase(demoCase);
    }
  }

  return {
    ...state,
    discharges,
    demoDataVersion: DEMO_DATA_VERSION,
  };
}

export function ensureBuiltinDemoRecords(
  state: PersistedDischargeState
): PersistedDischargeState {
  const discharges = { ...state.discharges };
  let changed = false;

  for (const id of BUILTIN_DEMO_IDS) {
    if (!discharges[id]) {
      const demoCase = getDemoCaseById(id);

      if (demoCase) {
        discharges[id] = createDischargeRecordFromDemoCase(demoCase);
        changed = true;
      }
    }
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    discharges,
  };
}
