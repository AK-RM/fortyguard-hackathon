"use client";

import { useState } from "react";

import {
  ARIZONA_LOCATION_PRESETS,
  type ArizonaLocationPreset,
} from "@/lib/arizona-locations";
import type { GeocodeCandidate } from "@/lib/geocoding";
import {
  buildLocationFromCoordinates,
  buildLocationFromGeocodeResult,
  buildLocationFromPreset,
  validateArizonaDestinationCoordinates,
  validateLatitude,
  validateLongitude,
} from "@/lib/location-coordinates";
import type { DischargeLocation } from "@/types/discharge-workflow";

export type DestinationLocationMethod = "preset" | "address" | "coordinates";

type DestinationLocationControlProps = {
  destination: DischargeLocation;
  onChange: (destination: DischargeLocation) => void;
  /** When true, show the three entry methods before any confirmed summary. */
  showMethodSelectorFirst?: boolean;
};

type GeocodeUiState =
  | "idle"
  | "searching"
  | "results"
  | "no_results"
  | "outside_arizona"
  | "error";

const METHOD_OPTIONS: Array<{ id: DestinationLocationMethod; label: string }> = [
  { id: "preset", label: "Choose Arizona location" },
  { id: "address", label: "Find from address" },
  { id: "coordinates", label: "Enter coordinates" },
];

export function inferInitialDestinationMethod(
  destination: DischargeLocation
): DestinationLocationMethod {
  const matchedPreset = ARIZONA_LOCATION_PRESETS.find(
    (preset) =>
      Math.abs(preset.latitude - destination.latitude) < 0.0001 &&
      Math.abs(preset.longitude - destination.longitude) < 0.0001
  );

  if (matchedPreset) {
    return "preset";
  }

  if (destination.label !== "Custom coordinates") {
    return "address";
  }

  return "coordinates";
}

function findMatchingPreset(destination: DischargeLocation): ArizonaLocationPreset | null {
  return (
    ARIZONA_LOCATION_PRESETS.find(
      (preset) =>
        Math.abs(preset.latitude - destination.latitude) < 0.0001 &&
        Math.abs(preset.longitude - destination.longitude) < 0.0001
    ) ?? null
  );
}

export function DestinationLocationControl({
  destination,
  onChange,
  showMethodSelectorFirst = false,
}: DestinationLocationControlProps) {
  const [activeMethod, setActiveMethod] = useState<DestinationLocationMethod | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(() => {
    if (showMethodSelectorFirst) {
      return false;
    }

    return (
      validateArizonaDestinationCoordinates(destination.latitude, destination.longitude) === null
    );
  });
  const [selectedPresetId, setSelectedPresetId] = useState(
    findMatchingPreset(destination)?.id ?? ARIZONA_LOCATION_PRESETS[0]?.id ?? ""
  );
  const [latitudeInput, setLatitudeInput] = useState(String(destination.latitude));
  const [longitudeInput, setLongitudeInput] = useState(String(destination.longitude));
  const [coordinateError, setCoordinateError] = useState<string | null>(null);
  const [addressQuery, setAddressQuery] = useState("");
  const [geocodeState, setGeocodeState] = useState<GeocodeUiState>("idle");
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeCandidate[]>([]);

  function confirmDestination(next: DischargeLocation) {
    setLatitudeInput(String(next.latitude));
    setLongitudeInput(String(next.longitude));
    setCoordinateError(null);
    onChange(next);
    setIsConfirmed(true);
    setActiveMethod(null);
    setGeocodeResults([]);
    setGeocodeState("idle");
    setGeocodeMessage(null);
  }

  function handleChangeDestination() {
    setIsConfirmed(false);
    setActiveMethod(inferInitialDestinationMethod(destination));
    setGeocodeResults([]);
    setGeocodeState("idle");
    setGeocodeMessage(null);
  }

  function handleSelectMethod(method: DestinationLocationMethod) {
    setActiveMethod(method);
    setCoordinateError(null);
    setGeocodeMessage(null);
    setGeocodeResults([]);
    setGeocodeState("idle");
  }

  function handlePresetConfirm() {
    const preset = ARIZONA_LOCATION_PRESETS.find((item) => item.id === selectedPresetId);

    if (!preset) {
      return;
    }

    confirmDestination(buildLocationFromPreset(preset));
  }

  function handleManualCoordinatesConfirm() {
    const latitude = Number(latitudeInput);
    const longitude = Number(longitudeInput);
    const validationError = validateArizonaDestinationCoordinates(latitude, longitude);

    if (validationError) {
      setCoordinateError(validationError);
      return;
    }

    confirmDestination(buildLocationFromCoordinates(latitude, longitude));
  }

  function handleUseGeocodeResult(candidate: GeocodeCandidate) {
    const applied = buildLocationFromGeocodeResult({
      label: candidate.label,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    });

    if ("error" in applied) {
      setGeocodeState("outside_arizona");
      setGeocodeMessage(applied.error);
      return;
    }

    confirmDestination(applied);
  }

  async function handleFindLocation() {
    const query = addressQuery.trim();

    if (query.length < 3) {
      setGeocodeState("idle");
      setGeocodeMessage("Enter at least 3 characters to search.");
      return;
    }

    setGeocodeState("searching");
    setGeocodeMessage(null);
    setGeocodeResults([]);

    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: query }),
      });

      const payload = (await response.json()) as {
        candidates?: GeocodeCandidate[];
        outsideArizonaCount?: number;
        error?: string;
        unavailable?: boolean;
      };

      if (!response.ok) {
        setGeocodeState("error");
        setGeocodeMessage(
          payload.error ??
            "Location lookup is temporarily unavailable. You can still enter coordinates manually."
        );
        return;
      }

      const candidates = payload.candidates ?? [];

      if (candidates.length === 0) {
        if ((payload.outsideArizonaCount ?? 0) > 0) {
          setGeocodeState("outside_arizona");
          setGeocodeMessage(
            "Location outside supported area. This hackathon deployment currently supports Arizona destinations."
          );
          return;
        }

        setGeocodeState("no_results");
        setGeocodeMessage(
          "We couldn't find that address. Try a more specific Arizona address or enter coordinates manually."
        );
        return;
      }

      setGeocodeState("results");
      setGeocodeResults(candidates);
    } catch {
      setGeocodeState("error");
      setGeocodeMessage(
        "Location lookup is temporarily unavailable. You can still enter coordinates manually."
      );
    }
  }

  function validateCoordinateInputs(): string | null {
    const latitudeError = validateLatitude(Number(latitudeInput));
    if (latitudeError) {
      return latitudeError;
    }

    const longitudeError = validateLongitude(Number(longitudeInput));
    if (longitudeError) {
      return longitudeError;
    }

    return null;
  }

  if (isConfirmed) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Post-discharge destination
          </h3>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-sm font-semibold text-emerald-900">Destination confirmed ✓</p>
          <p className="mt-2 break-words text-sm font-medium text-slate-900">
            {destination.label}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-slate-600">
            {destination.latitude.toFixed(4)}, {destination.longitude.toFixed(4)}
          </p>
          <button
            type="button"
            onClick={handleChangeDestination}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Post-discharge destination
        </h3>
        <p className="mt-2 text-sm font-medium text-slate-900">
          How would you like to set the location?
        </p>
      </div>

      <div
        className="grid gap-2 sm:grid-cols-3"
        role="tablist"
        aria-label="Destination location method"
      >
        {METHOD_OPTIONS.map((option) => {
          const isActive = activeMethod === option.id;

          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelectMethod(option.id)}
              className={`min-h-11 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                isActive
                  ? "border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-200"
                  : "border-slate-300 bg-white text-slate-800 hover:border-sky-300 hover:bg-sky-50/40"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {activeMethod === "preset" ? (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Choose Arizona location</h4>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Arizona location</span>
            <select
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
              className="w-full min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2"
            >
              {ARIZONA_LOCATION_PRESETS.map((preset: ArizonaLocationPreset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          {selectedPresetId ? (
            <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <p className="font-medium text-slate-900">Selected destination</p>
              <p className="mt-1 break-words text-slate-800">
                {ARIZONA_LOCATION_PRESETS.find((preset) => preset.id === selectedPresetId)?.label}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-500">
                {ARIZONA_LOCATION_PRESETS.find((preset) => preset.id === selectedPresetId)?.latitude.toFixed(4)}
                ,{" "}
                {ARIZONA_LOCATION_PRESETS.find((preset) => preset.id === selectedPresetId)?.longitude.toFixed(4)}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handlePresetConfirm}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 sm:w-auto"
          >
            Use this location
          </button>
        </section>
      ) : null}

      {activeMethod === "address" ? (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Find discharge destination</h4>
          <p className="text-xs text-slate-500">Demo environment — use synthetic addresses only.</p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Address</span>
            <input
              type="text"
              value={addressQuery}
              onChange={(event) => setAddressQuery(event.target.value)}
              placeholder="123 N Example St, Phoenix, AZ"
              className="w-full min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleFindLocation()}
            disabled={geocodeState === "searching"}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {geocodeState === "searching" ? "Finding location…" : "Find location"}
          </button>

          {geocodeState === "searching" ? (
            <p className="text-sm text-slate-600" aria-live="polite">
              Finding location…
            </p>
          ) : null}

          {geocodeMessage ? (
            <p className="text-sm text-slate-700" role="status" aria-live="polite">
              {geocodeMessage}
            </p>
          ) : null}

          {geocodeState === "results" ? (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Found locations</p>
              <ul className="space-y-2" aria-label="Found locations">
                {geocodeResults.map((candidate) => (
                  <li key={candidate.id}>
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <p className="text-sm font-medium text-slate-900">{candidate.label}</p>
                      <p className="text-sm text-slate-600">{candidate.cityState}</p>
                      <p className="mt-1 break-all font-mono text-xs text-slate-500">
                        {candidate.latitude.toFixed(4)}, {candidate.longitude.toFixed(4)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleUseGeocodeResult(candidate)}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
                      >
                        Use this location
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeMethod === "coordinates" ? (
        <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">Enter coordinates</h4>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Latitude</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={latitudeInput}
              onChange={(event) => setLatitudeInput(event.target.value)}
              className="w-full min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2"
              aria-invalid={coordinateError ? true : undefined}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Longitude</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={longitudeInput}
              onChange={(event) => setLongitudeInput(event.target.value)}
              className="w-full min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2"
              aria-invalid={coordinateError ? true : undefined}
            />
          </label>
          {coordinateError ? (
            <p className="text-sm text-red-700" role="alert">
              {coordinateError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              const inputError = validateCoordinateInputs();
              if (inputError) {
                setCoordinateError(inputError);
                return;
              }
              handleManualCoordinatesConfirm();
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 sm:w-auto"
          >
            Use coordinates
          </button>
        </section>
      ) : null}
    </div>
  );
}
