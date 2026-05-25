"use client";

import {
  useEffect, useMemo, useState, useCallback, useRef,
  type Dispatch, type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { DashboardMap } from "@/components/dashboard-map";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole, getPublicNavItems, type NavItem } from "@/lib/access";
import { formatReportType, normalizeReportType } from "@/lib/report-types";
import { searchLocations, searchStateSuggestions, type LocationSearchResult } from "@/lib/location-search";
import { searchAreaHubs } from "@/lib/user-location";

// ─── Types ────────────────────────────────────────────────────────────────────

type IncidentRecord = {
  id: number; title: string; incident_type: string; confidence: string;
  severity: string; status: string; location_name: string;
  latitude: number | string | null; longitude: number | string | null;
  summary: string; detected_at: string; created_at: string;
  visibility_score?: number;
};

type WatchZoneRecord = {
  id: number; name: string; zone_type: string; current_risk_level: string;
  current_risk_score: number | string | null;
  centroid_latitude: number | string | null;
  centroid_longitude: number | string | null;
};

type GeofenceRecord = {
  id: number; name: string; geofence_type: string; status: string;
  centroid_latitude: number | string | null;
  centroid_longitude: number | string | null;
  radius_meters: number | string | null; description: string;
};

type DashboardAlert = {
  id: number; level: string; triggeredAt?: string;
  title: string; body: string; meta: string;
};

type ApiListResponse<T> = { results?: T[] };

type MapIncidentPoint = {
  id: number; title: string; incidentType: string; severity: string;
  confidence: string; status: string; summary: string; detectedAt: string;
  latitude: number; longitude: number; locationName: string;
  visibilityScore?: number;
};

type WatchZonePoint = {
  id: number; name: string; riskLevel: string;
  riskScore: number; latitude: number; longitude: number;
};

type RouteHub = {
  id: string; label: string; state: string;
  latitude: number; longitude: number;
};

type RouteHubSuggestion = {
  id: string; label: string; state: string;
  latitude: number; longitude: number;
  description: string;
  kind: "state" | "city" | "place" | "street";
};

type RouteStop = {
  label: string; latitude: number; longitude: number;
  kind: "origin" | "waypoint" | "destination";
};

type ScoredIncident = MapIncidentPoint & { distanceKm: number; weight: number };
type ScoredWatchZone = WatchZonePoint & { distanceKm: number; weight: number };

type RiskLevel = "low" | "guarded" | "elevated" | "high" | "critical";
type TravelMode = "drive" | "walk" | "transit";

type RouteOption = {
  id: string;
  label: string; // e.g. "Via Lokoja", "Via Ibadan"
  score: number;
  level: RiskLevel;
  distanceKm: number;
  durationMin: number;
  corridorKm: number;
  routePath: Array<[number, number]>;
  routeStops: RouteStop[];
  incidents: ScoredIncident[];
  watchZones: ScoredWatchZone[];
  summary: string;
  advisories: string[];
  timingNote: string;
  isBest: boolean;
  isFastest: boolean;
  isSafest: boolean;
};

type LivePosition = {
  latitude: number; longitude: number; accuracy: number | null;
  speedKph: number | null; heading: number | null; updatedAt: string;
};

type LiveAlertSeverity = "info" | "warning" | "critical";

type LiveAlert = {
  id: string; title: string; message: string; severity: LiveAlertSeverity;
  kind: "incident" | "watch_zone" | "geofence" | "route_ahead" | "feed";
  createdAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

// Average speeds by mode (km/h)
const AVG_SPEED: Record<TravelMode, number> = {
  drive: 65,
  walk: 5,
  transit: 35,
};

// Urban speed factor (slower in cities)
const URBAN_FACTOR = 0.72;

const ROUTE_HUBS: RouteHub[] = [
  { id: "lagos", label: "Lagos", state: "Lagos", latitude: 6.5244, longitude: 3.3792 },
  { id: "abeokuta", label: "Abeokuta", state: "Ogun", latitude: 7.1569, longitude: 3.3451 },
  { id: "ibadan", label: "Ibadan", state: "Oyo", latitude: 7.3775, longitude: 3.947 },
  { id: "osogbo", label: "Osogbo", state: "Osun", latitude: 7.7718, longitude: 4.5561 },
  { id: "akure", label: "Akure", state: "Ondo", latitude: 7.2526, longitude: 5.1931 },
  { id: "ado-ekiti", label: "Ado-Ekiti", state: "Ekiti", latitude: 7.6231, longitude: 5.2209 },
  { id: "benin", label: "Benin City", state: "Edo", latitude: 6.335, longitude: 5.6037 },
  { id: "auchi", label: "Auchi", state: "Edo", latitude: 7.0628, longitude: 6.2655 },
  { id: "asaba", label: "Asaba", state: "Delta", latitude: 6.2, longitude: 6.7333 },
  { id: "warri", label: "Warri", state: "Delta", latitude: 5.554, longitude: 5.7932 },
  { id: "calabar", label: "Calabar", state: "Cross River", latitude: 4.9757, longitude: 8.3417 },
  { id: "uyo", label: "Uyo", state: "Akwa Ibom", latitude: 5.0302, longitude: 7.911 },
  { id: "owerri", label: "Owerri", state: "Imo", latitude: 5.485, longitude: 7.035 },
  { id: "umuahia", label: "Umuahia", state: "Abia", latitude: 5.532, longitude: 7.486 },
  { id: "ilorin", label: "Ilorin", state: "Kwara", latitude: 8.4966, longitude: 4.5421 },
  { id: "minna", label: "Minna", state: "Niger", latitude: 9.6139, longitude: 6.5569 },
  { id: "okene", label: "Okene", state: "Kogi", latitude: 7.5512, longitude: 6.2359 },
  { id: "lokoja", label: "Lokoja", state: "Kogi", latitude: 7.8023, longitude: 6.7333 },
  { id: "abuja", label: "Abuja", state: "FCT Abuja", latitude: 9.0579, longitude: 7.4951 },
  { id: "lafia", label: "Lafia", state: "Nasarawa", latitude: 8.4929, longitude: 8.5153 },
  { id: "makurdi", label: "Makurdi", state: "Benue", latitude: 7.7337, longitude: 8.536 },
  { id: "jos", label: "Jos", state: "Plateau", latitude: 9.8965, longitude: 8.8583 },
  { id: "kaduna", label: "Kaduna", state: "Kaduna", latitude: 10.5222, longitude: 7.4384 },
  { id: "kano", label: "Kano", state: "Kano", latitude: 12.0022, longitude: 8.592 },
  { id: "bauchi", label: "Bauchi", state: "Bauchi", latitude: 10.3142, longitude: 9.8469 },
  { id: "gombe", label: "Gombe", state: "Gombe", latitude: 10.2897, longitude: 11.1673 },
  { id: "maiduguri", label: "Maiduguri", state: "Borno", latitude: 11.8311, longitude: 13.1509 },
  { id: "damaturu", label: "Damaturu", state: "Yobe", latitude: 11.7462, longitude: 11.963 },
  { id: "yola", label: "Yola", state: "Adamawa", latitude: 9.2096, longitude: 12.4815 },
  { id: "gusau", label: "Gusau", state: "Zamfara", latitude: 12.1705, longitude: 6.6641 },
  { id: "sokoto", label: "Sokoto", state: "Sokoto", latitude: 13.0059, longitude: 5.2474 },
  { id: "birnin-kebbi", label: "Birnin Kebbi", state: "Kebbi", latitude: 12.4539, longitude: 4.1975 },
  { id: "dutse", label: "Dutse", state: "Jigawa", latitude: 11.7589, longitude: 9.3385 },
  { id: "onitsha", label: "Onitsha", state: "Anambra", latitude: 6.1454, longitude: 6.7885 },
  { id: "awka", label: "Awka", state: "Anambra", latitude: 6.2104, longitude: 7.0699 },
  { id: "enugu", label: "Enugu", state: "Enugu", latitude: 6.4584, longitude: 7.5464 },
  { id: "abakaliki", label: "Abakaliki", state: "Ebonyi", latitude: 6.3249, longitude: 8.1137 },
  { id: "port-harcourt", label: "Port Harcourt", state: "Rivers", latitude: 4.8156, longitude: 7.0498 },
];

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; dot: string; label: string }> = {
  critical: { color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-400", label: "Critical" },
  high:     { color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400", label: "High" },
  elevated: { color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400", label: "Elevated" },
  guarded:  { color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", dot: "bg-cyan-400", label: "Guarded" },
  low:      { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400", label: "Low" },
};

const MODE_CONFIG: Record<TravelMode, { icon: string; label: string }> = {
  drive:   { icon: "🚗", label: "Drive" },
  walk:    { icon: "🚶", label: "Walk" },
  transit: { icon: "🚌", label: "Transit" },
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getList<T>(payload: T[] | ApiListResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function relativeTime(value?: string | null): string {
  if (!value) return "Now";
  const mins = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(km < 10 ? 1 : 0)}km`;
}

function formatType(value: string): string {
  return formatReportType(value);
}

function haversine(latA: number, lngA: number, latB: number, lngB: number): number {
  const R = 6371;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((latA * Math.PI) / 180) * Math.cos((latB * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDuration(distanceKm: number, mode: TravelMode, hour: number): number {
  const base = AVG_SPEED[mode];
  const isUrban = distanceKm < 20;
  const isNight = hour >= 22 || hour < 5;
  const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19);
  let effectiveSpeed = base;
  if (isUrban) effectiveSpeed *= URBAN_FACTOR;
  if (isRushHour && mode === "drive") effectiveSpeed *= 0.65;
  if (isNight && mode === "drive") effectiveSpeed *= 1.15; // faster at night, less traffic
  if (mode === "transit") {
    const stops = Math.ceil(distanceKm / 8); // approx stop every 8km
    return (distanceKm / effectiveSpeed) * 60 + stops * 2; // 2min per stop
  }
  return (distanceKm / effectiveSpeed) * 60;
}

function ptToSegKm(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const mLat = (((pLat + aLat + bLat) / 3) * Math.PI) / 180;
  const kLat = 111.32;
  const kLng = 111.32 * Math.cos(mLat);
  const px = pLng * kLng, py = pLat * kLat;
  const ax = aLng * kLng, ay = aLat * kLat;
  const bx = bLng * kLng, by = bLat * kLat;
  const abx = bx - ax, aby = by - ay;
  const ls = abx ** 2 + aby ** 2;
  const t = ls === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / ls));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function ptToPathKm(lat: number, lng: number, path: Array<[number, number]>): number {
  if (path.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [aLng, aLat] = path[i];
    const [bLng, bLat] = path[i + 1];
    min = Math.min(min, ptToSegKm(lat, lng, aLat, aLng, bLat, bLng));
  }
  return min;
}

function projectToPathKm(lat: number, lng: number, path: Array<[number, number]>) {
  if (path.length < 2) return { offsetKm: Infinity, alongKm: 0, totalKm: 0 };
  let minOffsetKm = Infinity, closestAlongKm = 0, traversedKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [aLng, aLat] = path[i];
    const [bLng, bLat] = path[i + 1];
    const mLat = (((lat + aLat + bLat) / 3) * Math.PI) / 180;
    const kLat = 111.32, kLng = 111.32 * Math.cos(mLat);
    const px = lng * kLng, py = lat * kLat;
    const ax = aLng * kLng, ay = aLat * kLat;
    const bx = bLng * kLng, by = bLat * kLat;
    const abx = bx - ax, aby = by - ay;
    const segmentLengthKm = Math.hypot(abx, aby);
    const ls = abx ** 2 + aby ** 2;
    const t = ls === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / ls));
    const projX = ax + abx * t, projY = ay + aby * t;
    const offsetKm = Math.hypot(px - projX, py - projY);
    if (offsetKm < minOffsetKm) { minOffsetKm = offsetKm; closestAlongKm = traversedKm + segmentLengthKm * t; }
    traversedKm += segmentLengthKm;
  }
  return { offsetKm: minOffsetKm, alongKm: closestAlongKm, totalKm: traversedKm };
}

function pathLengthKm(path: Array<[number, number]>): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [aLng, aLat] = path[i];
    const [bLng, bLat] = path[i + 1];
    total += haversine(aLat, aLng, bLat, bLng);
  }
  return total;
}

function severityWeight(s: string): number {
  return s === "critical" ? 5 : s === "high" ? 3.5 : s === "medium" ? 2 : 1;
}

function zoneWeight(level: string, score: number): number {
  const lf = level.includes("critical") ? 1.4 : level.includes("high") ? 1.1 : level.includes("medium") ? 0.85 : 0.55;
  return (score / 100) * 8 * lf;
}

function freshnessWeight(value: string): number {
  const h = Math.max(0, (Date.now() - new Date(value).getTime()) / 36e5);
  return h <= 6 ? 1.5 : h <= 24 ? 1.25 : h <= 72 ? 1 : h <= 168 ? 0.75 : 0.45;
}

function scoreToLevel(s: number): RiskLevel {
  return s >= 85 ? "critical" : s >= 65 ? "high" : s >= 40 ? "elevated" : s >= 20 ? "guarded" : "low";
}

function isOngoingIncident(status: string) {
  const n = status.trim().toLowerCase();
  return n !== "resolved" && n !== "closed" && n !== "dismissed";
}

function isRecentTimestamp(value?: string | null, windowHours = 6) {
  if (!value) return false;
  const ageHours = (Date.now() - new Date(value).getTime()) / 36e5;
  return ageHours >= 0 && ageHours <= windowHours;
}

function alertSeverityFromIncident(severity: string): LiveAlertSeverity {
  if (severity === "critical" || severity === "high") return "critical";
  if (severity === "medium") return "warning";
  return "info";
}

function alertTone(severity: LiveAlertSeverity) {
  if (severity === "critical") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (severity === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
}

function deriveHubState(latitude: number, longitude: number): string {
  let closest = ROUTE_HUBS[0], minDist = Infinity;
  for (const hub of ROUTE_HUBS) {
    const d = haversine(latitude, longitude, hub.latitude, hub.longitude);
    if (d < minDist) { minDist = d; closest = hub; }
  }
  return closest.state;
}

function buildRouteHubs(watchZoneRecords: WatchZoneRecord[], geofenceRecords: GeofenceRecord[]): RouteHub[] {
  const dynamic: RouteHub[] = [];
  watchZoneRecords.forEach((z) => {
    if (z.zone_type !== "route_hub") return;
    const lat = toNumber(z.centroid_latitude), lng = toNumber(z.centroid_longitude);
    if (lat === null || lng === null) return;
    dynamic.push({ id: `watch-zone-${z.id}`, label: z.name, state: deriveHubState(lat, lng), latitude: lat, longitude: lng });
  });
  geofenceRecords.forEach((g) => {
    if (g.geofence_type !== "village") return;
    const lat = toNumber(g.centroid_latitude), lng = toNumber(g.centroid_longitude);
    if (lat === null || lng === null) return;
    dynamic.push({ id: `geofence-${g.id}`, label: g.name, state: deriveHubState(lat, lng), latitude: lat, longitude: lng });
  });
  const merged = [...ROUTE_HUBS, ...dynamic];
  const seen = new Set<string>();
  return merged.filter((h) => {
    const key = `${h.label.trim().toLowerCase()}|${h.state.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const CURRENT_LOCATION_HUB_ID = "__current_location__";
function makeCurrentLocationHub(pos: LivePosition): RouteHub {
  return { id: CURRENT_LOCATION_HUB_ID, label: "My location", state: deriveHubState(pos.latitude, pos.longitude), latitude: pos.latitude, longitude: pos.longitude };
}

function makeRouteHubFromSuggestion(s: RouteHubSuggestion, kind: "origin" | "destination"): RouteHub {
  return { id: `custom-${kind}-${s.id}`, label: s.label, state: s.state, latitude: s.latitude, longitude: s.longitude };
}

// ─── Route Logic ──────────────────────────────────────────────────────────────

function buildRouteOption(
  id: string,
  origin: RouteHub,
  destination: RouteHub,
  hour: number,
  mode: TravelMode,
  incidents: MapIncidentPoint[],
  zones: WatchZonePoint[],
  via?: RouteHub | null,
): Omit<RouteOption, "isBest" | "isFastest" | "isSafest"> {
  const stops = [origin, ...(via ? [via] : []), destination];
  const path = stops.map((s) => [s.longitude, s.latitude] as [number, number]);
  const corridorKm = pathLengthKm(path);
  const threshold = corridorKm >= 350 ? 42 : corridorKm >= 180 ? 34 : 26;

  const routeIncidents = incidents
    .flatMap((inc) => {
      const d = ptToPathKm(inc.latitude, inc.longitude, path);
      if (d > threshold) return [];
      const prox = 1.35 - Math.min(d / threshold, 1) * 0.8;
      const w = severityWeight(inc.severity) * freshnessWeight(inc.detectedAt) * prox;
      return [{ ...inc, distanceKm: d, weight: w }];
    })
    .sort((a, b) => b.weight - a.weight);

  const routeZones = zones
    .flatMap((z) => {
      const d = ptToPathKm(z.latitude, z.longitude, path);
      if (d > threshold + 10) return [];
      const prox = 1.25 - Math.min(d / (threshold + 10), 1) * 0.7;
      const w = zoneWeight(z.riskLevel, z.riskScore) * prox;
      return [{ ...z, distanceKm: d, weight: w }];
    })
    .sort((a, b) => b.weight - a.weight);

  const night = hour >= 20 || hour < 6;
  const highCount = routeIncidents.filter((i) => i.severity === "high" || i.severity === "critical").length;
  const highZones = routeZones.filter((z) => z.riskLevel.includes("high") || z.riskLevel.includes("critical")).length;
  const timePenalty = night ? highCount * 1.5 + highZones * 1.2 : 0;
  const iScore = routeIncidents.reduce((s, i) => s + i.weight, 0);
  const zScore = routeZones.reduce((s, z) => s + z.weight, 0);
  const score = Math.min(100, Math.round(iScore * 4.4 + zScore * 1.65 + timePenalty));
  const level = scoreToLevel(score);
  const distanceKm = Math.round(corridorKm * 10) / 10;
  const durationMin = Math.round(estimateDuration(corridorKm, mode, hour));
  const focal = routeIncidents[0]?.locationName || routeZones[0]?.name || `${origin.label}–${destination.label}`;
  const viaLabel = via ? `Via ${via.label}` : "Direct route";

  const summaries: Record<RiskLevel, string> = {
    critical: `Critical exposure near ${focal}. Immediate reroute or delay strongly advised.`,
    high: `High pressure building near ${focal}. A safer alternative is recommended.`,
    elevated: `Elevated risk near ${focal}. Proceed with caution and tight timing.`,
    guarded: `Guarded monitoring advised around ${focal}.`,
    low: `No significant threat concentration on this corridor.`,
  };

  return {
    id,
    label: viaLabel,
    score, level, distanceKm, durationMin, corridorKm: threshold,
    routePath: path,
    routeStops: stops.map((s, i) => ({
      label: s.label, latitude: s.latitude, longitude: s.longitude,
      kind: i === 0 ? "origin" : i === stops.length - 1 ? "destination" : "waypoint",
    })),
    incidents: routeIncidents,
    watchZones: routeZones,
    summary: summaries[level],
    advisories: [
      highCount > 0
        ? `${highCount} high-severity incident${highCount > 1 ? "s" : ""} inside corridor.`
        : "No high-severity incidents in corridor.",
      highZones > 0
        ? `${highZones} elevated risk zone${highZones > 1 ? "s" : ""} intersecting route.`
        : "No elevated watch zones on route.",
      night
        ? `Night departure increases exposure. Consider leaving before 18:00.`
        : `Daytime window (${hour}:00) is a lower-risk window.`,
    ],
    timingNote: night
      ? `Night travel after ${hour}:00 — elevated exposure on active corridors.`
      : `Departure at ${hour}:00 is within a lower-risk window.`,
  };
}

function buildAllRouteOptions(
  origin: RouteHub,
  destination: RouteHub,
  hour: number,
  mode: TravelMode,
  incidents: MapIncidentPoint[],
  zones: WatchZonePoint[],
  hubs: RouteHub[],
): RouteOption[] {
  const direct = buildRouteOption("direct", origin, destination, hour, mode, incidents, zones);
  const directDist = haversine(origin.latitude, origin.longitude, destination.latitude, destination.longitude);

  const alternates = hubs
    .filter((h) => h.id !== origin.id && h.id !== destination.id)
    .map((hub) => ({
      hub,
      detour:
        haversine(origin.latitude, origin.longitude, hub.latitude, hub.longitude) +
        haversine(hub.latitude, hub.longitude, destination.latitude, destination.longitude),
    }))
    .filter((c) => c.detour <= directDist * 1.65 && c.detour >= directDist * 0.85)
    .sort((a, b) => a.detour - b.detour)
    .slice(0, 3)
    .map((c, i) =>
      buildRouteOption(`alt-${i}`, origin, destination, hour, mode, incidents, zones, c.hub)
    );

  const all = [direct, ...alternates];
  const minScore = Math.min(...all.map((r) => r.score));
  const minDuration = Math.min(...all.map((r) => r.durationMin));

  return all.map((r) => ({
    ...r,
    isBest: r.score === minScore,
    isFastest: r.durationMin === minDuration && r.score <= minScore + 15,
    isSafest: r.score === minScore,
  }));
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/>
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

function IconSwap() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function IconLocation() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 14-8 14S4 15.25 4 10a8 8 0 0 1 8-8z"/>
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function IconRoute() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
      <circle cx="18" cy="5" r="3"/>
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskPill({ level, score, compact }: { level: RiskLevel; score: number; compact?: boolean }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold uppercase tracking-widest ${compact ? "text-[9px]" : "text-[10px]"} ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
      {!compact && <span className="ml-0.5 opacity-60">{score}</span>}
    </span>
  );
}

function RouteCard({
  route,
  selected,
  onSelect,
}: {
  route: RouteOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const cfg = RISK_CONFIG[route.level];
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? `${cfg.border} ${cfg.bg} ring-1 ring-inset ring-white/10`
          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-white">{route.label}</span>
            {route.isBest && (
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-300">
                Recommended
              </span>
            )}
            {route.isFastest && !route.isBest && (
              <span className="rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-blue-300">
                Fastest
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/50">
            <span className={`flex items-center gap-1.5 font-semibold ${selected ? "text-white/80" : ""}`}>
              <IconClock />
              {formatDuration(route.durationMin)}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-px w-3 bg-white/20" />
              {formatDistance(route.distanceKm)}
            </span>
            <span className="flex items-center gap-1 text-white/35">
              <IconWarning />
              {route.incidents.length} incident{route.incidents.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <RiskPill level={route.level} score={route.score} compact />
      </div>

      {/* Route mini-map progress bar */}
      <div className="mt-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${cfg.dot}`}
            style={{ width: `${Math.max(5, 100 - route.score)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-white/40">{route.summary}</p>
      </div>
    </button>
  );
}

function SearchInput({
  label,
  value,
  suggestions,
  isSearching,
  onChange,
  onSelect,
  onClear,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  suggestions: RouteHubSuggestion[];
  isSearching: boolean;
  onChange: (v: string) => void;
  onSelect: (s: RouteHubSuggestion) => void;
  onClear: () => void;
  placeholder: string;
  icon: React.ReactNode;
}) {
  const iconBadge: Record<string, string> = {
    state: "ST",
    city: "🏙",
    town: "🏘",
    place: "📍",
    street: "🛣",
  };

  return (
    <div className={suggestions.length > 0 ? "relative z-50" : "relative z-10"}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/30">
        {icon}
        {label}
      </p>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/[0.08] bg-[#06090f] px-3 py-2.5 pr-8 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/10"
        />
        {value && (
          <button
            onClick={onClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-white/30 hover:text-white/60"
          >
            <IconX />
          </button>
        )}
      </div>

      {value.trim().length >= 2 && isSearching && (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-500/8 px-3 py-2 text-[11px] text-cyan-200/80">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
          Searching locations…
        </div>
      )}

      {value.trim().length >= 2 && !isSearching && suggestions.length === 0 && (
        <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-white/35">
          No matches found. Try a town, street, or full address.
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="relative z-[120] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#07101e] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className="flex w-full items-center gap-3 border-b border-white/[0.05] px-3.5 py-3 text-left transition last:border-b-0 hover:bg-white/[0.04] active:bg-white/[0.07]"
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.04] text-xs">
                {iconBadge[s.kind] ?? "📍"}
              </span>
              <div className="min-w-0">
                <p className="whitespace-normal break-words text-sm font-medium leading-5 text-white">{s.label}</p>
                <p className="whitespace-normal break-words text-[11px] leading-4 text-white/35">{s.description || s.state}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveAlertBanner({ alerts, onDismiss }: { alerts: LiveAlert[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null;
  return (
    <div className="fixed right-3 top-16 z-50 flex w-[min(380px,calc(100vw-1.5rem))] flex-col gap-2">
      {alerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className={`rounded-2xl border px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.3)] backdrop-blur-2xl ${alertTone(alert.severity)}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-[9px] uppercase tracking-[0.18em] opacity-60">
                {alert.kind.replace(/_/g, " ")} warning
              </p>
              <p className="mt-0.5 text-xs font-semibold leading-5">{alert.title}</p>
              <p className="mt-0.5 text-[11px] leading-5 opacity-75">{alert.message}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] opacity-50">{relativeTime(alert.createdAt)}</span>
              <button onClick={() => onDismiss(alert.id)} className="rounded-full p-0.5 opacity-40 hover:opacity-70">
                <IconX />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TravelModePicker({ mode, onChange }: { mode: TravelMode; onChange: (m: TravelMode) => void }) {
  return (
    <div className="flex gap-1.5">
      {(["drive", "walk", "transit"] as TravelMode[]).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold uppercase tracking-widest transition ${
            mode === m
              ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-300"
              : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/60"
          }`}
        >
          <span>{MODE_CONFIG[m].icon}</span>
          <span className="hidden sm:inline">{MODE_CONFIG[m].label}</span>
        </button>
      ))}
    </div>
  );
}

function ScoreMeter({ score, level }: { score: number; level: RiskLevel }) {
  const cfg = RISK_CONFIG[level];
  const segments: RiskLevel[] = ["low", "guarded", "elevated", "high", "critical"];
  return (
    <div className="flex gap-1">
      {segments.map((seg) => {
        const thresholds: Record<RiskLevel, [number, number]> = {
          low: [0, 20], guarded: [20, 40], elevated: [40, 65], high: [65, 85], critical: [85, 101],
        };
        const [lo, hi] = thresholds[seg];
        const active = score >= lo && score < hi;
        const passed = score >= hi;
        return (
          <div
            key={seg}
            className={`h-1 flex-1 rounded-full transition-all ${
              active ? cfg.dot : passed ? `${cfg.dot} opacity-30` : "bg-white/10"
            }`}
          />
        );
      })}
    </div>
  );
}

function pushLiveAlert(setAlerts: Dispatch<SetStateAction<LiveAlert[]>>, next: LiveAlert) {
  setAlerts((cur) => [next, ...cur.filter((a) => a.id !== next.id)].slice(0, 6));
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type PanelTab = "routes" | "threats" | "live";

function MainPanel({
  routes,
  selectedRouteId,
  onSelectRoute,
  activeTab,
  onTabChange,
  // planner inputs
  originInput,
  destinationInput,
  originSuggestions,
  destinationSuggestions,
  originSearching,
  destinationSearching,
  departureHour,
  travelMode,
  onOriginChange,
  onDestinationChange,
  onSelectOriginSugg,
  onSelectDestinationSugg,
  onClearOrigin,
  onClearDestination,
  onHourChange,
  onSwap,
  onTravelModeChange,
  // live tracking
  trackingEnabled,
  livePosition,
  useCurrentLocation,
  onUseCurrentLocation,
  currentLocationStatus,
  trackingError,
  liveAlerts,
  onToggleTracking,
  loading,
}: {
  routes: RouteOption[];
  selectedRouteId: string;
  onSelectRoute: (id: string) => void;
  activeTab: PanelTab;
  onTabChange: (t: PanelTab) => void;
  originInput: string;
  destinationInput: string;
  originSuggestions: RouteHubSuggestion[];
  destinationSuggestions: RouteHubSuggestion[];
  originSearching: boolean;
  destinationSearching: boolean;
  departureHour: number;
  travelMode: TravelMode;
  onOriginChange: (v: string) => void;
  onDestinationChange: (v: string) => void;
  onSelectOriginSugg: (s: RouteHubSuggestion) => void;
  onSelectDestinationSugg: (s: RouteHubSuggestion) => void;
  onClearOrigin: () => void;
  onClearDestination: () => void;
  onHourChange: (v: number) => void;
  onSwap: () => void;
  onTravelModeChange: (m: TravelMode) => void;
  trackingEnabled: boolean;
  livePosition: LivePosition | null;
  useCurrentLocation: boolean;
  onUseCurrentLocation: () => void;
  currentLocationStatus: string;
  trackingError: string;
  liveAlerts: LiveAlert[];
  onToggleTracking: () => void;
  loading: boolean;
}) {
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? routes[0];
  const totalIncidents = selectedRoute?.incidents.length ?? 0;
  const tabs: { id: PanelTab; label: string }[] = [
    { id: "routes", label: "Routes" },
    { id: "threats", label: `Threats${totalIncidents > 0 ? ` (${totalIncidents})` : ""}` },
    { id: "live", label: "Live" },
  ];

  return (
    <div className="flex h-full flex-col overflow-visible">
      {/* ── Search bar (always visible) ── */}
      <div className="shrink-0 space-y-3 border-b border-white/[0.06] p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-3">
            <SearchInput
              label="From"
              value={originInput}
              suggestions={originSuggestions}
              isSearching={originSearching}
              onChange={onOriginChange}
              onSelect={onSelectOriginSugg}
              onClear={onClearOrigin}
              placeholder="Street, city or place…"
              icon={<span className="h-2 w-2 rounded-full bg-emerald-400" />}
            />
            <SearchInput
              label="To"
              value={destinationInput}
              suggestions={destinationSuggestions}
              isSearching={destinationSearching}
              onChange={onDestinationChange}
              onSelect={onSelectDestinationSugg}
              onClear={onClearDestination}
              placeholder="Street, city or place…"
              icon={<span className="h-2 w-2 rounded-full bg-red-400" />}
            />
          </div>
          <button
            onClick={onSwap}
            className="mb-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/40 transition hover:border-cyan-400/30 hover:text-cyan-300"
            aria-label="Swap"
          >
            <IconSwap />
          </button>
        </div>

        {/* Use current location */}
        <button
          onClick={onUseCurrentLocation}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-widest transition ${
            useCurrentLocation
              ? "border-cyan-400/30 bg-cyan-500/8 text-cyan-300"
              : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60"
          }`}
        >
          <IconLocation />
          {useCurrentLocation ? "Using my location" : "Use my location as origin"}
        </button>
        {currentLocationStatus && (
          <p className="text-[11px] text-white/35">{currentLocationStatus}</p>
        )}

        <TravelModePicker mode={travelMode} onChange={onTravelModeChange} />
      </div>

      {/* ── Tabs ── */}
      <div className="flex shrink-0 border-b border-white/[0.06]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition ${
              activeTab === t.id
                ? "border-b-2 border-cyan-400 text-cyan-300"
                : "text-white/30 hover:text-white/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Scrollable content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ROUTES TAB */}
        {activeTab === "routes" && (
          <div className="space-y-3 p-4">
            {/* Departure time */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/30">
                  <IconClock /> Departure
                </p>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                  (departureHour >= 20 || departureHour < 6) ? "border-amber-500/20 bg-amber-500/8 text-amber-300" : "border-emerald-500/20 bg-emerald-500/8 text-emerald-300"
                }`}>
                  {departureHour.toString().padStart(2, "0")}:00 {departureHour >= 20 || departureHour < 6 ? "🌙 Night" : "☀️ Day"}
                </span>
              </div>
              <input
                type="range" min={0} max={23} value={departureHour}
                onChange={(e) => onHourChange(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <div className="mt-1 flex justify-between text-[9px] text-white/20">
                <span>Midnight</span><span>6am</span><span>Noon</span><span>6pm</span><span>11pm</span>
              </div>
            </div>

            {/* Route options — Google Maps style */}
            <div>
              <p className="mb-2 text-[10px] uppercase tracking-widest text-white/30">
                {routes.length} route{routes.length !== 1 ? "s" : ""} found
              </p>
              <div className="space-y-2">
                {routes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    selected={route.id === selectedRouteId}
                    onSelect={() => onSelectRoute(route.id)}
                  />
                ))}
              </div>
            </div>

            {/* Selected route detail */}
            {selectedRoute && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 text-[10px] uppercase tracking-widest text-white/30">Route details</p>
                <ScoreMeter score={selectedRoute.score} level={selectedRoute.level} />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: "ETA", value: formatDuration(selectedRoute.durationMin) },
                    { label: "Distance", value: formatDistance(selectedRoute.distanceKm) },
                    { label: "Risk score", value: selectedRoute.score },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5 text-center">
                      <p className="text-[9px] uppercase tracking-widest text-white/25">{stat.label}</p>
                      <p className="mt-1 text-sm font-bold text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  {selectedRoute.advisories.map((a, i) => (
                    <div key={i} className="flex gap-2 text-[11px] leading-5 text-white/40">
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-white/20" />
                      {a}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* THREATS TAB */}
        {activeTab === "threats" && selectedRoute && (
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-2.5 text-[10px] uppercase tracking-widest text-white/30">
                Incidents on corridor ({selectedRoute.incidents.length})
              </p>
              {selectedRoute.incidents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.07] p-5 text-center text-xs text-white/25">
                  No active incidents on this corridor
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedRoute.incidents.slice(0, 6).map((inc) => {
                    const sev = RISK_CONFIG[inc.severity as RiskLevel] ?? RISK_CONFIG.low;
                    return (
                      <div key={inc.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{inc.title}</p>
                            <p className="mt-0.5 truncate text-[11px] text-white/35">{inc.locationName}</p>
                          </div>
                          <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest ${sev.bg} ${sev.border} ${sev.color}`}>
                            {inc.severity}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-white/30">
                          <span>{formatType(inc.incidentType)}</span>
                          <span className="flex items-center gap-1">
                            <span>{inc.distanceKm.toFixed(1)}km off route</span>
                            <span>·</span>
                            <span>{relativeTime(inc.detectedAt)}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {selectedRoute.incidents.length > 6 && (
                    <p className="text-center text-[11px] text-white/25">+{selectedRoute.incidents.length - 6} more</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2.5 text-[10px] uppercase tracking-widest text-white/30">
                Risk zones ({selectedRoute.watchZones.length})
              </p>
              {selectedRoute.watchZones.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.07] p-5 text-center text-xs text-white/25">
                  No elevated zones on this route
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedRoute.watchZones.slice(0, 4).map((z) => (
                    <div key={z.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{z.name}</p>
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-amber-300">
                          {z.riskLevel.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-white/30">
                        <span>Score {z.riskScore.toFixed(0)}</span>
                        <span>{z.distanceKm.toFixed(1)}km from route</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {loading && <p className="text-center text-[11px] text-white/25">Refreshing intelligence…</p>}
          </div>
        )}

        {/* LIVE TAB */}
        {activeTab === "live" && (
          <div className="space-y-3 p-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-white/30">Live tracking</p>
                <button
                  onClick={onToggleTracking}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${
                    trackingEnabled
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-white/[0.07] text-white/40 hover:text-white/70"
                  }`}
                >
                  {trackingEnabled ? "● Stop" : "Start tracking"}
                </button>
              </div>

              {trackingEnabled && livePosition ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5">
                      <p className="text-[9px] text-white/25">Latitude</p>
                      <p className="text-sm font-bold text-white">{livePosition.latitude.toFixed(5)}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5">
                      <p className="text-[9px] text-white/25">Longitude</p>
                      <p className="text-sm font-bold text-white">{livePosition.longitude.toFixed(5)}</p>
                    </div>
                    {livePosition.speedKph !== null && (
                      <div className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5">
                        <p className="text-[9px] text-white/25">Speed</p>
                        <p className="text-sm font-bold text-white">{livePosition.speedKph.toFixed(0)} km/h</p>
                      </div>
                    )}
                    {livePosition.accuracy !== null && (
                      <div className="rounded-xl border border-white/[0.06] bg-black/30 p-2.5">
                        <p className="text-[9px] text-white/25">Accuracy</p>
                        <p className="text-sm font-bold text-white">±{Math.round(livePosition.accuracy)}m</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-white/30">Updated {relativeTime(livePosition.updatedAt)}</p>
                </div>
              ) : trackingError ? (
                <p className="mt-3 text-xs text-amber-300">{trackingError}</p>
              ) : (
                <p className="mt-3 text-xs text-white/35">
                  Start tracking to follow your live {travelMode} position on the map and receive proximity alerts.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-widest text-white/30">Active warnings</p>
                <span className={`text-[10px] font-bold ${liveAlerts.length > 0 ? "text-amber-300" : "text-white/25"}`}>
                  {liveAlerts.length}
                </span>
              </div>
              {liveAlerts.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {liveAlerts.slice(0, 4).map((alert) => (
                    <div key={alert.id} className={`rounded-xl border px-3 py-2.5 ${alertTone(alert.severity)}`}>
                      <p className="text-xs font-semibold">{alert.title}</p>
                      <p className="mt-0.5 text-[11px] leading-5 opacity-80">{alert.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-white/30">No proximity warnings at your current position.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RouteIntelligencePage() {
  const role = getCurrentRole();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = useMemo<NavItem[]>(() => getPublicNavItems(role), [role]);
  const [activeTab, setActiveTab] = useState<PanelTab>("routes");
  const [sheetExpanded, setSheetExpanded] = useState(false);

  // Route state
  const [originId, setOriginId] = useState("benin");
  const [destinationId, setDestinationId] = useState("abuja");
  const [customOrigin, setCustomOrigin] = useState<RouteHub | null>(null);
  const [customDestination, setCustomDestination] = useState<RouteHub | null>(null);
  const [originInput, setOriginInput] = useState("Benin City");
  const [destinationInput, setDestinationInput] = useState("Abuja");
  const [originSuggestions, setOriginSuggestions] = useState<RouteHubSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<RouteHubSuggestion[]>([]);
  const [originSearching, setOriginSearching] = useState(false);
  const [destinationSearching, setDestinationSearching] = useState(false);
  const [originSearchTick, setOriginSearchTick] = useState(0);
  const [destinationSearchTick, setDestinationSearchTick] = useState(0);
  const [departureHour, setDepartureHour] = useState(new Date().getHours());
  const [selectedRouteId, setSelectedRouteId] = useState("direct");
  const [travelMode, setTravelMode] = useState<TravelMode>("drive");

  // Live tracking
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [livePosition, setLivePosition] = useState<LivePosition | null>(null);
  const [originLocation, setOriginLocation] = useState<LivePosition | null>(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [currentLocationStatus, setCurrentLocationStatus] = useState("");
  const [trackingError, setTrackingError] = useState("");
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const activeZoneKeysRef = useRef<Set<string>>(new Set());
  const activeGeofenceKeysRef = useRef<Set<string>>(new Set());
  const recentIncidentAlertRef = useRef<Record<number, number>>({});
  const recentRouteAlertRef = useRef<Record<string, number>>({});
  const incidentSnapshotRef = useRef<Record<number, string>>({});
  const incidentFeedPrimedRef = useRef(false);
  const liveContextRef = useRef({ corridorKm: 0, routePath: [] as Array<[number, number]>, travelMode: "drive" as TravelMode, livePosition: null as LivePosition | null });

  // Data
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("geopulse.token"),
  );
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [watchZones, setWatchZones] = useState<WatchZoneRecord[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(Boolean(authToken));
  const geolocationSupported = typeof window !== "undefined" && Boolean(navigator?.geolocation);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    const headers = { Authorization: `Token ${authToken}` };

    async function load() {
      setLoading(true);
      try {
        const [iRes, wRes, gRes, aRes] = await Promise.all([
          fetch(`${API_BASE_URL}/incidents/`, { headers }),
          fetch(`${API_BASE_URL}/watch-zones/`, { headers }),
          fetch(`${API_BASE_URL}/geofences/?status=active`, { headers }),
          fetch(`${API_BASE_URL}/alerts/`, { headers }),
        ]);
        if (!active) return;
        const [iData, wData, gData, aData] = await Promise.all([
          iRes.json(), wRes.json(), gRes.json(), aRes.json(),
        ]);
        if (iRes.ok) {
          const nextIncidents = getList(iData) as IncidentRecord[];
          const nextSnapshot = Object.fromEntries(
            nextIncidents.map((inc) => [inc.id, inc.detected_at || inc.created_at || ""]),
          );
          if (incidentFeedPrimedRef.current) {
            const ctx = liveContextRef.current;
            nextIncidents
              .filter((inc) => incidentSnapshotRef.current[inc.id] !== (inc.detected_at || inc.created_at || ""))
              .filter((inc) => {
                const lat = toNumber(inc.latitude), lng = toNumber(inc.longitude);
                if (lat === null || lng === null) return false;
                return ptToPathKm(lat, lng, ctx.routePath) <= ctx.corridorKm + 5;
              })
              .filter((inc) => isOngoingIncident(inc.status) || isRecentTimestamp(inc.detected_at, 2))
              .slice(0, 2)
              .forEach((inc) => {
                const lat = toNumber(inc.latitude)!;
                const lng = toNumber(inc.longitude)!;
                const routeOffset = ptToPathKm(lat, lng, ctx.routePath);
                pushLiveAlert(setLiveAlerts, {
                  id: `feed-${inc.id}`,
                  title: `${formatType(inc.incident_type)} update`,
                  message: `${inc.title} reported near ${inc.location_name}, ${routeOffset.toFixed(1)}km off your route.`,
                  severity: alertSeverityFromIncident(inc.severity),
                  kind: "feed",
                  createdAt: inc.detected_at || inc.created_at || new Date().toISOString(),
                });
              });
          }
          incidentSnapshotRef.current = nextSnapshot;
          incidentFeedPrimedRef.current = true;
          setIncidents(nextIncidents);
        }
        if (wRes.ok) setWatchZones(getList(wData));
        if (gRes.ok) setGeofences(getList(gData));
        if (aRes.ok) {
          setAlerts(
            getList(aData as ApiListResponse<Record<string, unknown>>).map((a, i) => {
              const sev = String(a.severity ?? "info").toLowerCase();
              return {
                id: Number(a.id ?? i + 1), level: sev === "critical" ? "Critical" : sev === "high" ? "Warning" : "Info",
                triggeredAt: String(a.triggered_at ?? ""), title: String(a.title ?? "Alert"),
                body: String(a.message ?? ""), meta: String(a.status ?? "ACTIVE").toUpperCase(),
              };
            }),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const tid = window.setInterval(() => void load(), 45000);
    return () => { active = false; window.clearInterval(tid); };
  }, [authToken]);

  const incidentPoints = useMemo(
    () => incidents.flatMap((inc) => {
      const lat = toNumber(inc.latitude), lng = toNumber(inc.longitude);
      if (lat === null || lng === null) return [];
      return [{ id: inc.id, title: inc.title, incidentType: normalizeReportType(inc.incident_type), severity: inc.severity, confidence: inc.confidence, status: inc.status, summary: inc.summary, detectedAt: inc.detected_at || inc.created_at, latitude: lat, longitude: lng, locationName: inc.location_name }];
    }),
    [incidents],
  );

  const watchZonePoints = useMemo(
    () => watchZones.flatMap((z) => {
      const lat = toNumber(z.centroid_latitude), lng = toNumber(z.centroid_longitude);
      if (lat === null || lng === null) return [];
      return [{ id: z.id, name: z.name, riskLevel: z.current_risk_level, riskScore: toNumber(z.current_risk_score) ?? 0, latitude: lat, longitude: lng }];
    }),
    [watchZones],
  );

  const geofencePoints = useMemo(
    () => geofences.flatMap((g) => {
      const lat = toNumber(g.centroid_latitude), lng = toNumber(g.centroid_longitude);
      if (lat === null || lng === null) return [];
      return [{ id: g.id, name: g.name, geofenceType: g.geofence_type, status: g.status, description: g.description, radiusMeters: toNumber(g.radius_meters) ?? 0, latitude: lat, longitude: lng }];
    }),
    [geofences],
  );

  const routeHubs = useMemo(() => buildRouteHubs(watchZones, geofences), [watchZones, geofences]);
  const currentOriginHub = useMemo(
    () => (useCurrentLocation && originLocation ? makeCurrentLocationHub(originLocation) : null),
    [originLocation, useCurrentLocation],
  );
  const origin = currentOriginHub ?? customOrigin ?? routeHubs.find((h) => h.id === originId) ?? routeHubs[0];
  const destination = customDestination ?? routeHubs.find((h) => h.id === destinationId) ?? routeHubs[1];

  const allRoutes = useMemo(
    () => buildAllRouteOptions(origin, destination, departureHour, travelMode, incidentPoints, watchZonePoints, routeHubs),
    [origin, destination, departureHour, travelMode, incidentPoints, watchZonePoints, routeHubs],
  );

  // Auto-select best route when routes change
  useEffect(() => {
    const best = allRoutes.find((r) => r.isBest);
    if (best) setSelectedRouteId(best.id);
  }, [allRoutes]);

  const selectedRoute = allRoutes.find((r) => r.id === selectedRouteId) ?? allRoutes[0];

  useEffect(() => {
    if (!selectedRoute) return;
    liveContextRef.current = { corridorKm: selectedRoute.corridorKm, routePath: selectedRoute.routePath, travelMode, livePosition };
  }, [selectedRoute, livePosition, travelMode]);

  // Suggestion search – origin
  useEffect(() => {
    if (originInput.trim().length < 2) { setOriginSuggestions([]); setOriginSearching(false); return; }
    let active = true;
    setOriginSearching(true);
    const tick = Date.now();
    setOriginSearchTick(tick);
    const tid = window.setTimeout(async () => {
      try {
        const [remote, states, cities] = await Promise.all([
          searchLocations(originInput, 5, { state: origin.state }),
          Promise.resolve(searchStateSuggestions(originInput, 3).map((s) => ({ ...s, kind: "state" as const }))),
          Promise.resolve(searchAreaHubs(originInput, 6).map((h) => ({
            id: `area-${h.label.toLowerCase().replace(/\s+/g, "-")}`, label: h.label, state: h.state,
            latitude: h.latitude, longitude: h.longitude, description: `${h.label}, ${h.state}`, kind: "city" as const,
          }))),
        ]);
        if (!active) return;
        const merged = [
          ...states,
          ...cities,
          ...remote.map((r) => ({ id: `r-${r.id}`, label: r.label, state: r.state, latitude: r.latitude, longitude: r.longitude, description: r.description, kind: "place" as const })),
        ].filter((s, i, arr) => arr.findIndex((x) => x.label === s.label && x.state === s.state) === i);
        setOriginSuggestions(merged.slice(0, 8));
      } catch { if (active) setOriginSuggestions([]); }
      finally {
        if (active) {
          const elapsed = Date.now() - tick;
          const minVisibleMs = 350;
          if (elapsed < minVisibleMs) {
            window.setTimeout(() => {
              if (active) setOriginSearching(false);
            }, minVisibleMs - elapsed);
          } else {
            setOriginSearching(false);
          }
        }
      }
    }, 220);
    return () => { active = false; setOriginSearching(false); window.clearTimeout(tid); };
  }, [originInput, origin.state]);

  // Suggestion search – destination
  useEffect(() => {
    if (destinationInput.trim().length < 2) { setDestinationSuggestions([]); setDestinationSearching(false); return; }
    let active = true;
    setDestinationSearching(true);
    const tick = Date.now();
    setDestinationSearchTick(tick);
    const tid = window.setTimeout(async () => {
      try {
        const [remote, states, cities] = await Promise.all([
          searchLocations(destinationInput, 5, { state: destination.state }),
          Promise.resolve(searchStateSuggestions(destinationInput, 3).map((s) => ({ ...s, kind: "state" as const }))),
          Promise.resolve(searchAreaHubs(destinationInput, 6).map((h) => ({
            id: `area-${h.label.toLowerCase().replace(/\s+/g, "-")}`, label: h.label, state: h.state,
            latitude: h.latitude, longitude: h.longitude, description: `${h.label}, ${h.state}`, kind: "city" as const,
          }))),
        ]);
        if (!active) return;
        const merged = [
          ...states,
          ...cities,
          ...remote.map((r) => ({ id: `r-${r.id}`, label: r.label, state: r.state, latitude: r.latitude, longitude: r.longitude, description: r.description, kind: "place" as const })),
        ].filter((s, i, arr) => arr.findIndex((x) => x.label === s.label && x.state === s.state) === i);
        setDestinationSuggestions(merged.slice(0, 8));
      } catch { if (active) setDestinationSuggestions([]); }
      finally {
        if (active) {
          const elapsed = Date.now() - tick;
          const minVisibleMs = 350;
          if (elapsed < minVisibleMs) {
            window.setTimeout(() => {
              if (active) setDestinationSearching(false);
            }, minVisibleMs - elapsed);
          } else {
            setDestinationSearching(false);
          }
        }
      }
    }, 220);
    return () => { active = false; setDestinationSearching(false); window.clearTimeout(tid); };
  }, [destinationInput, destination.state]);

  // Live tracking effect
  useEffect(() => {
    if (!trackingEnabled || !geolocationSupported) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next: LivePosition = {
          latitude: position.coords.latitude, longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          speedKph: typeof position.coords.speed === "number" && Number.isFinite(position.coords.speed) ? position.coords.speed * 3.6 : null,
          heading: typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          updatedAt: new Date(position.timestamp).toISOString(),
        };
        setLivePosition(next);
        const now = Date.now();
        if (!selectedRoute) return;

        // Nearby incident alerts
        incidentPoints
          .map((inc) => ({ inc, dist: haversine(next.latitude, next.longitude, inc.latitude, inc.longitude) }))
          .filter(({ dist }) => dist <= (travelMode === "walk" ? 1.2 : 5))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 2)
          .forEach(({ inc, dist }) => {
            const last = recentIncidentAlertRef.current[inc.id] ?? 0;
            if (now - last < 120000) return;
            recentIncidentAlertRef.current[inc.id] = now;
            pushLiveAlert(setLiveAlerts, {
              id: `incident-${inc.id}`,
              title: `${formatType(inc.incidentType)} nearby`,
              message: `${inc.title} is ${dist.toFixed(1)}km from your position near ${inc.locationName}.`,
              severity: alertSeverityFromIncident(inc.severity),
              kind: "incident",
              createdAt: next.updatedAt,
            });
          });

        // Watch zone alerts
        const nextZoneKeys = new Set<string>();
        watchZonePoints.forEach((z) => {
          const dist = haversine(next.latitude, next.longitude, z.latitude, z.longitude);
          const radius = z.riskLevel.includes("critical") ? 10 : z.riskLevel.includes("high") ? 8 : 6;
          const key = `wz-${z.id}`;
          if (dist <= radius) {
            nextZoneKeys.add(key);
            if (!activeZoneKeysRef.current.has(key)) {
              pushLiveAlert(setLiveAlerts, {
                id: key, title: "Entering risk zone",
                message: `${z.name} is within ${dist.toFixed(1)}km. Zone score: ${z.riskScore.toFixed(0)}.`,
                severity: z.riskLevel.includes("critical") || z.riskLevel.includes("high") ? "critical" : "warning",
                kind: "watch_zone", createdAt: next.updatedAt,
              });
            }
          }
        });
        activeZoneKeysRef.current = nextZoneKeys;
      },
      (err) => { setTrackingError(err.message); setTrackingEnabled(false); },
      { enableHighAccuracy: travelMode === "walk", maximumAge: travelMode === "drive" ? 4000 : 2000, timeout: 12000 },
    );
    return () => {
      if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    };
  }, [trackingEnabled, travelMode, geolocationSupported, incidentPoints, watchZonePoints, selectedRoute]);

  const resolveCurrentLocation = useCallback(() => {
    if (!geolocationSupported) { setCurrentLocationStatus("Geolocation not available on this device."); return; }
    setCurrentLocationStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: LivePosition = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, speedKph: null, heading: null, updatedAt: new Date().toISOString() };
        setOriginLocation(loc);
        setUseCurrentLocation(true);
        setCurrentLocationStatus("Using your current location as origin.");
      },
      () => { setUseCurrentLocation(false); setCurrentLocationStatus("Could not read your location. Please type an address instead."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [geolocationSupported]);

  const handleSelectOriginSugg = useCallback((s: RouteHubSuggestion) => {
    const local = routeHubs.find((h) => h.label === s.label);
    if (local) { setCustomOrigin(null); setOriginId(local.id); }
    else { const hub = makeRouteHubFromSuggestion(s, "origin"); setCustomOrigin(hub); setOriginId(hub.id); }
    setOriginInput(s.label);
    setOriginSuggestions([]);
    setUseCurrentLocation(false);
    setCurrentLocationStatus("");
  }, [routeHubs]);

  const handleSelectDestinationSugg = useCallback((s: RouteHubSuggestion) => {
    const local = routeHubs.find((h) => h.label === s.label);
    if (local) { setCustomDestination(null); setDestinationId(local.id); }
    else { const hub = makeRouteHubFromSuggestion(s, "destination"); setCustomDestination(hub); setDestinationId(hub.id); }
    setDestinationInput(s.label);
    setDestinationSuggestions([]);
  }, [routeHubs]);

  const handleSwap = useCallback(() => {
    setOriginId(destinationId); setDestinationId(originId);
    setCustomOrigin(customDestination); setCustomDestination(customOrigin);
    setOriginInput(destinationInput); setDestinationInput(originInput);
    setOriginSuggestions([]); setDestinationSuggestions([]);
    setUseCurrentLocation(false); setCurrentLocationStatus("");
  }, [originId, destinationId, customOrigin, customDestination, originInput, destinationInput]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("geopulse.token");
    localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }, []);

  const handleNav = useCallback((i: number) => {
    const next = navItems[i];
    if (next) router.push(next.path);
  }, [navItems, router]);

  if (!mounted) return null;

  const panelProps = {
    routes: allRoutes,
    selectedRouteId,
    onSelectRoute: setSelectedRouteId,
    activeTab,
    onTabChange: setActiveTab,
    originInput, destinationInput, originSuggestions, destinationSuggestions,
    originSearching, destinationSearching,
    departureHour, travelMode,
    onOriginChange: (v: string) => setOriginInput(v),
    onDestinationChange: (v: string) => setDestinationInput(v),
    onSelectOriginSugg: handleSelectOriginSugg,
    onSelectDestinationSugg: handleSelectDestinationSugg,
    onClearOrigin: () => { setOriginInput(""); setOriginSuggestions([]); },
    onClearDestination: () => { setDestinationInput(""); setDestinationSuggestions([]); },
    onHourChange: setDepartureHour,
    onSwap: handleSwap,
    onTravelModeChange: setTravelMode,
    trackingEnabled, livePosition, useCurrentLocation,
    onUseCurrentLocation: resolveCurrentLocation,
    currentLocationStatus,
    trackingError: trackingError || (!geolocationSupported && trackingEnabled ? "Geolocation unavailable on this device." : ""),
    liveAlerts,
    onToggleTracking: () => { setTrackingError(""); setTrackingEnabled((v) => !v); },
    loading,
  };

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased lg:h-screen lg:overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_40%_at_0%_0%,rgba(6,182,212,0.05),transparent)]" />

      <LiveAlertBanner alerts={liveAlerts} onDismiss={(id) => setLiveAlerts((a) => a.filter((x) => x.id !== id))} />

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/route-intelligence"
        onNavigate={(path) => router.push(path)}
        onLogout={handleLogout}
        role={role}
      />

      {/* ══ DESKTOP LAYOUT ══ */}
      <div className="hidden h-screen flex-col overflow-hidden lg:ml-64 lg:flex">
        {/* Top bar */}
        <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#060B16]/90 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-400">Route Intelligence</span>
            </div>
            {selectedRoute && (
              <span className="hidden text-sm text-white/35 xl:block">{selectedRoute.routeStops.map((s) => s.label).join(" → ")}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {trackingEnabled && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-emerald-300">
                ● Live {travelMode}
              </span>
            )}
            {selectedRoute && <RiskPill level={selectedRoute.level} score={selectedRoute.score} />}
            {selectedRoute && (
              <span className="flex items-center gap-1.5 text-xs text-white/35">
                <IconClock />
                {formatDuration(selectedRoute.durationMin)}
              </span>
            )}
            <span className="text-[11px] text-white/25">{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</span>
          </div>
        </header>

        {/* Two-column */}
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_400px] overflow-hidden">
          {/* Map */}
          <div className="relative min-h-0">
            <DashboardMap
              selectedState={origin.state}
              zoom={6}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              incidents={incidentPoints}
              watchZones={watchZonePoints}
              geofences={geofencePoints}
              showControlsUi={false}
              routePath={selectedRoute?.routePath}
              routeStops={selectedRoute?.routeStops}
              trackedPosition={livePosition ? { latitude: livePosition.latitude, longitude: livePosition.longitude, label: "You" } : null}
              followTrackedPosition={trackingEnabled}
              showIncidents showHeatmap showRiskZones showGeofencing={false}
            />
          </div>

          {/* Panel */}
          <div className="flex min-h-0 flex-col overflow-hidden border-l border-white/[0.06]">
            <MainPanel {...panelProps} />
          </div>
        </div>
      </div>

      {/* ══ MOBILE LAYOUT ══ */}
      <div className="lg:hidden">
        {/* Full-screen map */}
        <div className="fixed inset-0">
          <DashboardMap
            selectedState={origin.state}
            zoom={5}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            incidents={incidentPoints}
            watchZones={watchZonePoints}
            geofences={geofencePoints}
            showControlsUi={false}
            routePath={selectedRoute?.routePath}
            routeStops={selectedRoute?.routeStops}
            trackedPosition={livePosition ? { latitude: livePosition.latitude, longitude: livePosition.longitude, label: "You" } : null}
            followTrackedPosition={trackingEnabled}
            showIncidents showHeatmap showRiskZones showGeofencing={false}
          />
        </div>

        {/* Mobile top bar */}
        <div className="fixed left-0 right-0 top-0 z-30 flex items-center gap-2 px-3 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/[0.1] bg-[#060B16]/90 text-white/60 backdrop-blur-xl"
          >
            <IconMenu />
          </button>

          {/* Quick summary pill */}
          {selectedRoute && (
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#060B16]/90 px-3 py-2 backdrop-blur-xl">
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${RISK_CONFIG[selectedRoute.level].dot}`} />
              <span className="min-w-0 flex-1 truncate text-sm text-white/75">
                {origin.label} → {destination.label}
              </span>
              <span className="flex flex-shrink-0 items-center gap-1 text-xs text-white/50">
                <IconClock />{formatDuration(selectedRoute.durationMin)}
              </span>
              <RiskPill level={selectedRoute.level} score={selectedRoute.score} compact />
            </div>
          )}
        </div>

        {/* Bottom sheet */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-3xl border-t border-white/[0.08] bg-[#060B16]/97 backdrop-blur-2xl transition-[height] duration-300 ease-out ${
            sheetExpanded ? "h-[88vh]" : "h-[auto]"
          }`}
          style={!sheetExpanded ? { maxHeight: "42vh" } : undefined}
        >
          {/* Drag handle + summary */}
          <button
            onClick={() => setSheetExpanded((v) => !v)}
            className="flex w-full flex-col items-center gap-2 px-4 pb-1 pt-3"
            aria-label={sheetExpanded ? "Collapse" : "Expand"}
          >
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </button>

          {/* Always-visible quick stats */}
          {selectedRoute && (
            <div className="shrink-0 px-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/30">Best route</p>
                  <p className="mt-0.5 text-sm font-bold text-white">{selectedRoute.label}</p>
                </div>
                <button
                  onClick={() => setSheetExpanded((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full border border-white/[0.07] px-3 py-1.5 text-xs text-white/40"
                >
                  {sheetExpanded ? "Collapse" : "Details"}
                  <IconChevronDown className={`transition-transform ${sheetExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>
              <div className="mt-2.5 grid grid-cols-4 gap-2">
                {[
                  { label: "ETA", value: formatDuration(selectedRoute.durationMin), icon: <IconClock /> },
                  { label: "Distance", value: formatDistance(selectedRoute.distanceKm), icon: <IconRoute /> },
                  { label: "Threats", value: String(selectedRoute.incidents.length), icon: <IconWarning /> },
                  { label: "Risk", value: String(selectedRoute.score), icon: <IconShield /> },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.03] p-2">
                    <span className="text-white/30">{stat.icon}</span>
                    <p className="mt-1 text-sm font-bold text-white">{stat.value}</p>
                    <p className="text-[9px] text-white/25">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expanded full panel */}
          {sheetExpanded && (
            <div className="min-h-0 flex-1 overflow-hidden">
              <MainPanel {...panelProps} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}