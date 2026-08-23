export type HackathonDemoEnvironmentalScenario = {
  label: string;
  displayLocation: string;
  latitude: number;
  longitude: number;
  timeZone: string;
  date: string;
  time: string;
  plannedDischargeDisplay: string;
  environmentalSourceLabel: string;
  lockExplanation: string;
};

export const PHOENIX_DEMO_DISCHARGE_LOCATION: HackathonDemoEnvironmentalScenario =
  {
    label: "Central Phoenix, Arizona — synthetic demo location",
    displayLocation: "Central Phoenix, Arizona",
    latitude: 33.4484,
    longitude: -112.074,
    timeZone: "America/Phoenix",
    date: "2026-08-18",
    time: "14:00",
    plannedDischargeDisplay: "18 Aug 2026 at 14:00 local time",
    environmentalSourceLabel: "live/historical FortyGuard Temperature API",
    lockExplanation:
      "For hackathon judging, environmental inputs are locked to a tested Phoenix scenario so the workflow can be evaluated consistently. Patient and discharge-support factors remain interactive.",
  };

export const HACKATHON_DEMO_ENVIRONMENT_ERROR =
  "This hackathon deployment is configured for the validated Phoenix demo scenario only.";

export function getHackathonDemoEnvironmentalRequest() {
  return {
    latitude: PHOENIX_DEMO_DISCHARGE_LOCATION.latitude,
    longitude: PHOENIX_DEMO_DISCHARGE_LOCATION.longitude,
    date: PHOENIX_DEMO_DISCHARGE_LOCATION.date,
    time: PHOENIX_DEMO_DISCHARGE_LOCATION.time,
    timeZone: PHOENIX_DEMO_DISCHARGE_LOCATION.timeZone,
  };
}

export function isSupportedHackathonDemoEnvironment(input: {
  latitude: number;
  longitude: number;
  date: string;
  time: string;
  timeZone: string;
}): boolean {
  const demo = getHackathonDemoEnvironmentalRequest();

  return (
    input.latitude === demo.latitude &&
    input.longitude === demo.longitude &&
    input.date === demo.date &&
    input.time === demo.time &&
    input.timeZone === demo.timeZone
  );
}

const KNOWN_DISCHARGE_LOCATIONS = [PHOENIX_DEMO_DISCHARGE_LOCATION];

export function findDischargeLocation(
  latitude: number,
  longitude: number
): HackathonDemoEnvironmentalScenario | null {
  return (
    KNOWN_DISCHARGE_LOCATIONS.find(
      (location) =>
        Math.abs(latitude - location.latitude) < 0.05 &&
        Math.abs(longitude - location.longitude) < 0.05
    ) ?? null
  );
}
