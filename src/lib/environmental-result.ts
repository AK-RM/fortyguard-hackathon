import type { EnvironmentalQuery } from "./environmental-query";

export type EnvironmentalProvenance =
  | "live_fortyguard"
  | "verified_historical_snapshot"
  | "unavailable";

export type EnvironmentalResultStatus = "completed";

export type EnvironmentalResult = {
  source: "FortyGuard";
  activityId: string;
  query: EnvironmentalQuery;
  minimumTemperatureC: number;
  maximumTemperatureC: number;
  meanTemperatureC: number;
  standardDeviation: number;
  cellCount: number;
  provenance: EnvironmentalProvenance;
  provenanceNote?: string;
  aoiSideMetersUsed: number;
  aoiFallbackUsed: boolean;
  granularityUsed: number;
  status: EnvironmentalResultStatus;
};
