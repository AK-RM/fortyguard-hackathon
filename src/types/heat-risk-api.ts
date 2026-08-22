import type {
  CategorizedRiskFactor,
  DischargeAction,
  HeatDischargePriority,
} from "@/lib/heat-discharge-risk";
import type { DateTimeMetadata } from "@/lib/discharge-timezone";

export type HeatRiskAssessmentResponse = {
  fortyGuardDataUsed: boolean;
  fortyGuardActivityId: string;
  environmentalData: {
    dischargeLocation: {
      latitude: number;
      longitude: number;
      label: string | null;
      timeZone: string;
    };
    dischargeDateTimeLocal: DateTimeMetadata;
    fortyGuardRequestDateTimeUtc: DateTimeMetadata;
    analysisDate: string;
    analysisTime: string;
    meanTemperatureC: number;
    maximumTemperatureC: number;
    minimumTemperatureC: number | null;
    dataSource: string;
  };
  totalRiskScore: number;
  riskLevel: HeatDischargePriority;
  triggeredRiskFactors: CategorizedRiskFactor[];
  recommendedDischargeActions: DischargeAction[];
  disclaimer: string;
};

export type HeatRiskAssessmentErrorResponse = {
  error: string;
};

export type HeatRiskAssessmentRequest = {
  latitude: number;
  longitude: number;
  date: string;
  time: string;
  timeZone: string;
};
