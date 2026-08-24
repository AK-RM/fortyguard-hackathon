"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { PersistedDischargeState } from "@/lib/discharge-storage";
import {
  STORAGE_KEY,
  createInitialPersistedState,
  loadPersistedState,
  savePersistedState,
} from "@/lib/discharge-storage";

export type DischargeStorageSnapshot = {
  hydrated: boolean;
  state: PersistedDischargeState | null;
};

type StoreListener = () => void;

const storeListeners = new Set<StoreListener>();

let cachedRaw: string | null | undefined;
let cachedSnapshot: PersistedDischargeState | null = null;
let storageEventListenerAttached = false;

export function resetDischargeStorageSnapshotCache(): void {
  cachedRaw = undefined;
  cachedSnapshot = null;
}

export function resetDischargeStorageStoreForTests(): void {
  resetDischargeStorageSnapshotCache();
  storageEventListenerAttached = false;
  storeListeners.clear();
}

function invalidateDischargeStorageSnapshotCache(): void {
  cachedRaw = undefined;
  cachedSnapshot = null;
}

function refreshDischargeStorageSnapshotCache(): PersistedDischargeState {
  const state = loadPersistedState();

  if (typeof window !== "undefined") {
    cachedRaw = window.localStorage.getItem(STORAGE_KEY);
  }

  cachedSnapshot = state;
  return state;
}

function notifyStoreListeners() {
  for (const listener of storeListeners) {
    listener();
  }
}

function handleCrossTabStorageEvent(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) {
    return;
  }

  invalidateDischargeStorageSnapshotCache();
  notifyStoreListeners();
}

function ensureCrossTabStorageListener(): void {
  if (storageEventListenerAttached || typeof window === "undefined") {
    return;
  }

  storageEventListenerAttached = true;
  window.addEventListener("storage", handleCrossTabStorageEvent);
}

export function subscribeToDischargeStorage(listener: StoreListener) {
  ensureCrossTabStorageListener();
  storeListeners.add(listener);

  return () => {
    storeListeners.delete(listener);
  };
}

export function getInitialDischargeStorageSnapshot(): DischargeStorageSnapshot {
  return {
    hydrated: false,
    state: null,
  };
}

export function getDischargeStorageServerSnapshot(): PersistedDischargeState | null {
  return null;
}

export function getDischargeStorageClientSnapshot(): PersistedDischargeState {
  if (typeof window === "undefined") {
    return loadPersistedState();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (cachedSnapshot !== null && cachedRaw !== undefined && raw === cachedRaw) {
    return cachedSnapshot;
  }

  return refreshDischargeStorageSnapshotCache();
}

export function writeDischargeStorageState(state: PersistedDischargeState): void {
  savePersistedState(state);
  cachedRaw =
    typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : JSON.stringify(state);
  cachedSnapshot = state;
  notifyStoreListeners();
}

export function completeDischargeStorageHydration(
  state: PersistedDischargeState
): DischargeStorageSnapshot {
  return {
    hydrated: true,
    state,
  };
}

export function isDischargeStorageReady(snapshot: DischargeStorageSnapshot): boolean {
  return snapshot.hydrated && snapshot.state !== null;
}

export function useDischargeStorage() {
  const state = useSyncExternalStore(
    subscribeToDischargeStorage,
    getDischargeStorageClientSnapshot,
    getDischargeStorageServerSnapshot
  );

  const persist = useCallback((next: PersistedDischargeState) => {
    writeDischargeStorageState(next);
  }, []);

  const resetToInitial = useCallback(() => {
    persist(createInitialPersistedState());
  }, [persist]);

  const hydrated = state !== null;
  const ready = hydrated;

  return {
    state,
    hydrated,
    ready,
    persist,
    resetToInitial,
  };
}
