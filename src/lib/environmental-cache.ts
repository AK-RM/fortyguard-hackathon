import {
  buildEnvironmentalQueryKey,
  type EnvironmentalQuery,
} from "./environmental-query";
import type { EnvironmentalResult } from "./environmental-result";
import { lookupVerifiedEnvironmentalResult } from "./verified-environmental-seed";

export type EnvironmentalCacheStore = Record<string, EnvironmentalResult>;

export const ENVIRONMENTAL_CACHE_SCHEMA_VERSION = 2;

export type VersionedEnvironmentalCacheStore = {
  version: typeof ENVIRONMENTAL_CACHE_SCHEMA_VERSION;
  entries: EnvironmentalCacheStore;
};

export function createEmptyEnvironmentalCacheStore(): VersionedEnvironmentalCacheStore {
  return {
    version: ENVIRONMENTAL_CACHE_SCHEMA_VERSION,
    entries: {},
  };
}

export function normalizeEnvironmentalCacheStore(
  value: unknown
): VersionedEnvironmentalCacheStore {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "version" in value &&
    (value as VersionedEnvironmentalCacheStore).version ===
      ENVIRONMENTAL_CACHE_SCHEMA_VERSION &&
    "entries" in value &&
    typeof (value as VersionedEnvironmentalCacheStore).entries === "object" &&
    (value as VersionedEnvironmentalCacheStore).entries !== null
  ) {
    return value as VersionedEnvironmentalCacheStore;
  }

  return createEmptyEnvironmentalCacheStore();
}

export function lookupDisplayEnvironmentalResult(
  query: EnvironmentalQuery,
  clientCache: VersionedEnvironmentalCacheStore = createEmptyEnvironmentalCacheStore()
): EnvironmentalResult | null {
  const key = buildEnvironmentalQueryKey(query);
  const cached = clientCache.entries[key];

  if (cached?.status === "completed") {
    return cached;
  }

  return null;
}

export function lookupEnvironmentalResult(
  query: EnvironmentalQuery,
  _clientCache: EnvironmentalCacheStore = {}
): EnvironmentalResult | null {
  return lookupVerifiedEnvironmentalResult(query);
}

export function storeEnvironmentalResultInCache(
  cache: VersionedEnvironmentalCacheStore,
  result: EnvironmentalResult
): VersionedEnvironmentalCacheStore {
  const key = buildEnvironmentalQueryKey(result.query);

  return {
    version: ENVIRONMENTAL_CACHE_SCHEMA_VERSION,
    entries: {
      ...cache.entries,
      [key]: result,
    },
  };
}
