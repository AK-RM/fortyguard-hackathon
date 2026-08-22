export type DischargeLocationConfig = {
  label: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

export const PHOENIX_DEMO_DISCHARGE_LOCATION: DischargeLocationConfig = {
  label: "Central Phoenix, Arizona — synthetic demo location",
  latitude: 33.4484,
  longitude: -112.074,
  timeZone: "America/Phoenix",
};

const KNOWN_DISCHARGE_LOCATIONS = [PHOENIX_DEMO_DISCHARGE_LOCATION];

export function findDischargeLocation(
  latitude: number,
  longitude: number
): DischargeLocationConfig | null {
  return (
    KNOWN_DISCHARGE_LOCATIONS.find(
      (location) =>
        Math.abs(latitude - location.latitude) < 0.05 &&
        Math.abs(longitude - location.longitude) < 0.05
    ) ?? null
  );
}
