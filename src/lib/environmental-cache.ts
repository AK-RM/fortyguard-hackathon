import {
  buildEnvironmentalQueryKey,
  type EnvironmentalQuery,
} from "./environmental-query";
import type { EnvironmentalResult } from "./environmental-result";
import { lookupVerifiedEnvironmentalResult } from "./verified-environmental-seed";

export type EnvironmentalCacheStore = Record<string, EnvironmentalResult>;

export function lookupEnvironmentalResult(
  query: EnvironmentalQuery,
  clientCache: EnvironmentalCacheStore = {}
): EnvironmentalResult | null {
  const verified = lookupVerifiedEnvironmentalResult(query);

  if (verified) {
    return verified;
  }

  const key = buildEnvironmentalQueryKey(query);
  const cached = clientCache[key];

  if (cached?.status === "completed") {
    return cached;
  }

  return null;
}

export function storeEnvironmentalResultInCache(
  cache: EnvironmentalCacheStore,
  result: EnvironmentalResult
): EnvironmentalCacheStore {
  const key = buildEnvironmentalQueryKey(result.query);

  return {
    ...cache,
    [key]: result,
  };
}
