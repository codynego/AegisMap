"use client";

import { useEffect, useMemo, useState, useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { DashboardMap } from "@/components/dashboard-map";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole, getPublicNavItems, type NavItem } from "@/lib/access";
import InternalRouteIntelligencePage from "../../internal/route-intelligence/page";
import { formatReportType, normalizeReportType } from "@/lib/report-types";
import { searchLocations, type LocationSearchResult } from "@/lib/location-search";

// ─── Types ────────────────────────────────────────────────────────────────────

type IncidentRecord = {
  id: number;
  title: string;
  incident_type: string;
  confidence: string;
  severity: string;
  status: string;
  location_name: string;
  latitude: number | string | null;
  longitude: number | string | null;
  summary: string;
  detected_at: string;
  created_at: string;
};

type WatchZoneRecord = {
  id: number;
  name: string;
  zone_type: string;
  current_risk_level: string;
  current_risk_score: number | string | null;
  centroid_latitude: number | string | null;
  centroid_longitude: number | string | null;
};

type GeofenceRecord = {
  id: number;
  name: string;
  geofence_type: string;
  status: string;
  centroid_latitude: number | string | null;
  centroid_longitude: number | string | null;
  radius_meters: number | string | null;
  description: string;
};

type DashboardAlert = {
  id: number;
  level: string;
  triggeredAt?: string;
  title: string;
  body: string;
  meta: string;
};

type ApiListResponse<T> = { results?: T[] };

type MapIncidentPoint = {
  id: number;
  title: string;
  incidentType: string;
  severity: string;
  confidence: string;
  status: string;
  summary: string;
  detectedAt: string;
  latitude: number;
  longitude: number;
  locationName: string;
};

type WatchZonePoint = {
  id: number;
  name: string;
  riskLevel: string;
  riskScore: number;
  latitude: number;
  longitude: number;
};

type RouteHub = {
  id: string;
  label: string;
  state: string;
  latitude: number;
  longitude: number;
};

type RouteHubSuggestion = {
  id: string;
  label: string;
  state: string;
  latitude: number;
  longitude: number;
  description: string;
};

type RouteStop = {
  label: string;
  latitude: number;
  longitude: number;
  kind: "origin" | "waypoint" | "destination";
};

type ScoredIncident = MapIncidentPoint & { distanceKm: number; weight: number };
type ScoredWatchZone = WatchZonePoint & { distanceKm: number; weight: number };

type RiskLevel = "low" | "guarded" | "elevated" | "high" | "critical";
type TravelMode = "drive" | "walk";

type RouteAssessment = {
  routeLabel: string;
  score: number;
  level: RiskLevel;
  distanceKm: number;
  corridorKm: number;
  routePath: Array<[number, number]>;
  routeStops: RouteStop[];
  incidents: ScoredIncident[];
  watchZones: ScoredWatchZone[];
  summary: string;
  advisories: string[];
  timingNote: string;
};

type LivePosition = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speedKph: number | null;
  heading: number | null;
  updatedAt: string;
};

type LiveAlertSeverity = "info" | "warning" | "critical";

type LiveAlert = {
  id: string;
  title: string;
  message: string;
  severity: LiveAlertSeverity;
  kind: "incident" | "watch_zone" | "geofence" | "route_ahead" | "feed";
  createdAt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

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

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; dot: string }> = {
  critical: { color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-400" },
  high: { color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400" },
  elevated: { color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" },
  guarded: { color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", dot: "bg-cyan-400" },
  low: { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" },
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

function formatType(value: string): string {
  return formatReportType(value);
}

function makeRouteHubFromLocation(result: LocationSearchResult, kind: "origin" | "destination"): RouteHub {
  return {
    id: `custom-${kind}-${result.id}`,
    label: result.label,
    state: result.state,
    latitude: result.latitude,
    longitude: result.longitude,
  };
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
  if (path.length < 2) {
    return { offsetKm: Infinity, alongKm: 0, totalKm: 0 };
  }

  let minOffsetKm = Infinity;
  let closestAlongKm = 0;
  let traversedKm = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const [aLng, aLat] = path[i];
    const [bLng, bLat] = path[i + 1];
    const mLat = (((lat + aLat + bLat) / 3) * Math.PI) / 180;
    const kLat = 111.32;
    const kLng = 111.32 * Math.cos(mLat);
    const px = lng * kLng;
    const py = lat * kLat;
    const ax = aLng * kLng;
    const ay = aLat * kLat;
    const bx = bLng * kLng;
    const by = bLat * kLat;
    const abx = bx - ax;
    const aby = by - ay;
    const segmentLengthKm = Math.hypot(abx, aby);
    const ls = abx ** 2 + aby ** 2;
    const t = ls === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / ls));
    const projectedX = ax + abx * t;
    const projectedY = ay + aby * t;
    const offsetKm = Math.hypot(px - projectedX, py - projectedY);

    if (offsetKm < minOffsetKm) {
      minOffsetKm = offsetKm;
      closestAlongKm = traversedKm + segmentLengthKm * t;
    }

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
  const lf =
    level.includes("critical") ? 1.4 : level.includes("high") ? 1.1 : level.includes("medium") ? 0.85 : 0.55;
  return (score / 100) * 8 * lf;
}

function freshnessWeight(value: string): number {
  const h = Math.max(0, (Date.now() - new Date(value).getTime()) / 36e5);
  return h <= 6 ? 1.5 : h <= 24 ? 1.25 : h <= 72 ? 1 : h <= 168 ? 0.75 : 0.45;
}

function scoreToLevel(s: number): RiskLevel {
  return s >= 85 ? "critical" : s >= 65 ? "high" : s >= 40 ? "elevated" : s >= 20 ? "guarded" : "low";
}

function incidentAlertRadiusKm(mode: TravelMode) {
  return mode === "drive" ? 5 : 1.2;
}

function routeAheadLookaheadKm(mode: TravelMode) {
  return mode === "drive" ? 18 : 4;
}

function watchZoneEntryRadiusKm(level: string) {
  if (level.includes("critical")) return 10;
  if (level.includes("high")) return 8;
  if (level.includes("medium")) return 6;
  return 4;
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

function isOngoingIncident(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized !== "resolved" && normalized !== "closed" && normalized !== "dismissed";
}

function isRecentTimestamp(value?: string | null, windowHours = 6) {
  if (!value) return false;
  const ageHours = (Date.now() - new Date(value).getTime()) / 36e5;
  return ageHours >= 0 && ageHours <= windowHours;
}

function deriveHubState(latitude: number, longitude: number): string {
  let closestHub = ROUTE_HUBS[0];
  let closestDistance = Infinity;

  for (const hub of ROUTE_HUBS) {
    const distance = haversine(latitude, longitude, hub.latitude, hub.longitude);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestHub = hub;
    }
  }

  return closestHub.state;
}

function buildRouteHubs(watchZoneRecords: WatchZoneRecord[], geofenceRecords: GeofenceRecord[]): RouteHub[] {
  const dynamicHubs: RouteHub[] = [];

  watchZoneRecords.forEach((zone) => {
    if (zone.zone_type !== "route_hub") return;
    const latitude = toNumber(zone.centroid_latitude);
    const longitude = toNumber(zone.centroid_longitude);
    if (latitude === null || longitude === null) return;

    dynamicHubs.push({
      id: `watch-zone-${zone.id}`,
      label: zone.name,
      state: deriveHubState(latitude, longitude),
      latitude,
      longitude,
    });
  });

  geofenceRecords.forEach((geofence) => {
    if (geofence.geofence_type !== "village") return;
    const latitude = toNumber(geofence.centroid_latitude);
    const longitude = toNumber(geofence.centroid_longitude);
    if (latitude === null || longitude === null) return;

    dynamicHubs.push({
      id: `geofence-${geofence.id}`,
      label: geofence.name,
      state: deriveHubState(latitude, longitude),
      latitude,
      longitude,
    });
  });

  const merged = [...ROUTE_HUBS, ...dynamicHubs];
  const seen = new Set<string>();

  return merged.filter((hub) => {
    const key = `${hub.label.trim().toLowerCase()}|${hub.state.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const CURRENT_LOCATION_HUB_ID = "__current_location__";

function makeCurrentLocationHub(position: LivePosition): RouteHub {
  return {
    id: CURRENT_LOCATION_HUB_ID,
    label: "My location",
    state: deriveHubState(position.latitude, position.longitude),
    latitude: position.latitude,
    longitude: position.longitude,
  };
}

// ─── Route Logic ──────────────────────────────────────────────────────────────

function buildAssessment(
  origin: RouteHub,
  destination: RouteHub,
  hour: number,
  incidents: MapIncidentPoint[],
  zones: WatchZonePoint[],
  via?: RouteHub | null,
): RouteAssessment {
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

  const focal = routeIncidents[0]?.locationName || routeZones[0]?.name || `${origin.label}–${destination.label}`;

  const summaries: Record<RiskLevel, string> = {
    critical: `Critical exposure near ${focal}. Immediate reroute or delay advised.`,
    high: `High pressure building near ${focal}. Safer alternative recommended.`,
    elevated: `Elevated risk near ${focal}. Proceed with caution and tight timing.`,
    guarded: `Guarded monitoring advised around ${focal}.`,
    low: `No significant threat concentration on this corridor.`,
  };

  return {
    routeLabel: stops.map((s) => s.label).join(" → "),
    score,
    level,
    distanceKm: Math.round(corridorKm),
    corridorKm: threshold,
    routePath: path,
    routeStops: stops.map((s, i) => ({
      label: s.label,
      latitude: s.latitude,
      longitude: s.longitude,
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
        : `Daytime window (${hour}:00) is safer than a night movement profile.`,
    ],
    timingNote: night
      ? `Night travel after ${hour}:00 — elevated exposure on active corridors.`
      : `Departure at ${hour}:00 is within a lower-risk window.`,
  };
}

function findAlternative(
  origin: RouteHub,
  destination: RouteHub,
  hour: number,
  incidents: MapIncidentPoint[],
  zones: WatchZonePoint[],
  hubs: RouteHub[],
): RouteAssessment | null {
  const direct = haversine(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
  const candidates = hubs.filter((h) => h.id !== origin.id && h.id !== destination.id)
    .map((hub) => ({
      hub,
      detour:
        haversine(origin.latitude, origin.longitude, hub.latitude, hub.longitude) +
        haversine(hub.latitude, hub.longitude, destination.latitude, destination.longitude),
    }))
    .filter((c) => c.detour <= direct * 1.7)
    .map((c) => ({ hub: c.hub, assessment: buildAssessment(origin, destination, hour, incidents, zones, c.hub) }))
    .sort((a, b) => a.assessment.score - b.assessment.score);
  return candidates[0]?.assessment ?? null;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function RiskBadge({ level, score }: { level: RiskLevel; score: number }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${cfg.bg} ${cfg.border} ${cfg.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {level}
      <span className="ml-0.5 opacity-70">{score}</span>
    </span>
  );
}

function ScoreMeter({ score, level }: { score: number; level: RiskLevel }) {
  const cfg = RISK_CONFIG[level];
  const segments = ["low", "guarded", "elevated", "high", "critical"] as RiskLevel[];
  return (
    <div className="flex gap-1">
      {segments.map((seg) => {
        const active =
          (seg === "low" && score < 20) ||
          (seg === "guarded" && score >= 20 && score < 40) ||
          (seg === "elevated" && score >= 40 && score < 65) ||
          (seg === "high" && score >= 65 && score < 85) ||
          (seg === "critical" && score >= 85);
        const passed =
          (seg === "low" && score >= 20) ||
          (seg === "guarded" && score >= 40) ||
          (seg === "elevated" && score >= 65) ||
          (seg === "high" && score >= 85);
        return (
          <div
            key={seg}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              active ? cfg.dot : passed ? "opacity-40 " + cfg.dot : "bg-white/10"
            }`}
          />
        );
      })}
    </div>
  );
}

function Sidebar({
  open,
  onClose,
  activeIdx,
  onNav,
  onLogout,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  activeIdx: number;
  onNav: (i: number) => void;
  onLogout: () => void;
  navItems: NavItem[];
}) {
  return (
    <>
      {open && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/[0.06] bg-[#070D1A]/98 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-7">
          <h1 className="text-xl font-bold tracking-tight text-cyan-400">GeoPulse AI</h1>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">Tactical Intelligence</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {navItems.map((item, i) => (
            <button
              key={item.label}
              onClick={() => { onNav(i); onClose(); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                activeIdx === i
                  ? "bg-cyan-500/10 text-cyan-300"
                  : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${activeIdx === i ? "bg-cyan-400" : "bg-white/15"}`} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/[0.06] p-3">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/40 transition hover:bg-white/[0.04] hover:text-white/70"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function LiveWarningStack({ alerts }: { alerts: LiveAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="fixed right-4 top-20 z-40 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-2xl border px-4 py-3 shadow-[0_18px_45px_rgba(0,0,0,0.26)] backdrop-blur-xl ${alertTone(alert.severity)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">
                {alert.kind.replace("_", " ")} warning
              </p>
              <p className="mt-1 text-sm font-semibold">{alert.title}</p>
              <p className="mt-1 text-xs leading-5 opacity-85">{alert.message}</p>
            </div>
            <span className="text-[10px] opacity-60">{relativeTime(alert.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Panel Tabs ───────────────────────────────────────────────────────────────

type Tab = "planner" | "assessment" | "threats";

function PanelContent({
  tab,
  assessment,
  altAssessment,
  originInput,
  destinationInput,
  originSuggestions,
  destinationSuggestions,
  departureHour,
  previewAlt,
  loading,
  travelMode,
  trackingEnabled,
  livePosition,
  useCurrentLocation,
  onUseCurrentLocation,
  currentLocationStatus,
  trackingError,
  liveAlerts,
  heatmapEnabled,
  onOriginInputChange,
  onDestinationInputChange,
  onSelectOriginSuggestion,
  onSelectDestinationSuggestion,
  onHourChange,
  onSwap,
  onToggleAlt,
  onTravelModeChange,
  onToggleTracking,
}: {
  tab: Tab;
  assessment: RouteAssessment;
  altAssessment: RouteAssessment | null;
  originInput: string;
  destinationInput: string;
  originSuggestions: RouteHubSuggestion[];
  destinationSuggestions: RouteHubSuggestion[];
  departureHour: number;
  previewAlt: boolean;
  loading: boolean;
  travelMode: TravelMode;
  trackingEnabled: boolean;
  livePosition: LivePosition | null;
  useCurrentLocation: boolean;
  onUseCurrentLocation: () => void;
  currentLocationStatus: string;
  trackingError: string;
  liveAlerts: LiveAlert[];
  heatmapEnabled: boolean;
  onOriginInputChange: (v: string) => void;
  onDestinationInputChange: (v: string) => void;
  onSelectOriginSuggestion: (suggestion: RouteHubSuggestion) => void;
  onSelectDestinationSuggestion: (suggestion: RouteHubSuggestion) => void;
  onHourChange: (v: number) => void;
  onSwap: () => void;
  onToggleAlt: () => void;
  onTravelModeChange: (value: TravelMode) => void;
  onToggleTracking: () => void;
}) {
  const displayed = previewAlt && altAssessment ? altAssessment : assessment;
  const cfg = RISK_CONFIG[displayed.level];

  if (tab === "planner") {
    return (
      <div className="space-y-4 p-4">
        {/* Route selector */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 flex-col gap-3">
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-widest text-white/35">From</p>
                <div className="relative">
                  <input
                    value={originInput}
                    onChange={(e) => onOriginInputChange(e.target.value)}
                    placeholder="Type origin address, city, or place"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#060B16] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
                  />
                  {originSuggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08101f] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                      {originSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => onSelectOriginSuggestion(suggestion)}
                          className="flex w-full flex-col items-start gap-1 border-b border-white/[0.06] px-3 py-3 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                        >
                          <span className="text-sm font-medium text-white">{suggestion.label}</span>
                          <span className="text-xs text-white/40">{suggestion.description || suggestion.state}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onUseCurrentLocation}
                  className={`mt-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest transition ${
                    useCurrentLocation
                      ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-300"
                      : "border-white/[0.08] bg-[#060B16] text-white/45 hover:text-white/70"
                  }`}
                >
                  {useCurrentLocation ? "Using my location" : "Use my location"}
                </button>
                {currentLocationStatus ? (
                  <p className="mt-2 text-[11px] leading-5 text-white/40">{currentLocationStatus}</p>
                ) : null}
              </div>
              <div>
                <p className="mb-1.5 text-[10px] uppercase tracking-widest text-white/35">To</p>
                <div className="relative">
                  <input
                    value={destinationInput}
                    onChange={(e) => onDestinationInputChange(e.target.value)}
                    placeholder="Type destination address, city, or place"
                    className="w-full rounded-xl border border-white/[0.08] bg-[#060B16] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
                  />
                  {destinationSuggestions.length > 0 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08101f] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                      {destinationSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => onSelectDestinationSuggestion(suggestion)}
                          className="flex w-full flex-col items-start gap-1 border-b border-white/[0.06] px-3 py-3 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                        >
                          <span className="text-sm font-medium text-white">{suggestion.label}</span>
                          <span className="text-xs text-white/40">{suggestion.description || suggestion.state}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              onClick={onSwap}
              className="ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/50 transition hover:border-cyan-400/30 hover:text-cyan-300"
              aria-label="Swap origin and destination"
            >
              <SwapIcon />
            </button>
          </div>
        </div>

        {/* Departure time */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-white/35">Departure</p>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.border} ${cfg.color}`}>
              {departureHour.toString().padStart(2, "0")}:00
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={23}
            value={departureHour}
            onChange={(e) => onHourChange(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-white/25">
            <span>00:00 (midnight)</span>
            <span>23:00</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-white/35">Live movement mode</p>
            <button
              onClick={onToggleTracking}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition ${
                trackingEnabled
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white"
              }`}
            >
              {trackingEnabled ? "Stop tracking" : "Start tracking"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(["drive", "walk"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onTravelModeChange(mode)}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition ${
                  travelMode === mode
                    ? "border-cyan-400/35 bg-cyan-500/10 text-cyan-300"
                    : "border-white/[0.08] bg-[#060B16] text-white/45 hover:text-white/70"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#060B16] p-3 text-xs text-white/50">
            {trackingEnabled && livePosition ? (
              <div className="space-y-1.5">
                <p className="text-white/70">Following your live {travelMode} position on the route map.</p>
                <p>
                  {livePosition.latitude.toFixed(5)}, {livePosition.longitude.toFixed(5)}
                </p>
                <p>
                  Accuracy {livePosition.accuracy ? `${Math.round(livePosition.accuracy)}m` : "unknown"}
                  {livePosition.speedKph !== null ? ` · ${livePosition.speedKph.toFixed(0)} km/h` : ""}
                </p>
              </div>
            ) : trackingError ? (
              <p className="text-amber-300">{trackingError}</p>
            ) : (
              <p>Start tracking to keep the route map centered on your live position.</p>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#060B16] px-3 py-2.5 text-xs text-white/50">
            <span>Heatmap overlay</span>
            <span className={`rounded-full border px-2 py-0.5 uppercase tracking-widest ${heatmapEnabled ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300" : "border-white/[0.08] text-white/40"}`}>
              {heatmapEnabled ? "active" : "off"}
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#060B16] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-white/35">Active warnings</p>
              <span className="text-[10px] text-white/30">{liveAlerts.length}</span>
            </div>
            {liveAlerts.length > 0 ? (
              <div className="space-y-2">
                {liveAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className={`rounded-lg border px-3 py-2 ${alertTone(alert.severity)}`}>
                    <p className="text-[11px] font-semibold">{alert.title}</p>
                    <p className="mt-1 text-[11px] leading-5 opacity-85">{alert.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/45">No nearby route warnings at the current position.</p>
            )}
          </div>
        </div>

        {/* Timing note */}
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-3.5">
          <p className="text-[10px] uppercase tracking-widest text-amber-400/80">Timing advisory</p>
          <p className="mt-1.5 text-xs leading-5 text-white/55">{displayed.timingNote}</p>
        </div>
      </div>
    );
  }

  if (tab === "assessment") {
    return (
      <div className="space-y-4 p-4">
        {/* Primary assessment */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/35">Primary route</p>
              <p className="mt-1 text-sm font-semibold text-white">{assessment.routeLabel}</p>
            </div>
            <RiskBadge level={assessment.level} score={assessment.score} />
          </div>
          <ScoreMeter score={assessment.score} level={assessment.level} />
          <p className="mt-3 text-xs leading-5 text-white/50">{assessment.summary}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Distance", value: `${assessment.distanceKm}km` },
              { label: "Incidents", value: assessment.incidents.length },
              { label: "Risk zones", value: assessment.watchZones.length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-[#060B16] p-2.5 text-center">
                <p className="text-[10px] text-white/30">{stat.label}</p>
                <p className="mt-1 text-base font-bold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Alternative route */}
        {altAssessment && altAssessment.score < assessment.score && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-emerald-400/80">Safer alternative</p>
                <p className="mt-1 text-xs font-medium text-white/70">{altAssessment.routeLabel}</p>
              </div>
              <RiskBadge level={altAssessment.level} score={altAssessment.score} />
            </div>
            <p className="mb-3 text-xs leading-5 text-white/45">{altAssessment.summary}</p>
            <button
              onClick={onToggleAlt}
              className={`w-full rounded-xl border py-2 text-xs font-semibold uppercase tracking-widest transition ${
                previewAlt
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white"
              }`}
            >
              {previewAlt ? "Viewing alternative" : "Preview on map"}
            </button>
          </div>
        )}

        {/* Advisories */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
          <p className="mb-3 text-[10px] uppercase tracking-widest text-emerald-400/80">Guidance</p>
          <div className="space-y-2">
            {displayed.advisories.map((a, i) => (
              <div key={i} className="flex gap-2 text-xs leading-5 text-white/50">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-white/20" />
                {a}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Threats tab
  return (
    <div className="space-y-4 p-4">
      {/* Incidents */}
      <div>
        <p className="mb-2.5 text-[10px] uppercase tracking-widest text-white/35">
          Route threats ({displayed.incidents.length})
        </p>
        {displayed.incidents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-4 text-center text-xs text-white/30">
            No active incidents on this corridor
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.incidents.slice(0, 5).map((inc) => {
              const sev = RISK_CONFIG[inc.severity as RiskLevel] ?? RISK_CONFIG.low;
              return (
                <div key={inc.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{inc.title}</p>
                      <p className="mt-0.5 truncate text-[11px] text-white/35">{inc.locationName}</p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${sev.bg} ${sev.border} ${sev.color}`}>
                      {inc.severity}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-white/30">
                    <span>{formatType(inc.incidentType)}</span>
                    <span>{inc.distanceKm.toFixed(1)}km off route · {relativeTime(inc.detectedAt)}</span>
                  </div>
                </div>
              );
            })}
            {displayed.incidents.length > 5 && (
              <p className="text-center text-[11px] text-white/30">
                +{displayed.incidents.length - 5} more incidents
              </p>
            )}
          </div>
        )}
      </div>

      {/* Watch zones */}
      <div>
        <p className="mb-2.5 text-[10px] uppercase tracking-widest text-white/35">
          Pressure zones ({displayed.watchZones.length})
        </p>
        {displayed.watchZones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-4 text-center text-xs text-white/30">
            No elevated zones on this route
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.watchZones.slice(0, 4).map((z) => (
              <div key={z.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{z.name}</p>
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-300">
                    {z.riskLevel.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/30">
                  <span>Score {z.riskScore.toFixed(0)}</span>
                  <span>{z.distanceKm.toFixed(1)}km from route</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <p className="text-center text-[11px] text-white/30">Refreshing intelligence…</p>
      )}
    </div>
  );
}

function pushLiveAlert(
  setLiveAlerts: Dispatch<SetStateAction<LiveAlert[]>>,
  nextAlert: LiveAlert,
) {
  setLiveAlerts((current) => {
    const deduped = current.filter((alert) => alert.id !== nextAlert.id);
    return [nextAlert, ...deduped].slice(0, 6);
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RouteIntelligencePage() {
  const role = getCurrentRole();

  if (role === "analyst" || role === "admin") {
    return <InternalRouteIntelligencePage />;
  }

  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(3);
  const [navItems, setNavItems] = useState<NavItem[]>(() => getPublicNavItems("community_reporter"));
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("planner");

  const [originId, setOriginId] = useState("benin");
  const [destinationId, setDestinationId] = useState("abuja");
  const [customOrigin, setCustomOrigin] = useState<RouteHub | null>(null);
  const [customDestination, setCustomDestination] = useState<RouteHub | null>(null);
  const [originInput, setOriginInput] = useState("Benin City");
  const [destinationInput, setDestinationInput] = useState("Abuja");
  const [originSuggestions, setOriginSuggestions] = useState<RouteHubSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<RouteHubSuggestion[]>([]);
  const [departureHour, setDepartureHour] = useState(20);
  const [previewAlt, setPreviewAlt] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>("drive");
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
  const liveContextRef = useRef<{
    corridorKm: number;
    routePath: Array<[number, number]>;
    travelMode: TravelMode;
    livePosition: LivePosition | null;
  }>({
    corridorKm: 0,
    routePath: [],
    travelMode: "drive",
    livePosition: null,
  });

  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("geopulse.token"),
  );
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [watchZones, setWatchZones] = useState<WatchZoneRecord[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(Boolean(authToken));
  const geolocationSupported =
    typeof window !== "undefined" && typeof navigator !== "undefined" && Boolean(navigator.geolocation);

  const resolveCurrentLocation = useCallback(() => {
    if (!geolocationSupported || !navigator.geolocation) {
      setCurrentLocationStatus("Geolocation is not available on this device.");
      setUseCurrentLocation(false);
      return;
    }

    setCurrentLocationStatus("Locating your current position...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          speedKph: typeof position.coords.speed === "number" && Number.isFinite(position.coords.speed)
            ? position.coords.speed * 3.6
            : null,
          heading: typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading)
            ? position.coords.heading
            : null,
          updatedAt: new Date(position.timestamp).toISOString(),
        };
        setOriginLocation(nextLocation);
        setUseCurrentLocation(true);
        setCurrentLocationStatus("Using your current location as the route origin.");
      },
      () => {
        setOriginLocation(null);
        setUseCurrentLocation(false);
        setCurrentLocationStatus("Could not read your location. Select a city instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [geolocationSupported]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setNavItems(getPublicNavItems(getCurrentRole()));
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
            nextIncidents.map((incident) => [incident.id, incident.detected_at || incident.created_at || ""]),
          );

          if (incidentFeedPrimedRef.current) {
            const context = liveContextRef.current;
            const routeProjection = context.livePosition
              ? projectToPathKm(context.livePosition.latitude, context.livePosition.longitude, context.routePath)
              : null;
            const newIncidents = nextIncidents
              .filter((incident) => {
                const marker = incident.detected_at || incident.created_at || "";
                return incidentSnapshotRef.current[incident.id] !== marker;
              })
              .filter((incident) => {
                const lat = toNumber(incident.latitude);
                const lng = toNumber(incident.longitude);
                if (lat === null || lng === null) return false;
                const routeOffsetKm = ptToPathKm(lat, lng, context.routePath);
                const userDistanceKm = context.livePosition
                  ? haversine(context.livePosition.latitude, context.livePosition.longitude, lat, lng)
                  : Infinity;
                return (
                  routeOffsetKm <= context.corridorKm + 5 ||
                  userDistanceKm <= routeAheadLookaheadKm(context.travelMode)
                );
              })
              .filter(
                (incident) =>
                  isOngoingIncident(incident.status) ||
                  isRecentTimestamp(incident.detected_at || incident.created_at, 2),
              )
              .slice(0, 2);

            newIncidents.forEach((incident) => {
              const lat = toNumber(incident.latitude);
              const lng = toNumber(incident.longitude);
              if (lat === null || lng === null) return;

              const routeOffsetKm = ptToPathKm(lat, lng, context.routePath);
              const projectionDeltaKm =
                routeProjection
                  ? projectToPathKm(lat, lng, context.routePath).alongKm - routeProjection.alongKm
                  : null;
              const recentOrOngoing = isOngoingIncident(incident.status) ? "Ongoing" : "Recent";

              pushLiveAlert(setLiveAlerts, {
                id: `feed-${incident.id}`,
                title: `${recentOrOngoing} ${formatType(incident.incident_type)} update`,
                message:
                  projectionDeltaKm !== null && projectionDeltaKm > 0
                    ? `${incident.title} was just reported ${projectionDeltaKm.toFixed(1)}km ahead near ${incident.location_name}.`
                    : `${incident.title} was just reported near ${incident.location_name}, ${routeOffsetKm.toFixed(1)}km off your active route.`,
                severity: alertSeverityFromIncident(incident.severity),
                kind: "feed",
                createdAt: incident.detected_at || incident.created_at || new Date().toISOString(),
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
                id: Number(a.id ?? i + 1),
                level: sev === "critical" ? "Critical" : sev === "high" ? "Warning" : "Info",
                triggeredAt: String(a.triggered_at ?? ""),
                title: String(a.title ?? "Alert"),
                body: String(a.message ?? ""),
                meta: String(a.status ?? "ACTIVE").toUpperCase(),
              };
            }),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 45000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [authToken]);

  const incidentPoints = useMemo(
    () =>
      incidents.flatMap((inc) => {
        const lat = toNumber(inc.latitude);
        const lng = toNumber(inc.longitude);
        if (lat === null || lng === null) return [];
        return [{
          id: inc.id,
          title: inc.title,
          incidentType: normalizeReportType(inc.incident_type),
          severity: inc.severity,
          confidence: inc.confidence,
          status: inc.status,
          summary: inc.summary,
          detectedAt: inc.detected_at || inc.created_at,
          latitude: lat,
          longitude: lng,
          locationName: inc.location_name,
        }];
      }),
    [incidents],
  );

  const watchZonePoints = useMemo(
    () =>
      watchZones.flatMap((z) => {
        const lat = toNumber(z.centroid_latitude);
        const lng = toNumber(z.centroid_longitude);
        if (lat === null || lng === null) return [];
        return [{ id: z.id, name: z.name, riskLevel: z.current_risk_level, riskScore: toNumber(z.current_risk_score) ?? 0, latitude: lat, longitude: lng }];
      }),
    [watchZones],
  );

  const geofencePoints = useMemo(
    () =>
      geofences.flatMap((g) => {
        const lat = toNumber(g.centroid_latitude);
        const lng = toNumber(g.centroid_longitude);
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
  const originSearchState = currentOriginHub?.state ?? customOrigin?.state ?? routeHubs.find((hub) => hub.id === originId)?.state ?? routeHubs[0]?.state ?? "Lagos";
  const destinationSearchState = customDestination?.state ?? routeHubs.find((hub) => hub.id === destinationId)?.state ?? routeHubs[1]?.state ?? "Lagos";

  useEffect(() => {
    if (originInput.trim().length < 2) {
      return;
    }
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const remote = await searchLocations(originInput, 5, { state: originSearchState });
        if (!active) return;
        const normalizedInput = originInput.trim().toLowerCase();
        const normalizedState = originSearchState.trim().toLowerCase();
        const local = routeHubs
          .filter((hub) => hub.state.trim().toLowerCase() === normalizedState)
          .filter((hub) => !normalizedInput || hub.label.toLowerCase().includes(normalizedInput) || normalizedInput === normalizedState)
          .slice(0, 4)
          .map((hub) => ({
            id: hub.id,
            label: hub.label,
            state: hub.state,
            latitude: hub.latitude,
            longitude: hub.longitude,
            description: hub.state,
          }));
        const remoteMapped = remote.map((result) => ({
          id: `remote-${result.id}`,
          label: result.label,
          state: result.state,
          latitude: result.latitude,
          longitude: result.longitude,
          description: result.description,
        }));
        const merged = [...local, ...remoteMapped].filter(
          (suggestion, index, self) => self.findIndex((item) => item.label === suggestion.label) === index,
        );
        setOriginSuggestions(merged.slice(0, 6));
      } catch {
        if (active) setOriginSuggestions([]);
      }
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [originInput, originSearchState, routeHubs]);

  useEffect(() => {
    if (destinationInput.trim().length < 2) {
      return;
    }
    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        const remote = await searchLocations(destinationInput, 5, { state: destinationSearchState });
        if (!active) return;
        const normalizedInput = destinationInput.trim().toLowerCase();
        const normalizedState = destinationSearchState.trim().toLowerCase();
        const local = routeHubs
          .filter((hub) => hub.state.trim().toLowerCase() === normalizedState)
          .filter((hub) => !normalizedInput || hub.label.toLowerCase().includes(normalizedInput) || normalizedInput === normalizedState)
          .slice(0, 4)
          .map((hub) => ({
            id: hub.id,
            label: hub.label,
            state: hub.state,
            latitude: hub.latitude,
            longitude: hub.longitude,
            description: hub.state,
          }));
        const remoteMapped = remote.map((result) => ({
          id: `remote-${result.id}`,
          label: result.label,
          state: result.state,
          latitude: result.latitude,
          longitude: result.longitude,
          description: result.description,
        }));
        const merged = [...local, ...remoteMapped].filter(
          (suggestion, index, self) => self.findIndex((item) => item.label === suggestion.label) === index,
        );
        setDestinationSuggestions(merged.slice(0, 6));
      } catch {
        if (active) setDestinationSuggestions([]);
      }
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [destinationInput, destinationSearchState, routeHubs]);

  const origin = currentOriginHub ?? customOrigin ?? routeHubs.find((h) => h.id === originId) ?? routeHubs[0];
  const destination = customDestination ?? routeHubs.find((h) => h.id === destinationId) ?? routeHubs[1];

  const primaryAssessment = useMemo(
    () => buildAssessment(origin, destination, departureHour, incidentPoints, watchZonePoints),
    [origin, destination, departureHour, incidentPoints, watchZonePoints],
  );

  const altAssessment = useMemo(
    () => findAlternative(origin, destination, departureHour, incidentPoints, watchZonePoints, routeHubs),
    [origin, destination, departureHour, incidentPoints, watchZonePoints, routeHubs],
  );

  const displayed = previewAlt && altAssessment ? altAssessment : primaryAssessment;
  const cfg = RISK_CONFIG[displayed.level];
  const effectiveTrackingError =
    trackingError || (!geolocationSupported && trackingEnabled ? "Geolocation is not available on this device." : "");
  const heatmapEnabled = true;
  const liveRouteOffsetKm = useMemo(
    () => (livePosition ? ptToPathKm(livePosition.latitude, livePosition.longitude, displayed.routePath) : null),
    [displayed.routePath, livePosition],
  );

  useEffect(() => {
    liveContextRef.current = {
      corridorKm: displayed.corridorKm,
      routePath: displayed.routePath,
      travelMode,
      livePosition,
    };
  }, [displayed.corridorKm, displayed.routePath, livePosition, travelMode]);

  useEffect(() => {
    if (!trackingEnabled) {
      if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      return;
    }

    if (!geolocationSupported || !navigator.geolocation) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const speedMps = position.coords.speed;
        const nextPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          speedKph: typeof speedMps === "number" && Number.isFinite(speedMps) ? speedMps * 3.6 : null,
          heading: typeof position.coords.heading === "number" && Number.isFinite(position.coords.heading)
            ? position.coords.heading
            : null,
          updatedAt: new Date(position.timestamp).toISOString(),
        };
        setLivePosition(nextPosition);

        const now = Date.now();
        const proximityRadiusKm = incidentAlertRadiusKm(travelMode);
        const userProjection = projectToPathKm(
          nextPosition.latitude,
          nextPosition.longitude,
          displayed.routePath,
        );
        const aheadWindowKm = routeAheadLookaheadKm(travelMode);
        const incidentsNearby = incidentPoints
          .map((incident) => ({
            incident,
            distanceKm: haversine(
              nextPosition.latitude,
              nextPosition.longitude,
              incident.latitude,
              incident.longitude,
            ),
            routeDistanceKm: ptToPathKm(incident.latitude, incident.longitude, displayed.routePath),
          }))
          .filter(
            ({ distanceKm, routeDistanceKm }) =>
              distanceKm <= proximityRadiusKm && routeDistanceKm <= displayed.corridorKm + 5,
          )
          .sort((left, right) => left.distanceKm - right.distanceKm);

        incidentsNearby.slice(0, 2).forEach(({ incident, distanceKm }) => {
          const lastAlertAt = recentIncidentAlertRef.current[incident.id] ?? 0;
          if (now - lastAlertAt < 120000) return;
          recentIncidentAlertRef.current[incident.id] = now;
          pushLiveAlert(setLiveAlerts, {
            id: `incident-${incident.id}`,
            title: `${formatType(incident.incidentType)} nearby`,
            message: `${incident.title} is ${distanceKm.toFixed(1)}km from your current ${travelMode} position near ${incident.locationName}.`,
            severity: alertSeverityFromIncident(incident.severity),
            kind: "incident",
            createdAt: nextPosition.updatedAt,
          });
        });

        const incidentsAhead = incidentPoints
          .map((incident) => {
            const incidentProjection = projectToPathKm(
              incident.latitude,
              incident.longitude,
              displayed.routePath,
            );
            return {
              incident,
              distanceKm: haversine(
                nextPosition.latitude,
                nextPosition.longitude,
                incident.latitude,
                incident.longitude,
              ),
              aheadKm: incidentProjection.alongKm - userProjection.alongKm,
              offsetKm: incidentProjection.offsetKm,
            };
          })
          .filter(
            ({ aheadKm, offsetKm }) =>
              aheadKm > 0.2 && aheadKm <= aheadWindowKm && offsetKm <= Math.max(displayed.corridorKm, 6),
          )
          .sort((left, right) => left.aheadKm - right.aheadKm);

        incidentsAhead.slice(0, 2).forEach(({ incident, aheadKm }) => {
          const alertKey = `route-ahead-incident-${incident.id}`;
          const lastAlertAt = recentRouteAlertRef.current[alertKey] ?? 0;
          if (now - lastAlertAt < 180000) return;
          recentRouteAlertRef.current[alertKey] = now;
          pushLiveAlert(setLiveAlerts, {
            id: alertKey,
            title: `${formatType(incident.incidentType)} ahead on route`,
            message: `${incident.title} is ${aheadKm.toFixed(1)}km ahead near ${incident.locationName}.`,
            severity: alertSeverityFromIncident(incident.severity),
            kind: "route_ahead",
            createdAt: nextPosition.updatedAt,
          });
        });

        const nextZoneKeys = new Set<string>();
        watchZonePoints.forEach((zone) => {
          const distanceKm = haversine(
            nextPosition.latitude,
            nextPosition.longitude,
            zone.latitude,
            zone.longitude,
          );
          const triggerRadiusKm = watchZoneEntryRadiusKm(zone.riskLevel);
          const key = `watch-zone-${zone.id}`;
          if (distanceKm <= triggerRadiusKm) {
            nextZoneKeys.add(key);
            if (!activeZoneKeysRef.current.has(key)) {
              pushLiveAlert(setLiveAlerts, {
                id: key,
                title: "Entering high-risk zone",
                message: `${zone.name} is now within ${distanceKm.toFixed(1)}km. Current zone score is ${zone.riskScore.toFixed(0)}.`,
                severity:
                  zone.riskLevel.includes("critical") || zone.riskLevel.includes("high")
                    ? "critical"
                    : "warning",
                kind: "watch_zone",
                createdAt: nextPosition.updatedAt,
              });
            }
          }
        });
        activeZoneKeysRef.current = nextZoneKeys;

        const zonesAhead = watchZonePoints
          .map((zone) => {
            const zoneProjection = projectToPathKm(zone.latitude, zone.longitude, displayed.routePath);
            return {
              zone,
              aheadKm: zoneProjection.alongKm - userProjection.alongKm,
              offsetKm: zoneProjection.offsetKm,
            };
          })
          .filter(
            ({ aheadKm, offsetKm }) =>
              aheadKm > 0.5 && aheadKm <= aheadWindowKm + 4 && offsetKm <= Math.max(displayed.corridorKm + 4, 8),
          )
          .sort((left, right) => left.aheadKm - right.aheadKm);

        zonesAhead.slice(0, 1).forEach(({ zone, aheadKm }) => {
          const alertKey = `route-ahead-zone-${zone.id}`;
          const lastAlertAt = recentRouteAlertRef.current[alertKey] ?? 0;
          if (now - lastAlertAt < 240000) return;
          recentRouteAlertRef.current[alertKey] = now;
          pushLiveAlert(setLiveAlerts, {
            id: alertKey,
            title: `${formatType(zone.riskLevel)} risk zone ahead`,
            message: `${zone.name} is ${aheadKm.toFixed(1)}km ahead on your active route.`,
            severity:
              zone.riskLevel.includes("critical") || zone.riskLevel.includes("high") ? "critical" : "warning",
            kind: "route_ahead",
            createdAt: nextPosition.updatedAt,
          });
        });

        const nextGeofenceKeys = new Set<string>();
        geofencePoints.forEach((geofence) => {
          const distanceKm = haversine(
            nextPosition.latitude,
            nextPosition.longitude,
            geofence.latitude,
            geofence.longitude,
          );
          const triggerRadiusKm = Math.max(
            (geofence.radiusMeters || 0) / 1000,
            travelMode === "drive" ? 0.75 : 0.25,
          );
          const key = `geofence-${geofence.id}`;
          if (distanceKm <= triggerRadiusKm) {
            nextGeofenceKeys.add(key);
            if (!activeGeofenceKeysRef.current.has(key)) {
              pushLiveAlert(setLiveAlerts, {
                id: key,
                title: `Entering ${formatType(geofence.geofenceType)} zone`,
                message: `${geofence.name} is now within your active movement radius.`,
                severity:
                  geofence.geofenceType === "school" || geofence.geofenceType === "facility"
                    ? "warning"
                    : "info",
                kind: "geofence",
                createdAt: nextPosition.updatedAt,
              });
            }
          }
        });
        activeGeofenceKeysRef.current = nextGeofenceKeys;
      },
      (error) => {
        setTrackingError(error.message || "Unable to read live position.");
        setTrackingEnabled(false);
      },
      {
        enableHighAccuracy: travelMode === "walk",
        maximumAge: travelMode === "drive" ? 4000 : 2000,
        timeout: travelMode === "drive" ? 12000 : 9000,
      },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [
    displayed.corridorKm,
    displayed.routePath,
    geofencePoints,
    geolocationSupported,
    incidentPoints,
    trackingEnabled,
    travelMode,
    watchZonePoints,
  ]);

  useEffect(() => {
    activeZoneKeysRef.current = new Set();
    activeGeofenceKeysRef.current = new Set();
    recentIncidentAlertRef.current = {};
    recentRouteAlertRef.current = {};
  }, [displayed.routeLabel, trackingEnabled, travelMode]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("geopulse.token");
    localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }, []);

  const handleNav = useCallback((i: number) => {
    setActiveNav(i);
    const next = navItems[i];
    if (next) {
      router.push(next.path);
    }
  }, [navItems, router]);

  const handleUseCurrentLocation = useCallback(() => {
    setOriginId(CURRENT_LOCATION_HUB_ID);
    setOriginInput("My location");
    resolveCurrentLocation();
  }, [resolveCurrentLocation]);

  const handleSelectOriginSuggestion = useCallback((suggestion: RouteHubSuggestion) => {
    const localMatch = routeHubs.find((hub) => hub.id === suggestion.id || hub.label === suggestion.label);
    if (localMatch) {
      setCustomOrigin(null);
      setOriginId(localMatch.id);
      setOriginInput(localMatch.label);
    } else {
      const hub = makeRouteHubFromLocation(
        {
          id: suggestion.id,
          label: suggestion.label,
          description: suggestion.description,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          state: suggestion.state,
        },
        "origin",
      );
      setCustomOrigin(hub);
      setOriginId(hub.id);
      setOriginInput(hub.label);
    }
    setUseCurrentLocation(false);
    setCurrentLocationStatus("");
    setOriginSuggestions([]);
  }, [routeHubs]);

  const handleSelectDestinationSuggestion = useCallback((suggestion: RouteHubSuggestion) => {
    const localMatch = routeHubs.find((hub) => hub.id === suggestion.id || hub.label === suggestion.label);
    if (localMatch) {
      setCustomDestination(null);
      setDestinationId(localMatch.id);
      setDestinationInput(localMatch.label);
    } else {
      const hub = makeRouteHubFromLocation(
        {
          id: suggestion.id,
          label: suggestion.label,
          description: suggestion.description,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          state: suggestion.state,
        },
        "destination",
      );
      setCustomDestination(hub);
      setDestinationId(hub.id);
      setDestinationInput(hub.label);
    }
    setDestinationSuggestions([]);
  }, [routeHubs]);

  if (!mounted) return null;

  const TABS: { id: Tab; label: string }[] = [
    { id: "planner", label: "Planner" },
    { id: "assessment", label: "Assessment" },
    { id: "threats", label: `Threats ${displayed.incidents.length > 0 ? `(${displayed.incidents.length})` : ""}` },
  ];

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased lg:h-screen lg:overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_0%_0%,rgba(6,182,212,0.04),transparent)]" />
      <LiveWarningStack alerts={liveAlerts} />

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/route-intelligence"
        onNavigate={(path) => router.push(path)}
        onLogout={handleLogout}
        role={role}
      />

      {/* ── Desktop layout ── */}
      <div className="hidden h-screen flex-col overflow-hidden lg:ml-64 lg:flex">
        {/* Top bar */}
        <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#060B16]/90 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-400">Route Intelligence</span>
            </div>
            <span className="text-sm text-white/40">{displayed.routeLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            {trackingEnabled ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-emerald-300">
                {travelMode} mode live
              </span>
            ) : null}
            <RiskBadge level={displayed.level} score={displayed.score} />
            <span className="text-[11px] text-white/30">{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</span>
          </div>
        </header>

        {/* Page header */}
        <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Route Safety Analysis</h1>
          <p className="mt-1 text-sm text-white/40">Signal-weighted corridor analysis with live incident and watch zone data.</p>
        </div>

        {/* Desktop two-column */}
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_380px] overflow-hidden">
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
              routePath={displayed.routePath}
              routeStops={displayed.routeStops}
              trackedPosition={livePosition ? {
                latitude: livePosition.latitude,
                longitude: livePosition.longitude,
                label: "Live position",
              } : null}
              followTrackedPosition={trackingEnabled}
              showIncidents
              showHeatmap
              showRiskZones
              showGeofencing={false}
            />
          </div>

          {/* Panel */}
          <div className="flex min-h-0 flex-col overflow-hidden border-l border-white/[0.06]">
            {/* Tabs */}
            <div className="flex border-b border-white/[0.06]">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition ${
                    activeTab === t.id
                      ? "border-b-2 border-cyan-400 text-cyan-300"
                      : "text-white/35 hover:text-white/60"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Scrollable content */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PanelContent
                tab={activeTab}
                assessment={primaryAssessment}
                altAssessment={altAssessment}
                originInput={originInput}
                destinationInput={destinationInput}
                originSuggestions={originSuggestions}
                destinationSuggestions={destinationSuggestions}
                departureHour={departureHour}
                previewAlt={previewAlt}
                loading={loading}
                travelMode={travelMode}
                trackingEnabled={trackingEnabled}
                livePosition={livePosition}
                useCurrentLocation={useCurrentLocation}
                onUseCurrentLocation={handleUseCurrentLocation}
                currentLocationStatus={currentLocationStatus}
                trackingError={effectiveTrackingError}
                liveAlerts={liveAlerts}
                heatmapEnabled={heatmapEnabled}
                onOriginInputChange={(value) => {
                  setOriginInput(value);
                  if (value.trim().length < 2) setOriginSuggestions([]);
                }}
                onDestinationInputChange={(value) => {
                  setDestinationInput(value);
                  if (value.trim().length < 2) setDestinationSuggestions([]);
                }}
                onSelectOriginSuggestion={handleSelectOriginSuggestion}
                onSelectDestinationSuggestion={handleSelectDestinationSuggestion}
                onHourChange={setDepartureHour}
                onSwap={() => {
                  setOriginId(destinationId);
                  setDestinationId(originId);
                  setCustomOrigin(customDestination);
                  setCustomDestination(customOrigin);
                  setOriginInput(destination.label);
                  setDestinationInput(origin.label);
                  setOriginSuggestions([]);
                  setDestinationSuggestions([]);
                }}
                onToggleAlt={() => setPreviewAlt((v) => !v)}
                onTravelModeChange={setTravelMode}
                onToggleTracking={() => {
                  setTrackingError("");
                  setTrackingEnabled((value) => !value);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile layout (Google Maps style) ── */}
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
            routePath={displayed.routePath}
            routeStops={displayed.routeStops}
            trackedPosition={livePosition ? {
              latitude: livePosition.latitude,
              longitude: livePosition.longitude,
              label: "Live position",
            } : null}
            followTrackedPosition={trackingEnabled}
            showIncidents
            showHeatmap
            showRiskZones
            showGeofencing={false}
          />
        </div>

        {/* Mobile top bar */}
        <div className="fixed left-0 right-0 top-0 z-30 flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-[#060B16]/90 text-white/70 backdrop-blur-xl"
          >
            <HamburgerIcon />
          </button>

          {/* Route pill */}
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.08] bg-[#060B16]/90 px-3.5 py-2 backdrop-blur-xl">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${cfg.dot}`} />
            <span className="truncate text-sm text-white/80">{displayed.routeLabel}</span>
            {trackingEnabled ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-emerald-300">
                {travelMode}
              </span>
            ) : null}
            <RiskBadge level={displayed.level} score={displayed.score} />
          </div>
        </div>

        {/* Bottom sheet */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 flex flex-col rounded-t-3xl border-t border-white/[0.08] bg-[#060B16]/95 backdrop-blur-xl transition-all duration-300 ease-out ${
            panelExpanded ? "h-[85vh]" : "h-[220px]"
          }`}
        >
          {/* Pull handle */}
          <button
            onClick={() => setPanelExpanded((v) => !v)}
            aria-label={panelExpanded ? "Collapse panel" : "Expand panel"}
            className="flex w-full flex-col items-center gap-2 px-4 pt-3 pb-2"
          >
            <div className="h-1 w-10 rounded-full bg-white/20" />
            <div className="flex w-full items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/35">Route assessment</p>
                <p className="mt-0.5 text-sm font-semibold text-white">{displayed.routeLabel}</p>
              </div>
              <ChevronUpIcon className={`text-white/40 transition-transform ${panelExpanded ? "" : "rotate-180"}`} />
            </div>
          </button>

          {/* Quick stats (always visible) */}
          <div className="grid grid-cols-3 gap-2 px-4 pb-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
              <p className="text-[10px] text-white/30">Distance</p>
              <p className="mt-0.5 text-sm font-bold text-white">{displayed.distanceKm}km</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
              <p className="text-[10px] text-white/30">Incidents</p>
              <p className="mt-0.5 text-sm font-bold text-white">{displayed.incidents.length}</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5 text-center">
              <p className="text-[10px] text-white/30">{trackingEnabled ? "Offset" : "Risk zones"}</p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {trackingEnabled && liveRouteOffsetKm !== null ? `${liveRouteOffsetKm.toFixed(1)}km` : displayed.watchZones.length}
              </p>
            </div>
          </div>

          {/* Tabs + scrollable content (expanded only) */}
          {panelExpanded && (
            <>
              <div className="flex border-b border-white/[0.06] px-4">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`mr-4 pb-2.5 text-[11px] font-semibold uppercase tracking-widest transition ${
                      activeTab === t.id
                        ? "border-b-2 border-cyan-400 text-cyan-300"
                        : "text-white/35"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto pb-8">
                <PanelContent
                  tab={activeTab}
                  assessment={primaryAssessment}
                  altAssessment={altAssessment}
                  originInput={originInput}
                  destinationInput={destinationInput}
                  originSuggestions={originSuggestions}
                  destinationSuggestions={destinationSuggestions}
                  departureHour={departureHour}
                  previewAlt={previewAlt}
                  loading={loading}
                  travelMode={travelMode}
                  trackingEnabled={trackingEnabled}
                  livePosition={livePosition}
                  useCurrentLocation={useCurrentLocation}
                  onUseCurrentLocation={handleUseCurrentLocation}
                  currentLocationStatus={currentLocationStatus}
                  trackingError={effectiveTrackingError}
                  liveAlerts={liveAlerts}
                  heatmapEnabled={heatmapEnabled}
                  onOriginInputChange={(value) => {
                    setOriginInput(value);
                    if (value.trim().length < 2) setOriginSuggestions([]);
                  }}
                  onDestinationInputChange={(value) => {
                    setDestinationInput(value);
                    if (value.trim().length < 2) setDestinationSuggestions([]);
                  }}
                  onSelectOriginSuggestion={handleSelectOriginSuggestion}
                  onSelectDestinationSuggestion={handleSelectDestinationSuggestion}
                  onHourChange={setDepartureHour}
                  onSwap={() => {
                    setOriginId(destinationId);
                    setDestinationId(originId);
                    setCustomOrigin(customDestination);
                    setCustomDestination(customOrigin);
                    setOriginInput(destination.label);
                    setDestinationInput(origin.label);
                    setOriginSuggestions([]);
                    setDestinationSuggestions([]);
                  }}
                  onToggleAlt={() => setPreviewAlt((v) => !v)}
                  onTravelModeChange={setTravelMode}
                  onToggleTracking={() => {
                    setTrackingError("");
                    setTrackingEnabled((value) => !value);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
