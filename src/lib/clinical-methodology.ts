/**
 * Authoritative clinical rationale mapping for HeatSafe Discharge.
 *
 * These sources inform factor selection and action categories — NOT numerical
 * workflow weights or outcome validation.
 */

export type ClinicalSourceId =
  | "cdc-clinical-guidance"
  | "cdc-heat-medications"
  | "cdc-older-adults"
  | "cdc-risk-factors"
  | "ahrq-ideal-discharge"
  | "who-keep-cool";

export type ClinicalSource = {
  id: ClinicalSourceId;
  label: string;
  url: string;
};

export const CLINICAL_SOURCES: Record<ClinicalSourceId, ClinicalSource> = {
  "cdc-clinical-guidance": {
    id: "cdc-clinical-guidance",
    label: "CDC Clinical Guidance for Heat and Health",
    url: "https://www.cdc.gov/heat-health/hcp/clinical-guidance/index.html",
  },
  "cdc-heat-medications": {
    id: "cdc-heat-medications",
    label: "CDC Heat and Medications — Guidance for Clinicians",
    url: "https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html",
  },
  "cdc-older-adults": {
    id: "cdc-older-adults",
    label: "CDC Heat and Older Adults",
    url: "https://www.cdc.gov/heat-health/risk-factors/heat-and-older-adults-aged-65.html",
  },
  "cdc-risk-factors": {
    id: "cdc-risk-factors",
    label: "CDC Extreme Heat Risk Factors",
    url: "https://www.cdc.gov/extreme-heat/risk-factors/index.html",
  },
  "ahrq-ideal-discharge": {
    id: "ahrq-ideal-discharge",
    label: "AHRQ IDEAL Discharge Planning",
    url: "https://www.ahrq.gov/patient-safety/patients-families/engagingfamilies/strategy4/index.html",
  },
  "who-keep-cool": {
    id: "who-keep-cool",
    label: "WHO Keep Cool in the Heat",
    url: "https://www.who.int/europe/news-room/fact-sheets/item/keepcool-in-the-heat",
  },
};

export const CLINICAL_METHODOLOGY_SUMMARY =
  "HeatSafe's included risk factors and action categories are informed by CDC, AHRQ, and WHO guidance on heat vulnerability, medication review, cooling access, and discharge planning. The numerical weighting system itself remains a transparent workflow-prioritization heuristic and has not been clinically calibrated.";

export const CLINICAL_METHODOLOGY_DISCLAIMER =
  "Guidance documents inform what HeatSafe surfaces — not the numerical coefficients, priority thresholds, or any claim of clinical validation, outcome prediction, or score accuracy.";

export type MethodologyEntry = {
  factorOrAction: string;
  whyIncluded: string;
  sources: ClinicalSourceId[];
  supports: string;
  doesNotSupport: string;
};

export const FACTOR_METHODOLOGY: MethodologyEntry[] = [
  {
    factorOrAction: "Older age",
    whyIncluded:
      "Advanced age is a recognized heat-vulnerability consideration during community transition.",
    sources: ["cdc-older-adults", "cdc-risk-factors", "who-keep-cool"],
    supports:
      "CDC identifies older adults as more vulnerable to heat-related illness; WHO emphasizes protective planning for at-risk groups.",
    doesNotSupport:
      "Does not validate HeatSafe point values, priority tiers, or outcome probabilities.",
  },
  {
    factorOrAction: "Heart failure / cardiovascular disease",
    whyIncluded:
      "Cardiovascular strain during heat events can be clinically relevant after hospital discharge.",
    sources: ["cdc-clinical-guidance", "cdc-risk-factors"],
    supports:
      "CDC clinical guidance notes cardiovascular conditions among factors that can increase heat-related risk.",
    doesNotSupport:
      "Does not validate automatic escalation thresholds or individual patient prognosis.",
  },
  {
    factorOrAction: "Kidney disease",
    whyIncluded:
      "Heat and dehydration can affect fluid and electrolyte balance in kidney disease.",
    sources: ["cdc-clinical-guidance", "cdc-risk-factors"],
    supports:
      "CDC guidance highlights chronic conditions that may increase vulnerability during extreme heat.",
    doesNotSupport:
      "Does not authorize automatic fluid changes or validate HeatSafe scoring weights.",
  },
  {
    factorOrAction: "Heat-sensitive medications",
    whyIncluded:
      "Some medication classes may require individualized review during hot weather.",
    sources: ["cdc-heat-medications", "cdc-clinical-guidance"],
    supports:
      "CDC recommends clinician or pharmacist medication review — not automatic changes — during heat events.",
    doesNotSupport:
      "Does not validate which medication classes HeatSafe flags or their point values.",
  },
  {
    factorOrAction: "Cooling availability at home",
    whyIncluded:
      "Access to a cool environment is part of heat protection after discharge.",
    sources: ["cdc-clinical-guidance", "who-keep-cool", "ahrq-ideal-discharge"],
    supports:
      "CDC and WHO emphasize cooling access; AHRQ discharge planning includes attention to home conditions.",
    doesNotSupport:
      "Does not prove that HeatSafe's AC weight prevents adverse outcomes.",
  },
  {
    factorOrAction: "Caregiver / social support",
    whyIncluded:
      "Support affects whether discharge plans can be implemented during heat events.",
    sources: ["ahrq-ideal-discharge", "cdc-clinical-guidance"],
    supports:
      "AHRQ IDEAL discharge planning emphasizes caregiver participation, follow-up, and warning signs.",
    doesNotSupport:
      "Does not validate social-factor point assignments or routing rules.",
  },
  {
    factorOrAction: "Destination environmental heat (FortyGuard)",
    whyIncluded:
      "Post-discharge heat exposure at the destination and arrival window can differ materially by location and time.",
    sources: ["cdc-clinical-guidance", "who-keep-cool"],
    supports:
      "Heat protection planning should reflect environmental conditions the patient will encounter.",
    doesNotSupport:
      "Does not validate FortyGuard as a clinical measurement standard or HeatSafe environmental point weights.",
  },
];

export const ACTION_METHODOLOGY: MethodologyEntry[] = [
  {
    factorOrAction: "Medication review",
    whyIncluded:
      "Heat-sensitive medication classes are flagged for pharmacist or treating-clinician review.",
    sources: ["cdc-heat-medications"],
    supports:
      "CDC clinician guidance supports individualized medication review during hot weather.",
    doesNotSupport:
      "Does not authorize HeatSafe to stop, start, or change medications automatically.",
  },
  {
    factorOrAction: "Cooling resource assessment",
    whyIncluded:
      "Verifies home cooling options before the patient leaves the hospital.",
    sources: ["cdc-clinical-guidance", "who-keep-cool", "ahrq-ideal-discharge"],
    supports:
      "Cooling access and home conditions are part of safe transition planning.",
    doesNotSupport:
      "Does not guarantee resource availability or validate HeatSafe routing.",
  },
  {
    factorOrAction: "Discharge coordination & follow-up",
    whyIncluded:
      "Owned follow-up helps confirm cooling access and warning-sign education.",
    sources: ["ahrq-ideal-discharge", "cdc-clinical-guidance"],
    supports:
      "AHRQ supports structured discharge planning with follow-up and warning signs.",
    doesNotSupport:
      "Does not prove reduced readmissions or validate follow-up timing weights.",
  },
  {
    factorOrAction: "Individualized fluid-plan review (HF/CKD)",
    whyIncluded:
      "When destination heat is high and HF or CKD is present, fluid guidance requires clinician judgment.",
    sources: ["cdc-clinical-guidance", "cdc-heat-medications"],
    supports:
      "CDC emphasizes individualized clinical review rather than generic hydration advice.",
    doesNotSupport:
      "Does not authorize automatic fluid orders or generic 'drink more water' instructions.",
  },
  {
    factorOrAction: "Patient heat-warning education",
    whyIncluded:
      "Patients and caregivers should know warning symptoms and when to seek care.",
    sources: ["cdc-clinical-guidance", "who-keep-cool"],
    supports:
      "CDC and WHO support education on heat-related warning signs.",
    doesNotSupport:
      "Does not constitute diagnosis or replace emergency clinical judgment.",
  },
];

export const CONTRIBUTION_BASIS_IDS: Record<string, ClinicalSourceId[]> = {
  "destination-mean-high": ["cdc-clinical-guidance", "who-keep-cool"],
  "destination-mean-moderate": ["cdc-clinical-guidance", "who-keep-cool"],
  "destination-max-high": ["cdc-clinical-guidance", "who-keep-cool"],
  "destination-max-moderate": ["cdc-clinical-guidance", "who-keep-cool"],
  "age-75-plus": ["cdc-older-adults", "cdc-risk-factors"],
  "age-65-74": ["cdc-older-adults", "cdc-risk-factors"],
  "cardiovascular-disease": ["cdc-clinical-guidance", "cdc-risk-factors"],
  "heart-failure": ["cdc-clinical-guidance", "cdc-risk-factors"],
  "kidney-disease": ["cdc-clinical-guidance", "cdc-risk-factors"],
  "respiratory-disease": ["cdc-risk-factors"],
  diabetes: ["cdc-risk-factors"],
  "cognitive-impairment": ["cdc-risk-factors", "cdc-clinical-guidance"],
  "limited-mobility": ["cdc-risk-factors", "who-keep-cool"],
  "no-working-ac": ["cdc-clinical-guidance", "who-keep-cool", "ahrq-ideal-discharge"],
  "lives-alone": ["ahrq-ideal-discharge", "cdc-clinical-guidance"],
  "no-reliable-transport": ["ahrq-ideal-discharge"],
  "no-caregiver-check-in": ["ahrq-ideal-discharge"],
  "power-dependent-equipment": ["cdc-clinical-guidance", "ahrq-ideal-discharge"],
};

export const ACTION_BASIS_IDS: Record<string, ClinicalSourceId[]> = {
  "patient-education": ["cdc-clinical-guidance", "who-keep-cool"],
  "cooling-resource-assessment": ["cdc-clinical-guidance", "who-keep-cool", "ahrq-ideal-discharge"],
  "follow-up-24-48": ["ahrq-ideal-discharge"],
  "medication-review": ["cdc-heat-medications"],
  "transport-cooling-planning": ["cdc-clinical-guidance", "who-keep-cool"],
  "transition-heat-planning": ["cdc-clinical-guidance"],
  "power-outage-contingency": ["cdc-clinical-guidance"],
  "fluid-plan-review": ["cdc-clinical-guidance", "cdc-heat-medications"],
};

export const ACTION_SHORT_TITLES: Record<string, string> = {
  "patient-education": "Patient heat-warning education",
  "cooling-resource-assessment": "Cooling resource assessment",
  "follow-up-24-48": "24–48 hour follow-up",
  "medication-review": "Medication review",
  "transport-cooling-planning": "Transport & cooling contingency",
  "transition-heat-planning": "Transition heat planning",
  "power-outage-contingency": "Power-outage contingency",
  "fluid-plan-review": "Individualized fluid-plan review",
};

export const FORTYGUARD_PRODUCT_COPY =
  "HeatSafe evaluates the environment the patient is transitioning into at their destination and expected arrival window. FortyGuard provides the location-and-time-specific environmental intelligence that changes the environmental contribution to discharge prioritization and can alter which heat-mitigation actions are surfaced.";

export const HEATSAFE_ROLE_COPY =
  "FortyGuard supplies environmental intelligence. HeatSafe applies patient-specific workflow interpretation, transparent scoring, and owned action coordination on top of that data.";

export function getSourcesForContribution(contributionId: string): ClinicalSource[] {
  const ids = CONTRIBUTION_BASIS_IDS[contributionId] ?? [];

  return ids.map((id) => CLINICAL_SOURCES[id]);
}

export function getSourcesForAction(actionId: string): ClinicalSource[] {
  const ids = ACTION_BASIS_IDS[actionId] ?? [];

  return ids.map((id) => CLINICAL_SOURCES[id]);
}

export function getActionShortTitle(actionId: string, fallback: string): string {
  return ACTION_SHORT_TITLES[actionId] ?? fallback;
}
