export type LocationSearchResult = {
  id: string;
  label: string;
  description: string;
  latitude: number;
  longitude: number;
  state: string;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

const NIGERIA_STATE_NAMES = [
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
  const contextRegion =
    feature.properties?.context?.region?.name ??
    mapboxFeatureDescription(feature) ??
    mapboxFeatureLabel(feature);
  return normalizeStateName(contextRegion);
}

export async function searchLocations(query: string, limit = 5): Promise<LocationSearchResult[]> {
  if (!MAPBOX_TOKEN || query.trim().length < 2) {
    return [];
  }

  const searchParams = new URLSearchParams({
    q: query.trim(),
    access_token: MAPBOX_TOKEN,
    autocomplete: "true",
    country: "NG",
    language: "en",
    limit: String(limit),
    types: "address,street,place,locality,neighborhood",
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("Unable to load location suggestions right now.");
  }

  const payload = await response.json();
  const features = Array.isArray(payload?.features) ? (payload.features as MapboxFeature[]) : [];
  return features.flatMap((feature, index) => {
    const coordinates = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : [];
    const longitude = typeof coordinates[0] === "number" ? coordinates[0] : null;
    const latitude = typeof coordinates[1] === "number" ? coordinates[1] : null;
    if (latitude === null || longitude === null) {
      return [];
    }

    return [
      {
        id: String(feature.mapbox_id ?? feature.id ?? `${latitude}:${longitude}:${index}`),
        label: mapboxFeatureLabel(feature) || coordinateLocationLabel(latitude, longitude),
        description: mapboxFeatureDescription(feature),
        latitude,
        longitude,
        state: mapboxFeatureState(feature),
      },
    ];
  });
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

