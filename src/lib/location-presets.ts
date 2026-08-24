import type { ArizonaLocationPreset } from "@/lib/arizona-locations";
import type { DischargeLocation } from "@/types/discharge-workflow";

export function toDischargeLocation(preset: ArizonaLocationPreset): DischargeLocation {
  return {
    label: preset.label,
    latitude: preset.latitude,
    longitude: preset.longitude,
  };
}
