import { searchAreaHubs } from "@/lib/nigeria-locations";
export type LocationSearchResult = {
  id: string;
  label: string;
  description: string;
  latitude: number;
  longitude: number;
  state: string;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

export const NIGERIA_STATE_NAMES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

export const NIGERIA_STATE_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  "Abia": { latitude: 5.4167, longitude: 7.3667 },
  "Adamawa": { latitude: 9.3265, longitude: 12.3984 },
  "Akwa Ibom": { latitude: 4.9057, longitude: 7.8497 },
  "Anambra": { latitude: 6.2209, longitude: 6.9926 },
  "Bauchi": { latitude: 10.3158, longitude: 9.7492 },
  "Bayelsa": { latitude: 4.7719, longitude: 6.0671 },
  "Benue": { latitude: 7.1906, longitude: 8.7955 },
  "Borno": { latitude: 11.8333, longitude: 13.0781 },
  "Cross River": { latitude: 5.9631, longitude: 8.3267 },
  "Delta": { latitude: 5.4839, longitude: 6.1167 },
  "Ebonyi": { latitude: 6.3249, longitude: 8.0832 },
  "Edo": { latitude: 6.335, longitude: 5.6037 },
  "Ekiti": { latitude: 7.6222, longitude: 5.221 },
  "Enugu": { latitude: 6.4584, longitude: 7.485 },
  "FCT Abuja": { latitude: 9.0579, longitude: 7.4898 },
  "Gombe": { latitude: 10.2791, longitude: 11.1667 },
  "Imo": { latitude: 5.4966, longitude: 7.0498 },
  "Jigawa": { latitude: 12.228, longitude: 9.5582 },
  "Kaduna": { latitude: 10.5222, longitude: 7.444 },
  "Kano": { latitude: 12.0022, longitude: 8.5169 },
  "Katsina": { latitude: 12.9908, longitude: 7.6013 },
  "Kebbi": { latitude: 12.4539, longitude: 4.1975 },
  "Kogi": { latitude: 7.7337, longitude: 6.7387 },
  "Kwara": { latitude: 8.9669, longitude: 4.5539 },
  "Lagos": { latitude: 6.5244, longitude: 3.3792 },
  "Nasarawa": { latitude: 8.4966, longitude: 8.5259 },
  "Niger": { latitude: 9.9309, longitude: 5.5983 },
  "Ogun": { latitude: 7.16, longitude: 3.35 },
  "Ondo": { latitude: 6.9149, longitude: 4.8331 },
  "Osun": { latitude: 7.5629, longitude: 4.5584 },
  "Oyo": { latitude: 7.8504, longitude: 3.947 },
  "Plateau": { latitude: 9.2182, longitude: 8.8921 },
  "Rivers": { latitude: 4.8156, longitude: 6.998 },
  "Sokoto": { latitude: 13.0059, longitude: 5.2474 },
  "Taraba": { latitude: 7.8737, longitude: 11.4581 },
  "Yobe": { latitude: 12.2938, longitude: 11.5883 },
  "Zamfara": { latitude: 12.17, longitude: 6.237 },
};

function normalizeStateName(value: string) {
  const lower = value.trim().toLowerCase();
  if (!lower) return "Lagos";
  if (lower.includes("federal capital")) return "FCT Abuja";
  const matched = NIGERIA_STATE_NAMES.find((state) => lower.includes(state.toLowerCase()));
  return matched ?? "Lagos";
}

function coordinateLocationLabel(latitude: number, longitude: number) {
  return `Near ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

type MapboxFeature = {
  id?: string;
  mapbox_id?: string;
  geometry?: { coordinates?: unknown[] };
  properties?: {
    full_address?: string;
    place_formatted?: string;
    name_preferred?: string;
    name?: string;
    context?: {
      region?: { name?: string };
    };
  };
  full_address?: string;
  place_formatted?: string;
  name_preferred?: string;
  name?: string;
};

function mapboxFeatureLabel(feature: MapboxFeature) {
  return (
    feature.full_address ??
    feature.properties?.full_address ??
    feature.name_preferred ??
    feature.properties?.name_preferred ??
    feature.name ??
    feature.properties?.name ??
    feature.place_formatted ??
    feature.properties?.place_formatted ??
    ""
  ).trim();
}

function mapboxFeatureDescription(feature: MapboxFeature) {
  return (
    feature.place_formatted ??
    feature.properties?.place_formatted ??
    ""
  ).trim();
}

function mapboxFeatureState(feature: MapboxFeature) {
  const contextRegion = feature.properties?.context?.region?.name?.trim();
  if (!contextRegion) return "";
  return normalizeStateName(contextRegion);
}

function buildScopedQuery(query: string, state?: string) {
  const parts = [query.trim(), state?.trim()].filter(Boolean) as string[];
  const scopedParts: string[] = [];

  for (const part of parts) {
    if (!scopedParts.some((existing) => existing.toLowerCase() === part.toLowerCase())) {
      scopedParts.push(part);
    }
  }

  if (scopedParts.length === 0) return "";
  return `${scopedParts.join(", ")}, Nigeria`;
}

export function searchStateSuggestions(query: string, limit = 5) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return NIGERIA_STATE_NAMES.filter((state) => state.toLowerCase().includes(normalized))
    .slice(0, limit)
    .map((state) => {
      const center = NIGERIA_STATE_CENTERS[state] ?? { latitude: 9.082, longitude: 8.6753 };
      return {
        id: `state-${state.toLowerCase().replace(/\s+/g, "-")}`,
        label: state,
        description: "State",
        latitude: center.latitude,
        longitude: center.longitude,
        state,
      } satisfies LocationSearchResult;
    });
}

async function fetchLocationFeatures(
  query: string,
  limit: number,
  proximity?: { latitude: number; longitude: number },
): Promise<MapboxFeature[]> {
  const searchParams = new URLSearchParams({
    q: query,
    access_token: MAPBOX_TOKEN,
    autocomplete: "true",
    country: "NG",
    language: "en",
    limit: String(limit),
    types: "address,street,place,locality,neighborhood,postcode,district,suburb,poi",
  });

  if (proximity) {
    searchParams.set("proximity", `${proximity.longitude},${proximity.latitude}`);
  }

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("Unable to load location suggestions right now.");
  }

  const payload = await response.json();
  return Array.isArray(payload?.features) ? (payload.features as MapboxFeature[]) : [];
}

export async function searchLocations(
  query: string,
  limit = 5,
  options?: { state?: string },
): Promise<LocationSearchResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    return [];
  }

  const localCityResults = searchAreaHubs(normalizedQuery, limit * 2, options).map((hub) => ({
    id: `city-${hub.label.toLowerCase().replace(/\s+/g, "-")}`,
    label: hub.label,
    description: "City",
    latitude: hub.latitude,
    longitude: hub.longitude,
    state: hub.state,
  } satisfies LocationSearchResult));
  const localStateResults = searchStateSuggestions(normalizedQuery, limit).map((result) => ({
    id: result.id,
    label: result.label,
    description: result.description,
    latitude: result.latitude,
    longitude: result.longitude,
    state: result.state,
  } satisfies LocationSearchResult));

  if (!MAPBOX_TOKEN) {
    return [...localStateResults, ...localCityResults]
      .filter((item, index, self) => self.findIndex((candidate) => candidate.label === item.label && candidate.state === item.state) === index)
      .slice(0, limit);
  }

  const scopedQuery = buildScopedQuery(query, options?.state);
  const requestedState = options?.state?.trim().toLowerCase() ?? "";
  const stateCenter = options?.state ? NIGERIA_STATE_CENTERS[options.state] : undefined;
  const queryVariants = [scopedQuery || query.trim(), query.trim()].filter(
    (value, index, self) => Boolean(value) && self.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index,
  );

  const features: MapboxFeature[] = [];
  for (const variant of queryVariants) {
    const nextFeatures = await fetchLocationFeatures(variant, Math.max(limit * 2, 10), stateCenter);
    features.push(...nextFeatures);
  }

  const seen = new Set<string>();
  const mapped = features.flatMap((feature, index) => {
    const coordinates = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : [];
    const longitude = typeof coordinates[0] === "number" ? coordinates[0] : null;
    const latitude = typeof coordinates[1] === "number" ? coordinates[1] : null;
    if (latitude === null || longitude === null) {
      return [];
    }

    const detectedState = mapboxFeatureState(feature);
    const normalizedDetectedState = detectedState.trim().toLowerCase();
    if (requestedState && normalizedDetectedState && normalizedDetectedState !== requestedState) {
      return [];
    }

    const state = options?.state ?? detectedState ?? "Nigeria";

    const id = String(feature.mapbox_id ?? feature.id ?? `${latitude}:${longitude}:${index}`);
    if (seen.has(id)) {
      return [];
    }
    seen.add(id);

    return [
      {
        id,
        label: mapboxFeatureLabel(feature) || coordinateLocationLabel(latitude, longitude),
        description: mapboxFeatureDescription(feature),
        latitude,
        longitude,
        state,
      },
    ];
  });

  const merged = [...localStateResults, ...localCityResults, ...mapped].filter(
    (item, index, self) => self.findIndex((candidate) => candidate.label === item.label && candidate.state === item.state) === index,
  );

  return merged.slice(0, limit);
}

export async function reverseGeocodeLocation(latitude: number, longitude: number) {
  if (!MAPBOX_TOKEN) {
    return {
      label: coordinateLocationLabel(latitude, longitude),
      state: "Lagos",
    };
  }

  const searchParams = new URLSearchParams({
    longitude: String(longitude),
    latitude: String(latitude),
    access_token: MAPBOX_TOKEN,
    language: "en",
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${searchParams.toString()}`);
  if (!response.ok) {
    return {
      label: coordinateLocationLabel(latitude, longitude),
      state: "Lagos",
    };
  }

  const payload = await response.json();
  const feature = Array.isArray(payload?.features) ? (payload.features[0] as MapboxFeature | undefined) : undefined;
  if (!feature) {
    return {
      label: coordinateLocationLabel(latitude, longitude),
      state: "Lagos",
    };
  }

  return {
    label: mapboxFeatureLabel(feature) || coordinateLocationLabel(latitude, longitude),
    state: mapboxFeatureState(feature),
  };
}

