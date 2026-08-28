import { isSupportedArizonaLocation } from "@/lib/arizona-locations";

export type GeocodeCandidate = {
  id: string;
  label: string;
  cityState: string;
  latitude: number;
  longitude: number;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  postcode?: string;
};

export type NominatimSearchResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "HeatSafe-Discharge/1.0 (hackathon demo; contact: local)";

/** Arizona bounding box bias for Nominatim viewbox (west,south,east,north). */
const ARIZONA_VIEWBOX = "-114.82,31.33,-109.04,37.00";

export function formatGeocodeLabel(address: NominatimAddress | undefined, fallback: string): string {
  if (!address) {
    return fallback;
  }

  const street = [address.house_number, address.road].filter(Boolean).join(" ");
  const locality = address.city ?? address.town ?? address.village ?? address.county ?? "";
  const state = address.state ?? "Arizona";

  if (street && locality) {
    return `${street}, ${locality}, ${state}`;
  }

  if (locality) {
    return `${locality}, ${state}`;
  }

  return fallback;
}

export function formatCityState(address: NominatimAddress | undefined): string {
  if (!address) {
    return "Arizona";
  }

  const locality = address.city ?? address.town ?? address.village ?? address.county ?? "";
  const state = address.state ?? "AZ";

  return locality ? `${locality}, ${state}` : state;
}

export function parseNominatimResults(results: NominatimSearchResult[]): GeocodeCandidate[] {
  return results.map((result) => {
    const latitude = Number(result.lat);
    const longitude = Number(result.lon);

    return {
      id: String(result.place_id),
      label: formatGeocodeLabel(result.address, result.display_name),
      cityState: formatCityState(result.address),
      latitude,
      longitude,
    };
  });
}

export function partitionGeocodeCandidatesByArizonaScope(
  candidates: GeocodeCandidate[]
): {
  inArizona: GeocodeCandidate[];
  outsideArizona: GeocodeCandidate[];
} {
  const inArizona: GeocodeCandidate[] = [];
  const outsideArizona: GeocodeCandidate[] = [];

  for (const candidate of candidates) {
    if (isSupportedArizonaLocation(candidate.latitude, candidate.longitude)) {
      inArizona.push(candidate);
    } else {
      outsideArizona.push(candidate);
    }
  }

  return { inArizona, outsideArizona };
}

/** Returns true when the query clearly targets a location outside Arizona. */
export function isExplicitNonArizonaSearchQuery(address: string): boolean {
  const normalized = address.trim().toLowerCase();

  if (
    normalized.includes("arizona") ||
    normalized.endsWith(", az") ||
    normalized.includes(", az ")
  ) {
    return false;
  }

  const blockedTokens = [
    ", ca",
    " california",
    ", california",
    "los angeles",
    "san diego",
    ", tx",
    " texas",
    ", nv",
    " nevada",
    ", nm",
    " new mexico",
    ", ut",
    " utah",
    ", co",
    " colorado",
    ", wa",
    " washington",
    ", or",
    " oregon",
  ];

  return blockedTokens.some((token) => normalized.includes(token));
}

export async function searchArizonaAddresses(
  address: string,
  fetchImpl: typeof fetch = fetch
): Promise<{
  candidates: GeocodeCandidate[];
  outsideArizonaCount: number;
  rejectedExplicitNonArizona?: boolean;
}> {
  const trimmed = address.trim();

  if (trimmed.length < 3) {
    return { candidates: [], outsideArizonaCount: 0 };
  }

  if (isExplicitNonArizonaSearchQuery(trimmed)) {
    return {
      candidates: [],
      outsideArizonaCount: 1,
      rejectedExplicitNonArizona: true,
    };
  }

  const query = trimmed.toLowerCase().includes("arizona") || trimmed.toLowerCase().includes(", az")
    ? trimmed
    : `${trimmed}, Arizona, USA`;

  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "5",
    countrycodes: "us",
    viewbox: ARIZONA_VIEWBOX,
    bounded: "0",
  });

  const response = await fetchImpl(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Geocoder unavailable");
  }

  const payload = (await response.json()) as NominatimSearchResult[];
  const parsed = parseNominatimResults(payload);
  const { inArizona, outsideArizona } = partitionGeocodeCandidatesByArizonaScope(parsed);

  return {
    candidates: inArizona.slice(0, 5),
    outsideArizonaCount: outsideArizona.length,
  };
}
