import { isPointInArizona } from "@/lib/arizona-boundary";

export type ArizonaLocationPreset = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  timeZone: "America/Phoenix";
  description: string;
  /** Present when coordinates should be manually verified against the named place. */
  verificationNote?: string;
};

export const ARIZONA_TIME_ZONE = "America/Phoenix";

export const ARIZONA_COVERAGE_ERROR =
  "This hackathon deployment supports Arizona locations only. Choose a validated Arizona preset or enter coordinates inside Arizona.";

export const PHOENIX_DEMO_PRESET: ArizonaLocationPreset = {
  id: "central-phoenix",
  label: "Central Phoenix, Arizona",
  latitude: 33.4484,
  longitude: -112.074,
  timeZone: "America/Phoenix",
  description: "Validated Phoenix demo scenario (18 Aug 2026, 14:00 local)",
};

/** Coordinates approximate the downtown Phoenix campus area — verify before production use. */
export const BANNER_PHOENIX_PRESET: ArizonaLocationPreset = {
  id: "banner-phoenix",
  label: "Banner — University Medical Center Phoenix",
  latitude: 33.4794,
  longitude: -112.0892,
  timeZone: "America/Phoenix",
  description: "Phoenix hospital origin preset",
  verificationNote:
    "Manual verification recommended: confirm coordinates match Banner — University Medical Center Phoenix.",
};

export const MESA_PRESET: ArizonaLocationPreset = {
  id: "mesa-destination",
  label: "Mesa, Arizona — post-discharge destination",
  latitude: 33.4152,
  longitude: -111.8315,
  timeZone: "America/Phoenix",
  description: "East Valley home destination preset",
  verificationNote:
    "Manual verification recommended: confirm coordinates match the intended Mesa destination.",
};

export const SCOTTSDALE_PRESET: ArizonaLocationPreset = {
  id: "scottsdale-destination",
  label: "Scottsdale, Arizona — post-discharge destination",
  latitude: 33.4942,
  longitude: -111.9261,
  timeZone: "America/Phoenix",
  description: "Scottsdale home destination preset",
  verificationNote:
    "Manual verification recommended: confirm coordinates match the intended Scottsdale destination.",
};

/** Coordinates approximate the Tucson Medical Center campus area — verify before production use. */
export const TUCSON_MEDICAL_PRESET: ArizonaLocationPreset = {
  id: "tucson-medical",
  label: "Tucson Medical Center area",
  latitude: 32.2411,
  longitude: -110.9462,
  timeZone: "America/Phoenix",
  description: "Southern Arizona hospital/destination preset",
  verificationNote:
    "Manual verification recommended: confirm coordinates match Tucson Medical Center.",
};

export const ARIZONA_LOCATION_PRESETS: ArizonaLocationPreset[] = [
  PHOENIX_DEMO_PRESET,
  BANNER_PHOENIX_PRESET,
  MESA_PRESET,
  SCOTTSDALE_PRESET,
  TUCSON_MEDICAL_PRESET,
];

export function isSupportedArizonaLocation(
  latitude: number,
  longitude: number
): boolean {
  return isPointInArizona(latitude, longitude);
}

export function findArizonaLocationPreset(
  latitude: number,
  longitude: number
): ArizonaLocationPreset | null {
  return (
    ARIZONA_LOCATION_PRESETS.find(
      (preset) =>
        Math.abs(latitude - preset.latitude) < 0.02 &&
        Math.abs(longitude - preset.longitude) < 0.02
    ) ?? null
  );
}

export function getPhoenixDemoDateTime() {
  return {
    date: "2026-08-18",
    time: "14:00",
    timeZone: ARIZONA_TIME_ZONE,
  };
}

export function getPresetById(id: string): ArizonaLocationPreset | null {
  return ARIZONA_LOCATION_PRESETS.find((preset) => preset.id === id) ?? null;
}
