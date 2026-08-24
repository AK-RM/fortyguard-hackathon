import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STORAGE_KEY,
  createInitialPersistedState,
} from "@/lib/discharge-storage";

import {
  completeDischargeStorageHydration,
  getDischargeStorageClientSnapshot,
  getDischargeStorageServerSnapshot,
  getInitialDischargeStorageSnapshot,
  isDischargeStorageReady,
  resetDischargeStorageSnapshotCache,
  resetDischargeStorageStoreForTests,
  subscribeToDischargeStorage,
  writeDischargeStorageState,
} from "./use-discharge-storage";

function createMockLocalStorage() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    clear: () => {
      store.clear();
    },
    snapshot: () => new Map(store),
  };
}

describe("useDischargeStorage hydration contract", () => {
  it("starts with no persisted state before client hydration", () => {
    expect(getInitialDischargeStorageSnapshot()).toEqual({
      hydrated: false,
      state: null,
    });
    expect(getDischargeStorageServerSnapshot()).toBeNull();
    expect(isDischargeStorageReady(getInitialDischargeStorageSnapshot())).toBe(
      false
    );
  });

  it("becomes ready only after hydration loads persisted state", () => {
    const loaded = createInitialPersistedState("2026-08-18T14:00:00.000Z");
    const hydrated = completeDischargeStorageHydration(loaded);

    expect(hydrated).toEqual({
      hydrated: true,
      state: loaded,
    });
    expect(isDischargeStorageReady(hydrated)).toBe(true);
  });
});

describe("useDischargeStorage snapshot cache", () => {
  const mockStorage = createMockLocalStorage();
  const storageListeners = new Map<string, Set<EventListener>>();

  beforeEach(() => {
    resetDischargeStorageStoreForTests();
    mockStorage.clear();

    vi.stubGlobal("window", {
      localStorage: mockStorage,
      addEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject
      ) => {
        const listeners = storageListeners.get(type) ?? new Set();
        listeners.add(listener as EventListener);
        storageListeners.set(type, listeners);
      },
      removeEventListener: (
        type: string,
        listener: EventListenerOrEventListenerObject
      ) => {
        storageListeners.get(type)?.delete(listener as EventListener);
      },
    });
  });

  afterEach(() => {
    storageListeners.clear();
    vi.unstubAllGlobals();
    resetDischargeStorageStoreForTests();
  });

  it("returns the same snapshot reference when localStorage has not changed", () => {
    const first = getDischargeStorageClientSnapshot();
    const second = getDischargeStorageClientSnapshot();

    expect(first).toBe(second);
  });

  it("returns a new snapshot reference after persisted storage changes", () => {
    const initial = getDischargeStorageClientSnapshot();
    const updated = createInitialPersistedState("2026-08-19T09:00:00.000Z");
    updated.discharges["HS-999"] = initial.discharges["HS-001"];

    writeDischargeStorageState(updated);
    const next = getDischargeStorageClientSnapshot();

    expect(next).toBe(updated);
    expect(next).not.toBe(initial);
  });

  it("keeps getServerSnapshot stable", () => {
    expect(getDischargeStorageServerSnapshot()).toBeNull();
    expect(getDischargeStorageServerSnapshot()).toBeNull();
  });

  it("notifies subscribers when this application writes discharge state", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDischargeStorage(listener);
    const next = getDischargeStorageClientSnapshot();

    writeDischargeStorageState(next);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it("invalidates the cache and notifies subscribers on cross-tab storage events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDischargeStorage(listener);
    const initial = getDischargeStorageClientSnapshot();

    const crossTabState = createInitialPersistedState("2026-08-20T10:00:00.000Z");
    const crossTabRaw = JSON.stringify(crossTabState);
    mockStorage.setItem(STORAGE_KEY, crossTabRaw);

    for (const storageListener of storageListeners.get("storage") ?? []) {
      storageListener({
        key: STORAGE_KEY,
        newValue: crossTabRaw,
      } as StorageEvent);
    }

    expect(listener).toHaveBeenCalledTimes(1);

    const refreshed = getDischargeStorageClientSnapshot();
    expect(refreshed).not.toBe(initial);
    expect(refreshed).toEqual(crossTabState);

    unsubscribe();
  });
});
