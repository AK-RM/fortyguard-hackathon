import type { HeatDischargePriority } from "@/lib/heat-discharge-risk";

export type HeatRiskAssessmentResponse = {
  fortyGuardDataUsed: boolean;
  fortyGuardActivityId: string;
  environmentalData: {
    dischargeLocation: {
      latitude: number;
      longitude: number;
    };
    analysisDate: string;
    analysisTime: string;
    meanTemperatureC: number;
    maximumTemperatureC: number;
    minimumTemperatureC: number | null;
    dataSource: string;
  };
  totalRiskScore: number;
  riskLevel: HeatDischargePriority;
  triggeredRiskFactors: string[];
  recommendedDischargeActions: string[];
  disclaimer: string;
};

export type HeatRiskAssessmentErrorResponse = {
  error: string;
};
