import {
  ARIZONA_COVERAGE_ERROR,
  ARIZONA_TIME_ZONE,
  isSupportedArizonaLocation,
  findArizonaLocationPreset,
} from "@/lib/arizona-locations";

export {
  ARIZONA_COVERAGE_ERROR,
  ARIZONA_TIME_ZONE,
  PHOENIX_DEMO_PRESET as PHOENIX_DEMO_DISCHARGE_LOCATION,
  getPhoenixDemoDateTime,
  isSupportedArizonaLocation,
  findArizonaLocationPreset as findDischargeLocation,
} from "@/lib/arizona-locations";

export const HACKATHON_DEMO_ENVIRONMENT_ERROR = ARIZONA_COVERAGE_ERROR;

export function isSupportedHackathonDemoEnvironment(input: {
  latitude: number;
  longitude: number;
}): boolean {
  return isSupportedArizonaLocation(input.latitude, input.longitude);
}

export function getHackathonDemoEnvironmentalRequest() {
  const demo = findArizonaLocationPreset(33.4484, -112.074);

  return {
    latitude: demo?.latitude ?? 33.4484,
    longitude: demo?.longitude ?? -112.074,
    date: "2026-08-18",
    time: "14:00",
    timeZone: ARIZONA_TIME_ZONE,
  };
}
