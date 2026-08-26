import { describe, expect, it } from "vitest";

import {
  formatGeocodeLabel,
  parseNominatimResults,
  partitionGeocodeCandidatesByArizonaScope,
  type NominatimSearchResult,
} from "@/lib/geocoding";
import {
  buildLocationFromCoordinates,
  buildLocationFromGeocodeResult,
  CUSTOM_COORDINATES_LABEL,
  resolveLocationLabelFromCoordinates,
  validateArizonaDestinationCoordinates,
  validateDestinationForAssessment,
} from "@/lib/location-coordinates";
import { DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C } from "@/lib/demo-cases";
import { evaluateHeatDischargeRisk } from "@/lib/heat-discharge-risk";
import { buildEnvironmentalQueryFromDischarge } from "@/lib/environmental-query";
import { createDischargeRecordFromDemoCase } from "@/lib/demo-cases";

describe("location coordinate consistency", () => {
  it("updates label and coordinates atomically from geocode result", () => {
    const location = buildLocationFromGeocodeResult({
      label: "850 E McDowell Rd, Phoenix, Arizona",
      latitude: 33.4561,
      longitude: -112.0624,
    });

    expect("error" in location).toBe(false);

    if (!("error" in location)) {
      expect(location.label).toContain("Phoenix");
      expect(location.latitude).toBeCloseTo(33.4561, 4);
      expect(location.longitude).toBeCloseTo(-112.0624, 4);
    }
  });

  it("clears stale resolved label when coordinates are manually changed", () => {
    const resolved = buildLocationFromGeocodeResult({
      label: "Tucson Medical Center area",
      latitude: 33.5,
      longitude: -112.07,
    });

    expect("error" in resolved).toBe(false);

    const manual = buildLocationFromCoordinates(33.51, -112.08);

    expect(manual.label).toBe(CUSTOM_COORDINATES_LABEL);
    expect(manual.label).not.toBe("Tucson Medical Center area");
  });

  it("keeps preset label when coordinates still match a preset", () => {
    const label = resolveLocationLabelFromCoordinates(33.4484, -112.074);

    expect(label).toBe("Central Phoenix, Arizona");
  });

  it("rejects outside-Arizona geocode coordinates", () => {
    const location = buildLocationFromGeocodeResult({
      label: "Los Angeles, California",
      latitude: 34.0522,
      longitude: -118.2437,
    });

    expect(location).toEqual({
      error: expect.stringContaining("outside supported area"),
    });
  });

  it("rejects invalid latitude and longitude", () => {
    expect(validateArizonaDestinationCoordinates(999, -112)).toMatch(/Latitude/);
    expect(validateArizonaDestinationCoordinates(33, 999)).toMatch(/Longitude/);
  });

  it("allows manual Arizona coordinates without geocoder", () => {
    const location = buildLocationFromCoordinates(33.4484, -112.074);

    expect(validateDestinationForAssessment(location)).toBeNull();
  });
});

describe("geocoding parsing", () => {
  it("parses nominatim results and filters to Arizona scope", () => {
    const raw: NominatimSearchResult[] = [
      {
        place_id: 1,
        lat: "33.4561",
        lon: "-112.0624",
        display_name: "Phoenix, Arizona",
        address: {
          house_number: "850",
          road: "E McDowell Rd",
          city: "Phoenix",
          state: "Arizona",
        },
      },
      {
        place_id: 2,
        lat: "40.7128",
        lon: "-74.0060",
        display_name: "New York, NY",
        address: { city: "New York", state: "New York" },
      },
    ];

    const parsed = parseNominatimResults(raw);
    const { inArizona, outsideArizona } = partitionGeocodeCandidatesByArizonaScope(parsed);

    expect(inArizona).toHaveLength(1);
    expect(outsideArizona).toHaveLength(1);
    expect(formatGeocodeLabel(raw[0]?.address, raw[0]?.display_name ?? "")).toContain(
      "McDowell"
    );
  });
});

describe("clinical and environmental regression", () => {
  it("keeps HS-001/002/003 demo coordinates and risk outputs unchanged", () => {
    for (const demoCase of [DEMO_CASE_A, DEMO_CASE_B, DEMO_CASE_C]) {
      const record = createDischargeRecordFromDemoCase(demoCase);
      const query = buildEnvironmentalQueryFromDischarge(
        record.destination,
        record.journey
      );

      expect(validateDestinationForAssessment(record.destination)).toBeNull();
      expect(query.latitude).toBeCloseTo(33.4484, 3);
      expect(query.longitude).toBeCloseTo(-112.074, 3);
    }

    const hs001 = evaluateHeatDischargeRisk({
      environmental: {
        destination: { meanTemperature: 41.6, maximumTemperature: 41.6 },
        transition: { points: 9, label: "Public bus", explanation: "Test" },
      },
      patient: DEMO_CASE_A.profile.patient,
      medications: DEMO_CASE_A.profile.medications,
      homeSocial: DEMO_CASE_A.profile.homeSocial,
    });

    expect(hs001.priority).toBe("urgent");
    expect(hs001.recommendedActions).toHaveLength(6);
  });
});

describe("journey presentation", () => {
  it("does not use JourneyMap in discharge workspace source", async () => {
    const workspaceSource = await import("fs/promises").then((fs) =>
      fs.readFile(
        new URL("../components/discharge-workspace.tsx", import.meta.url),
        "utf8"
      )
    );

    expect(workspaceSource.includes("JourneyMap")).toBe(false);
    expect(workspaceSource.includes("JourneySummary")).toBe(true);
  });
});

describe("destination location UX", () => {
  it("infers preset method when coordinates match a trusted preset", async () => {
    const { inferInitialDestinationMethod } = await import(
      "@/components/destination-location-control"
    );

    expect(
      inferInitialDestinationMethod({
        label: "Central Phoenix, Arizona",
        latitude: 33.4484,
        longitude: -112.074,
      })
    ).toBe("preset");
  });

  it("infers address method when label is a resolved geocode label", async () => {
    const { inferInitialDestinationMethod } = await import(
      "@/components/destination-location-control"
    );

    expect(
      inferInitialDestinationMethod({
        label: "123 N Example St, Phoenix, Arizona",
        latitude: 33.4561,
        longitude: -112.0624,
      })
    ).toBe("address");
  });

  it("infers coordinates method for custom coordinate entries", async () => {
    const { inferInitialDestinationMethod } = await import(
      "@/components/destination-location-control"
    );

    expect(
      inferInitialDestinationMethod({
        label: CUSTOM_COORDINATES_LABEL,
        latitude: 33.51,
        longitude: -112.08,
      })
    ).toBe("coordinates");
  });

  it("does not expose all destination entry methods at once", async () => {
    const source = await import("fs/promises").then((fs) =>
      fs.readFile(
        new URL("../components/destination-location-control.tsx", import.meta.url),
        "utf8"
      )
    );

    expect(source).toContain("Choose Arizona location");
    expect(source).toContain("Find from address");
    expect(source).toContain("Enter coordinates");
    expect(source).toContain("Find location");
    expect(source).toContain("Destination confirmed");
    expect(source).not.toContain("Find coordinates from address");

    const presetSection = source.slice(
      source.indexOf('activeMethod === "preset"'),
      source.indexOf('activeMethod === "address"')
    );
    const addressSection = source.slice(
      source.indexOf('activeMethod === "address"'),
      source.indexOf('activeMethod === "coordinates"')
    );
    const coordinatesSection = source.slice(source.indexOf('activeMethod === "coordinates"'));

    expect(presetSection).toContain("<select");
    expect(presetSection).not.toContain("Find discharge destination");
    expect(addressSection).toContain("Find discharge destination");
    expect(addressSection).not.toContain('type="number"');
    expect(coordinatesSection).toContain("Latitude");
    expect(coordinatesSection).toContain("Longitude");
  });

  it("keeps prepared demo cases on read-only summary without destination selector", async () => {
    const workspaceSource = await import("fs/promises").then((fs) =>
      fs.readFile(
        new URL("../components/discharge-workspace.tsx", import.meta.url),
        "utf8"
      )
    );

    expect(workspaceSource).toContain("PreparedCaseSummary");
    expect(workspaceSource).toContain("showEditDetails");
    expect(workspaceSource).toContain("showMethodSelectorFirst={!isDemoCase}");
  });
});
