import {
  ENVIRONMENTAL_FORECAST_HORIZON_MESSAGE,
  ENVIRONMENTAL_HISTORICAL_EARLIEST_MESSAGE,
  getEnvironmentalTemporalValidationMessage,
  type EnvironmentalTemporalReasonCode,
} from "./environmental-datetime-validation";

export type EnvironmentalFailureReasonCode =
  | "empty_initial_aoi"
  | "empty_expanded_aoi"
  | "unusable_temperature_statistics"
  | "date_before_historical_range"
  | "date_beyond_forecast_horizon"
  | "invalid_environmental_datetime"
  | "upstream_authentication"
  | "insufficient_credits"
  | "upstream_timeout"
  | "upstream_submission"
  | "upstream_polling"
  | "upstream_failed";

export type EnvironmentalTemporalFailureReasonCode = EnvironmentalTemporalReasonCode;

export const ENVIRONMENTAL_UNAVAILABLE_MESSAGE =
  "FortyGuard returned no usable temperature data for this destination and arrival hour.";

export function getEnvironmentalFailureMessage(
  reasonCode: EnvironmentalFailureReasonCode
): string {
  switch (reasonCode) {
    case "empty_initial_aoi":
    case "empty_expanded_aoi":
    case "unusable_temperature_statistics":
      return ENVIRONMENTAL_UNAVAILABLE_MESSAGE;
    case "upstream_authentication":
      return "FortyGuard authentication failed. Environmental assessment is unavailable.";
    case "insufficient_credits":
      return "FortyGuard credits are insufficient. Environmental assessment is unavailable.";
    case "upstream_timeout":
      return "FortyGuard timed out before environmental data was ready.";
    case "date_before_historical_range":
      return ENVIRONMENTAL_HISTORICAL_EARLIEST_MESSAGE;
    case "date_beyond_forecast_horizon":
      return ENVIRONMENTAL_FORECAST_HORIZON_MESSAGE;
    case "invalid_environmental_datetime":
      return getEnvironmentalTemporalValidationMessage(
        "invalid_environmental_datetime"
      );
    case "upstream_submission":
    case "upstream_polling":
    case "upstream_failed":
      return "FortyGuard is unavailable. Environmental assessment is unavailable.";
    default:
      return ENVIRONMENTAL_UNAVAILABLE_MESSAGE;
  }
}

export function mapFortyGuardErrorKindToReasonCode(
  kind: "config" | "submission" | "polling" | "failed" | "timeout"
): EnvironmentalFailureReasonCode {
  switch (kind) {
    case "config":
      return "upstream_authentication";
    case "submission":
      return "upstream_submission";
    case "polling":
      return "upstream_polling";
    case "timeout":
      return "upstream_timeout";
    case "failed":
      return "upstream_failed";
    default:
      return "upstream_failed";
  }
}

export function isEmptyEnvironmentalParseFailure(
  reasonCode: EnvironmentalFailureReasonCode
): boolean {
  return (
    reasonCode === "empty_initial_aoi" ||
    reasonCode === "empty_expanded_aoi" ||
    reasonCode === "unusable_temperature_statistics"
  );
}
