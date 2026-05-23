import { reverseGeocodeLocation } from "@/lib/location-search";
import { AREA_HUBS, type AreaHub } from "@/lib/nigeria-locations";

export { searchAreaHubs } from "@/lib/nigeria-locations";

export type UserLocation = {
  latitude: number;
  longitude: number;
  capturedAt: string;
  state?: string;
  label?: string;
};

const USER_LOCATION_KEY = "geopulse.location";

export function searchAreaHubs(query: string, limit = 10): AreaHub[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return AREA_HUBS.filter((hub) => {
    const label = hub.label.toLowerCase();
    const state = hub.state.toLowerCase();
    return label.includes(normalized) || state.includes(normalized);
  }).slice(0, limit);
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const r = (v: number) => (v * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resolveNearestHub(latitude: number, longitude: number): AreaHub {
  return AREA_HUBS.reduce((best, hub) => {
    const d = haversineKm(latitude, longitude, hub.latitude, hub.longitude);
    const bd = haversineKm(latitude, longitude, best.latitude, best.longitude);
    return d < bd ? hub : best;
  }, AREA_HUBS[0]);
}

export function stateForCoordinates(latitude: number, longitude: number): string {
  return resolveNearestHub(latitude, longitude).state;
}

export function parseStoredUserLocation(raw: string | null): UserLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserLocation;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredUserLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  return parseStoredUserLocation(window.localStorage.getItem(USER_LOCATION_KEY));
}

export function saveUserLocation(value: UserLocation) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_LOCATION_KEY, JSON.stringify(value));
}

export async function requestAndStoreUserLocation(options?: {
  timeoutMs?: number;
  enableHighAccuracy?: boolean;
}) {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return null;
  }

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (next) => resolve(next),
      () => resolve(null),
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeoutMs ?? 8000,
      },
    );
  });

  if (!position) return null;

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const nearestHub = resolveNearestHub(latitude, longitude);

  let state = nearestHub.state;
  let label = `${nearestHub.label} · ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;

  try {
    const reverse = await reverseGeocodeLocation(latitude, longitude);
    if (reverse.state?.trim()) {
      state = reverse.state;
    }
    if (reverse.label?.trim()) {
      label = reverse.label;
    }
  } catch {
    // Fallback to nearest hub + coordinates when reverse geocoding fails.
  }

  const nextLocation: UserLocation = {
    latitude,
    longitude,
    capturedAt: new Date().toISOString(),
    state,
    label,
  };

  saveUserLocation(nextLocation);
  return nextLocation;
}
