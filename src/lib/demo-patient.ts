import { DEMO_CASE_A } from "@/lib/demo-cases";
import type { HeatDischargeRiskInput } from "@/lib/heat-discharge-risk";

/** @deprecated Use DEMO_CASES from demo-cases.ts */
export const DEMO_DISCHARGE_SCENARIO: Omit<
  HeatDischargeRiskInput,
  "environmental"
> = DEMO_CASE_A.profile;
