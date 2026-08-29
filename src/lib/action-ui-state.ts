import type { PersistedDischargeState } from "@/lib/discharge-storage";

export function isActionExpanded(
  state: PersistedDischargeState | null | undefined,
  dischargeId: string,
  actionId: string,
  fallback = false
): boolean {
  return state?.actionUiState?.[dischargeId]?.[actionId]?.expanded ?? fallback;
}

export function setActionExpanded(
  state: PersistedDischargeState,
  dischargeId: string,
  actionId: string,
  expanded: boolean
): PersistedDischargeState {
  const dischargeState = state.actionUiState?.[dischargeId] ?? {};

  return {
    ...state,
    actionUiState: {
      ...state.actionUiState,
      [dischargeId]: {
        ...dischargeState,
        [actionId]: {
          ...dischargeState[actionId],
          expanded,
        },
      },
    },
  };
}
