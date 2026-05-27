"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardMap } from "@/components/dashboard-map";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole } from "@/lib/access";
import { reverseGeocodeLocation } from "@/lib/location-search";
import { resolveNearestHub, stateForCoordinates } from "@/lib/user-location";
import {
  mapIncidentWeatherContexts,
  mapRiskZoneAdjustments,
  toWeatherIntelligenceResponse,
  type WeatherContext,
  type WeatherIntelligenceResponse,
  weatherSeverityLabel,
} from "@/lib/weather-intelligence";
import {
  formatReportType,
  normalizeReportType,
  REPORT_TYPE_VALUES,
} from "@/lib/report-types";

// ─── Types ───────────────────────────────────────────────────────────────────

type DashboardAlert = {
  id: number;
  level: string;
  time: string;
  triggeredAt?: string;
  title: string;
  body: string;
  meta: string;
};

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
  visibility_score?: number;
  metadata?: Record<string, unknown> & { location_state?: string };
};

type WatchZoneRecord = {
  id: number;
  name: string;
  current_risk_level: string;
  current_risk_score: number | string | null;
  centroid_latitude: number | string | null;
  centroid_longitude: number | string | null;
  status?: string;
  zone_type?: string;
  metadata?: { location_state?: string; created_from?: string; pin_action?: string };
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
  metadata?: Record<string, unknown> & { location_state?: string };
};

type MapHoverPreview = {
  latitude: number;
  longitude: number;
  clientX: number;
  clientY: number;
};

type ApiListResponse<T> = { results?: T[] };

type PinAction =
  | "report_incident"
  | "watch_area"
  | "watch_zone"
  | "mark_hazard"
  | "save_location"
  | "request_help"
  | "add_observation";

type PinActionPayload = {
  hazardType?: string;
  observationText?: string;
  helpType?: string;
};

type DroppedPin = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  locationName: string;
  coordinateLabel: string;
  action: PinAction;
  note?: string;
  radiusMeters?: number;
  createdAt: string;
  color: string;
  persisted?: boolean;
};

type SelectedIncident = {
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
  locationState?: string;
};

type ExactPin = {
  latitude: number;
  longitude: number;
  label: string;
};

type DatePreset = "all" | "today" | "7d" | "30d" | "custom";
type LayerFilterKey = "incidents" | "heatmaps" | "riskZones" | "geofencing" | "weather";

// RightMode no longer includes "filter" — filter is a tab within the panel
type RightMode = "controls" | "incident" | "pin_detail";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

const PIN_ACTIONS: {
  key: PinAction;
  label: string;
  emoji: string;
  description: string;
  color: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
}[] = [
  {
    key: "report_incident",
    label: "Report Incident",
    emoji: "🚨",
    description: "Robbery, flood, fire",
    color: "#ef4444",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/30",
    textClass: "text-red-400",
  },
  {
    key: "watch_zone",
    label: "Watch Area",
    emoji: "📍",
    description: "Home, school, corridor",
    color: "#06b6d4",
    bgClass: "bg-cyan-500/10",
    borderClass: "border-cyan-500/30",
    textClass: "text-cyan-400",
  },
  {
    key: "mark_hazard",
    label: "Mark Hazard",
    emoji: "⚠️",
    description: "Road, bridge, flood",
    color: "#f59e0b",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    textClass: "text-amber-400",
  },
  {
    key: "save_location",
    label: "Save Location",
    emoji: "⭐",
    description: "Checkpoint, shelter",
    color: "#a78bfa",
    bgClass: "bg-violet-500/10",
    borderClass: "border-violet-500/30",
    textClass: "text-violet-400",
  },
  {
    key: "request_help",
    label: "Request Help",
    emoji: "🆘",
    description: "Stranded, emergency",
    color: "#f97316",
    bgClass: "bg-orange-500/10",
    borderClass: "border-orange-500/30",
    textClass: "text-orange-400",
  },
  {
    key: "add_observation",
    label: "Observation",
    emoji: "👁️",
    description: "Suspicious activity",
    color: "#10b981",
    bgClass: "bg-emerald-500/10",
    borderClass: "border-emerald-500/30",
    textClass: "text-emerald-400",
  },
];

const PIN_ACTION_MAP = Object.fromEntries(PIN_ACTIONS.map((a) => [a.key, a]));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(value?: string | null) {
  if (!value) return "Now";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

type ConfidenceTier = "raw" | "emerging" | "probable" | "verified";

const CONFIDENCE_STYLE: Record<ConfidenceTier, { label: string; chip: string; border: string; dot: string }> = {
  raw: { label: "Raw", chip: "bg-slate-500/10 text-slate-300", border: "border-slate-500/20", dot: "bg-slate-400" },
  emerging: { label: "Emerging", chip: "bg-amber-500/10 text-amber-300", border: "border-amber-500/20", dot: "bg-amber-400" },
  probable: { label: "Probable", chip: "bg-orange-500/10 text-orange-300", border: "border-orange-500/20", dot: "bg-orange-400" },
  verified: { label: "Verified", chip: "bg-emerald-500/10 text-emerald-300", border: "border-emerald-500/20", dot: "bg-emerald-400" },
};

function confidenceTier(confidence: string): ConfidenceTier {
  const value = confidence.trim().toLowerCase();
  if (value === "high" || value === "corroborated" || value === "verified") return "verified";
  if (value === "probable" || value === "confirmed") return "probable";
  if (value === "emerging" || value === "low") return "emerging";
  return "raw";
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildAuthHeaders(token: string | null): HeadersInit {
  if (!token) return { "Content-Type": "application/json" };
  return { Authorization: `Token ${token}`, "Content-Type": "application/json" };
}

function formatPinLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

function formatPinLocationName(latitude: number, longitude: number) {
  const nearestHub = resolveNearestHub(latitude, longitude);
  return `${nearestHub.label}, ${nearestHub.state}`;
}

function toBackendCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function isPinAction(value: unknown): value is PinAction {
  return typeof value === "string" && [
    "report_incident",
    "watch_area",
    "watch_zone",
    "mark_hazard",
    "save_location",
    "request_help",
    "add_observation",
  ].includes(value);
}

function toIncidentRecord(payload: Record<string, unknown>): IncidentRecord {
  return {
    id: Number(payload.id ?? Date.now()),
    title: String(payload.title ?? "Untitled incident"),
    incident_type: String(payload.incident_type ?? "suspicious_activity"),
    confidence: String(payload.confidence ?? "emerging"),
    severity: String(payload.severity ?? "medium"),
    status: String(payload.status ?? "unconfirmed"),
    location_name: String(payload.location_name ?? ""),
    latitude: payload.latitude as number | string | null,
    longitude: payload.longitude as number | string | null,
    summary: String(payload.summary ?? ""),
    detected_at: String(payload.detected_at ?? new Date().toISOString()),
    created_at: String(payload.created_at ?? new Date().toISOString()),
    visibility_score:
      typeof payload.visibility_score === "number" ? payload.visibility_score : undefined,
    metadata: (payload.metadata as { location_state?: string } | undefined) ?? undefined,
  };
}

function toWatchZoneRecord(payload: Record<string, unknown>): WatchZoneRecord {
  return {
    id: Number(payload.id ?? Date.now()),
    name: String(payload.name ?? "Untitled watch zone"),
    zone_type: String(payload.zone_type ?? "watch_area"),
    status: String(payload.status ?? "active"),
    current_risk_level: String(payload.current_risk_level ?? "baseline"),
    current_risk_score: payload.current_risk_score as number | string | null,
    centroid_latitude: payload.centroid_latitude as number | string | null,
    centroid_longitude: payload.centroid_longitude as number | string | null,
    metadata: (payload.metadata as { location_state?: string; created_from?: string; pin_action?: string } | undefined) ?? undefined,
  };
}

function toGeofenceRecord(payload: Record<string, unknown>): GeofenceRecord {
  return {
    id: Number(payload.id ?? Date.now()),
    name: String(payload.name ?? "Untitled geofence"),
    geofence_type: String(payload.geofence_type ?? "custom"),
    status: String(payload.status ?? "active"),
    centroid_latitude: payload.centroid_latitude as number | string | null,
    centroid_longitude: payload.centroid_longitude as number | string | null,
    radius_meters: payload.radius_meters as number | string | null,
    description: String(payload.description ?? ""),
    metadata: (payload.metadata as { location_state?: string } | undefined) ?? undefined,
  };
}

function getList<T>(payload: T[] | ApiListResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

async function fetchAllPages<T>(url: string, headers: HeadersInit) {
  const items: T[] = [];
  let nextUrl: string | null = url;
  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });
    if (!response.ok) throw new Error(`Failed to load ${nextUrl}`);
    const payload = (await response.json()) as (ApiListResponse<T> & { next?: string | null }) | T[];
    items.push(...getList(payload));
    nextUrl = Array.isArray(payload) ? null : payload.next ?? null;
  }
  return items;
}

function haversineKm(latA: number, lngA: number, latB: number, lngB: number) {
  const R = 6371;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((latA * Math.PI) / 180) *
      Math.cos((latB * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesDatePreset(
  dateValue: string,
  preset: DatePreset,
  customStart: string,
  customEnd: string,
) {
  if (preset === "all") return true;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "today") return d >= today;
  if (preset === "7d") return d.getTime() >= now.getTime() - 7 * 86400000;
  if (preset === "30d") return d.getTime() >= now.getTime() - 30 * 86400000;
  if (preset === "custom") {
    if (!customStart && !customEnd) return true;
    const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
    const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;
    if (start && d < start) return false;
    if (end && d > end) return false;
  }
  return true;
}

function generatePinId() {
  return `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ level }: { level: string }) {
  const l = level.toLowerCase();
  if (l === "critical")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />Critical
      </span>
    );
  if (l === "high")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />High
      </span>
    );
  if (l === "medium")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Medium
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />Low
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const tier = confidenceTier(confidence);
  const style = CONFIDENCE_STYLE[tier];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${style.chip} ${style.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

// ─── Pin Action Modal ─────────────────────────────────────────────────────────
// Compact: 2-col grid, tight padding, smaller on mobile

function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PinActionModal({
  coordinate,
  onSelect,
  onCancel,
}: {
  coordinate: { latitude: number; longitude: number } | null;
  onSelect: (action: PinAction, radiusMeters?: number) => void;
  onCancel: () => void;
}) {
  const [geofenceRadius, setGeofenceRadius] = useState(500);

  if (!coordinate) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:pb-24">
      {/* Backdrop */}
      <button
        aria-label="Cancel pin drop"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Sheet — max-w tighter, less padding */}
      <div className="relative z-10 w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A1325]/98 shadow-2xl sm:max-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-400">Pin dropped</p>
            <p className="mt-0.5 font-mono text-[9px] text-white/30">
              {coordinate.latitude.toFixed(4)}, {coordinate.longitude.toFixed(4)}
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 2-col action grid */}
        <div className="grid grid-cols-2 gap-1 p-2">
          {PIN_ACTIONS.map((action) => (
            <button
              key={action.key}
              onClick={() =>
                onSelect(action.key, action.key === "watch_zone" ? geofenceRadius : undefined)
              }
              className={`group flex flex-col gap-1 rounded-xl border p-2 text-left transition-all duration-100 active:scale-[0.97] ${action.borderClass} ${action.bgClass}`}
            >
              <span className="text-sm leading-none">{action.emoji}</span>
              <span className={`text-[10px] font-semibold leading-tight ${action.textClass}`}>
                {action.label}
              </span>
              <span className="text-[9px] leading-tight text-white/35">{action.description}</span>

              {/* Geofence radius sub-control */}
              {action.key === "watch_zone" && (
                <div className="mt-0.5 w-full" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-[8px] uppercase tracking-wider text-cyan-400/60">Radius</span>
                    <span className="font-mono text-[8px] text-cyan-300">
                      {geofenceRadius >= 1000
                        ? `${(geofenceRadius / 1000).toFixed(1)}km`
                        : `${geofenceRadius}m`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={5000}
                    step={100}
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                    className="h-0.5 w-full appearance-none rounded-full bg-cyan-500/20 accent-cyan-400"
                  />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pin Detail Panel ─────────────────────────────────────────────────────────

function PinDetailPanel({
  pin,
  onBack,
  onRemove,
}: {
  pin: DroppedPin;
  onBack: () => void;
  onRemove: (id: string) => void;
}) {
  const actionDef = PIN_ACTION_MAP[pin.action];
  const isGeofence = pin.action === "watch_zone";

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-2 text-sm text-white/40 transition hover:text-white/70"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: `${actionDef.color}20`, border: `1px solid ${actionDef.color}40` }}
          >
            {actionDef.emoji}
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: actionDef.color }}>
              {actionDef.label}
            </p>
            <h2 className="mt-0.5 text-sm font-bold text-white">{pin.locationName}</h2>
            <p className="mt-0.5 font-mono text-[10px] text-white/40">{pin.coordinateLabel}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-white/30">Latitude</p>
            <p className="mt-1 font-mono text-xs text-cyan-400">{pin.latitude.toFixed(5)}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-white/30">Longitude</p>
            <p className="mt-1 font-mono text-xs text-cyan-400">{pin.longitude.toFixed(5)}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="text-[9px] uppercase tracking-wider text-white/30">Action Type</p>
          <p className="mt-1 text-sm font-medium text-white">{actionDef.label}</p>
          <p className="mt-0.5 text-xs text-white/40">{actionDef.description}</p>
        </div>

        {isGeofence && pin.radiusMeters && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <p className="text-[9px] uppercase tracking-wider text-cyan-400/60">Geofence Radius</p>
            <p className="mt-1 text-base font-bold text-cyan-400">
              {pin.radiusMeters >= 1000
                ? `${(pin.radiusMeters / 1000).toFixed(1)} km`
                : `${pin.radiusMeters} m`}
            </p>
          </div>
        )}

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="text-[9px] uppercase tracking-wider text-white/30">Dropped</p>
          <p className="mt-1 text-sm text-white/70">{relativeTime(pin.createdAt)}</p>
        </div>

        {pin.note && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <p className="text-[9px] uppercase tracking-wider text-white/30">Note</p>
            <p className="mt-1 text-sm leading-relaxed text-white/60">{pin.note}</p>
          </div>
        )}

        <button
          onClick={() => onRemove(pin.id)}
          className="w-full rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-sm font-medium text-red-400 transition hover:bg-red-500/10"
        >
          Remove this pin
        </button>
      </div>
    </div>
  );
}

// ─── Incident Detail Panel ────────────────────────────────────────────────────

function IncidentDetail({
  incident,
  weatherContext,
  onBack,
}: {
  incident: SelectedIncident;
  weatherContext?: WeatherContext | null;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-2 text-sm text-white/40 transition hover:text-white/70"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
          Back to feed
        </button>
        <SeverityBadge level={incident.severity} />
        <div className="mt-2">
          <ConfidenceBadge confidence={incident.confidence} />
        </div>
        <h2 className="mt-2.5 text-lg font-bold leading-snug text-white">{incident.title}</h2>
        <p className="mt-1 text-sm text-white/40">{incident.locationName || "Unknown location"}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "Type", value: formatReportType(incident.incidentType) },
            { label: "Status", value: incident.status },
            { label: "Confidence", value: confidenceTier(incident.confidence) },
            {
              label: "Detected",
              value: incident.detectedAt
                ? new Date(incident.detectedAt).toLocaleDateString()
                : "Unknown",
            },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
              <p className="text-[9px] uppercase tracking-wider text-white/30">{label}</p>
              <p className="mt-1 text-sm font-medium capitalize text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="text-[9px] uppercase tracking-wider text-white/30">Coordinates</p>
          <p className="mt-1 font-mono text-sm text-cyan-400">
            {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="mb-1.5 text-[9px] uppercase tracking-wider text-white/30">Summary</p>
          <p className="text-sm leading-relaxed text-white/60">
            {incident.summary || "No incident summary available."}
          </p>
        </div>

        {weatherContext && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <p className="text-[9px] uppercase tracking-wider text-cyan-400/60">Weather Context</p>
            <h3 className="mt-1 text-sm font-semibold text-white">{weatherContext.label}</h3>
            <p className="mt-1 text-xs leading-relaxed text-white/60">{weatherContext.summary}</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/[0.06] bg-[#0A1020]/80 p-2">
                <p className="text-[9px] uppercase tracking-wider text-white/30">Rainfall</p>
                <p className="mt-1 text-xs font-semibold text-cyan-300">{weatherContext.rainfallIntensity}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-[#0A1020]/80 p-2">
                <p className="text-[9px] uppercase tracking-wider text-white/30">Visibility</p>
                <p className="mt-1 text-xs font-semibold text-cyan-300">{weatherContext.visibility}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  subtext,
  variant = "default",
}: {
  label: string;
  value: string;
  subtext: string;
  variant?: "default" | "danger" | "warning" | "success";
}) {
  const cls = {
    default: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
    danger: "text-red-400 border-red-500/20 bg-red-500/5",
    warning: "text-amber-400 border-amber-500/20 bg-amber-500/5",
    success: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  }[variant];

  return (
    <div className={`rounded-lg border px-2 py-1.5 sm:rounded-xl sm:p-3 ${cls}`}>
      <p className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.14em] text-current opacity-60">
        {label}
      </p>
      <p className="mt-0.5 text-sm sm:mt-1 sm:text-2xl font-bold text-current tabular-nums">{value}</p>
      <p className="mt-0.5 line-clamp-1 text-[9px] sm:mt-1 sm:line-clamp-2 sm:text-[11px] leading-relaxed text-white/50">
        {subtext}
      </p>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({
  onMenuOpen,
  locationLabel,
  alertCount,
  droppedPinCount,
}: {
  onMenuOpen: () => void;
  locationLabel: string;
  alertCount: number;
  droppedPinCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0A1020]/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={onMenuOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#4cd7f6]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-400">Live Monitor</span>
        </div>

        <p className="truncate text-sm text-white/80">{locationLabel}</p>
      </div>

      <div className="flex items-center gap-2.5">
        {droppedPinCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5">
            <span className="text-[10px] text-violet-400">📍</span>
            <span className="font-mono text-[10px] font-semibold text-violet-400">
              {droppedPinCount} pin{droppedPinCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118.6 14.6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 10-3 0v.68C7.63 5.36 6 7.92 6 11v3.6c0 .53-.21 1.04-.595 1.415L4 17h5" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          {alertCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-400" />
          )}
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 sm:flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-500/20 ring-1 ring-cyan-400/30">
            <span className="text-[10px] font-semibold text-cyan-300">VT</span>
          </div>
          <div>
            <p className="text-sm font-medium leading-none text-white">V. Thorne</p>
            <p className="mt-0.5 text-[10px] text-cyan-400/70">Senior Operator</p>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Dropped Pins List ────────────────────────────────────────────────────────

function DroppedPinsList({
  pins,
  onSelect,
  onRemove,
}: {
  pins: DroppedPin[];
  onSelect: (pin: DroppedPin) => void;
  onRemove: (id: string) => void;
}) {
  if (pins.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 text-center">
        <p className="text-sm text-white/30">No pins dropped yet.</p>
        <p className="mt-1 text-xs text-white/20">Use the Drop Pin button on the map to add intelligence anchors.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pins.map((pin) => {
        const def = PIN_ACTION_MAP[pin.action];
        return (
          <div
            key={pin.id}
            onClick={() => onSelect(pin)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(pin); }
            }}
            className="group w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 text-base leading-none">{def.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${def.textClass}`}>
                    {def.label}
                  </p>
                  {pin.action === "watch_zone" && pin.radiusMeters && (
                    <span className="rounded-full bg-cyan-500/10 px-1.5 py-0.5 text-[9px] text-cyan-400">
                      {pin.radiusMeters >= 1000
                        ? `${(pin.radiusMeters / 1000).toFixed(1)}km`
                        : `${pin.radiusMeters}m`}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-white/28">
                  {pin.locationName}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-white/40">
                  {pin.coordinateLabel}
                </p>
                <p className="mt-0.5 text-[10px] text-white/25">{relativeTime(pin.createdAt)}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(pin.id); }}
                className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white/20 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  scopedCount,
  activeRadiusKm,
  datePreset,
  setDatePreset,
  selectedReportType,
  setSelectedReportType,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  layerVisibility,
  toggleLayer,
  reportTypeOptions,
}: {
  scopedCount: number;
  activeRadiusKm: number | null;
  datePreset: DatePreset;
  setDatePreset: (v: DatePreset) => void;
  selectedReportType: string;
  setSelectedReportType: (v: string) => void;
  customStartDate: string;
  setCustomStartDate: (v: string) => void;
  customEndDate: string;
  setCustomEndDate: (v: string) => void;
  layerVisibility: Record<LayerFilterKey, boolean>;
  toggleLayer: (k: LayerFilterKey) => void;
  reportTypeOptions: string[];
}) {
  const dateLabel =
    datePreset === "all" ? "All time"
    : datePreset === "today" ? "Today"
    : datePreset === "7d" ? "Last 7d"
    : datePreset === "30d" ? "Last 30d"
    : "Custom";

  return (
    <div className="grid gap-3">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="mt-1 text-sm font-medium capitalize text-white">{selectedReportType === "all" ? "All reports" : formatReportType(selectedReportType)}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">Active Filter</p>
          <p className="mt-1.5 text-sm font-semibold text-white">{scopedCount} incident{scopedCount === 1 ? "" : "s"}{activeRadiusKm ? ` within ~${activeRadiusKm}km` : ""}</p>
        </div>
        <div className="mt-3">
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400">{dateLabel}</span>
        </div>
      </div>

      <label className="grid gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Report Type</span>
        <select value={selectedReportType} onChange={(e) => setSelectedReportType(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60">
          <option value="all">All report types</option>
          {reportTypeOptions.map((rt) => (
            <option key={rt} value={rt}>{formatReportType(rt)}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Time Window</span>
        <select value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)} className="w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60">
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>
      </label>

      {datePreset === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">Start</span>
            <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60" />
          </label>
          <label className="grid gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">End</span>
            <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/60" />
          </label>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-400">Map Layers</p>
        <div className="mt-3 grid gap-2">
          {[
            { key: "incidents" as const, label: "Incidents", desc: "Show incident markers" },
            { key: "heatmaps" as const, label: "Heatmaps", desc: "Clustering patterns" },
            { key: "riskZones" as const, label: "Risk Zones", desc: "AI-generated threat areas" },
            { key: "geofencing" as const, label: "Geofencing", desc: "Virtual boundaries" },
            { key: "weather" as const, label: "Weather", desc: "Rain, flood and visibility" },
          ].map((layer) => (
            <label key={layer.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0A1020]/60 px-3 py-2.5">
              <input type="checkbox" checked={layerVisibility[layer.key]} onChange={() => toggleLayer(layer.key)} className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#0A1020] accent-cyan-400" />
              <span>
                <span className="block text-sm font-medium text-white">{layer.label}</span>
                <span className="mt-0.5 block text-xs text-white/40">{layer.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Right Panel Tab Nav ──────────────────────────────────────────────────────
// Feed · Filter · (dynamic: Incident | Pin)

type PanelTab = "feed" | "filter";

function RightPanelNav({
  activeTab,
  onTabChange,
  feedLabel,
}: {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  feedLabel: string;
}) {
  return (
    <div className="flex items-center gap-0.5 border-b border-white/[0.06] px-2 pt-2">
      {(
        [
          { key: "feed" as PanelTab, label: feedLabel },
          { key: "filter" as PanelTab, label: "Filters" },
        ]
      ).map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`relative flex-1 rounded-t-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${
            activeTab === tab.key
              ? "text-cyan-400"
              : "text-white/30 hover:text-white/60"
          }`}
        >
          {tab.label}
          {activeTab === tab.key && (
            <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-cyan-400" />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Mobile Bottom Sheet ──────────────────────────────────────────────────────

function MobileBottomSheet({
  rightMode,
  activeTab,
  onTabChange,
  selectedIncident,
  selectedIncidentWeather,
  selectedPin,
  onBack,
  onRemovePin,
  filterContent,
  feedContent,
}: {
  rightMode: RightMode;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  selectedIncident: SelectedIncident | null;
  selectedIncidentWeather: WeatherContext | null;
  selectedPin: DroppedPin | null;
  onBack: () => void;
  onRemovePin: (id: string) => void;
  filterContent: React.ReactNode;
  feedContent: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [rightMode]);

  // In incident/pin mode show the detail panels directly
  const isDetail = rightMode === "incident" || rightMode === "pin_detail";

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[100] lg:hidden transition-all duration-300 ${
        expanded ? "h-[68vh]" : "h-auto max-h-[42vh]"
      }`}
    >
      <div className="flex h-full flex-col rounded-t-2xl border-t border-white/[0.08] bg-[#0A1325]/96 backdrop-blur-xl">
        {/* Drag handle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full flex-col items-center py-2.5 text-white/40"
          aria-label={expanded ? "Collapse panel" : "Expand panel"}
        >
          <div className="h-1 w-10 rounded-full bg-white/20" />
          <svg
            className={`mt-1 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>

        {/* Tab nav — only when not in detail mode */}
        {!isDetail && (
          <RightPanelNav
            activeTab={activeTab}
            onTabChange={onTabChange}
            feedLabel="Feed"
          />
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 pt-3">
          {rightMode === "incident" && selectedIncident ? (
            <IncidentDetail incident={selectedIncident} weatherContext={selectedIncidentWeather} onBack={onBack} />
          ) : rightMode === "pin_detail" && selectedPin ? (
            <PinDetailPanel pin={selectedPin} onBack={onBack} onRemove={onRemovePin} />
          ) : activeTab === "filter" ? (
            filterContent
          ) : (
            feedContent
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LiveIntelligencePage() {
  const role = getCurrentRole();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStreet, setSelectedStreet] = useState("");
  const [zoom, setZoom] = useState(3);
  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/dark-v11");
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapHoverPreview, setMapHoverPreview] = useState<MapHoverPreview | null>(null);
  const [mapHoverLabel, setMapHoverLabel] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [exactPin, setExactPin] = useState<ExactPin | null>(null);

  // Data
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [watchZones, setWatchZones] = useState<WatchZoneRecord[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [weatherIntel, setWeatherIntel] = useState<WeatherIntelligenceResponse | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(true);

  // Selection
  const [selectedIncident, setSelectedIncident] = useState<SelectedIncident | null>(null);
  const [rightMode, setRightMode] = useState<RightMode>("controls");
  const hoverPreviewRequestRef = useRef(0);

  useEffect(() => {
    if (!mapHoverPreview) {
      setMapHoverLabel(null);
      return;
    }

    const requestId = ++hoverPreviewRequestRef.current;
    const fallback = resolveNearestHub(mapHoverPreview.latitude, mapHoverPreview.longitude);
    setMapHoverLabel(`${fallback.label}, ${fallback.state}`);

    const timer = window.setTimeout(() => {
      reverseGeocodeLocation(mapHoverPreview.latitude, mapHoverPreview.longitude)
        .then((result) => {
          if (hoverPreviewRequestRef.current !== requestId) return;
          const label = result.label.trim();
          setMapHoverLabel(label || `${fallback.label}, ${fallback.state}`);
        })
        .catch(() => {
          if (hoverPreviewRequestRef.current === requestId) {
            setMapHoverLabel(`${fallback.label}, ${fallback.state}`);
          }
        });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [mapHoverPreview]);

  // Panel tab (feed / filter) — shared between desktop sidebar and mobile sheet
  const [panelTab, setPanelTab] = useState<PanelTab>("feed");

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedReportType, setSelectedReportType] = useState("all");
  const [layerVisibility, setLayerVisibility] = useState<Record<LayerFilterKey, boolean>>({
    incidents: true,
    heatmaps: true,
    riskZones: true,
    geofencing: true,
    weather: true,
  });

  // Drop pin system
  const [dropPinMode, setDropPinMode] = useState(false);
  const [pendingCoordinate, setPendingCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [droppedPins, setDroppedPins] = useState<DroppedPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<DroppedPin | null>(null);

  // ── Auth & Data ────────────────────────────────────────────────────────────

  function handleLogout() {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }

  function handleMenuOpen() {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobilePanelOpen(true);
      return;
    }
    setSidebarOpen(true);
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAuthToken(window.localStorage.getItem("geopulse.token"));
    setAuthReady(true);
  }, []);

  useEffect(() => {
    if (!authReady || !authToken) { setLoadingIntel(false); return; }
    let active = true;
    const headers = { Authorization: `Token ${authToken}` };

    async function loadIntel() {
      setLoadingIntel(true);
      try {
        const [incidentItems, watchZoneItems, geofenceItems, alertItems] = await Promise.all([
          fetchAllPages<IncidentRecord>(`${API_BASE_URL}/incidents/`, headers),
          fetchAllPages<WatchZoneRecord>(`${API_BASE_URL}/watch-zones/`, headers),
          fetchAllPages<GeofenceRecord>(`${API_BASE_URL}/geofences/?status=active`, headers),
          fetchAllPages<Record<string, unknown>>(`${API_BASE_URL}/alerts/`, headers),
        ]);
        if (!active) return;

        setIncidents(incidentItems);
        setWatchZones(watchZoneItems);
        const userGeofences = geofenceItems.filter((g) => {
          const md = g.metadata ?? {};
          return !md.import_dataset && !md.imported && !md.demo && !md.source;
        });
        setGeofences(userGeofences);

        const mappedAlerts = alertItems.map((a, idx: number) => {
          const sev = String(a.severity ?? "info").toLowerCase();
          return {
            id: Number(a.id ?? idx + 1),
            level: sev === "critical" ? "Critical" : sev === "high" ? "Warning" : "Info",
            time: relativeTime(String(a.triggered_at ?? "")),
            triggeredAt: String(a.triggered_at ?? ""),
            title: String(a.title ?? "Operational alert"),
            body: String(a.message ?? "No message provided."),
            meta: String(a.status ?? "ACTIVE").toUpperCase(),
          };
        });
        setAlerts(mappedAlerts);
      } catch {
        // ignore
      } finally {
        if (active) setLoadingIntel(false);
      }
    }

    void loadIntel();
    return () => { active = false; };
  }, [authReady, authToken]);

  // ── Derived data ──────────────────────────────────────────────────────────

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
          visibilityScore: typeof inc.visibility_score === "number" ? inc.visibility_score : undefined,
          locationState: inc.metadata?.location_state,
        }];
      }),
    [incidents],
  );

  const activeRadiusKm = useMemo(() => {
    if (selectedStreet || droppedPins.length > 0) return 10;
    if (selectedCity) return 25;
    return null;
  }, [droppedPins.length, selectedCity, selectedStreet]);

  const scopedIncidentPoints = useMemo(() => {
    return incidentPoints.filter((inc) => {
      if (!matchesDatePreset(inc.detectedAt, datePreset, customStartDate, customEndDate)) return false;
      if (selectedReportType !== "all" && inc.incidentType !== selectedReportType) return false;
      if (selectedState) {
        const st = (inc.locationState || stateForCoordinates(inc.latitude, inc.longitude)).trim();
        if (st !== selectedState) return false;
      }
      if (!mapFocus || activeRadiusKm === null) return true;
      return haversineKm(inc.latitude, inc.longitude, mapFocus.latitude, mapFocus.longitude) <= activeRadiusKm;
    });
  }, [activeRadiusKm, customEndDate, customStartDate, datePreset, incidentPoints, mapFocus, selectedReportType, selectedState]);

  const watchZonePoints = useMemo(
    () =>
      watchZones.flatMap((z) => {
        const lat = toNumber(z.centroid_latitude);
        const lng = toNumber(z.centroid_longitude);
        if (lat === null || lng === null) return [];
        return [{ id: z.id, name: z.name, riskLevel: z.current_risk_level, riskScore: toNumber(z.current_risk_score) ?? 0, latitude: lat, longitude: lng, locationState: z.metadata?.location_state }];
      }),
    [watchZones],
  );

  const incidentWeatherContexts = useMemo(
    () => mapIncidentWeatherContexts(weatherIntel?.incidentContexts ?? []),
    [weatherIntel],
  );

  const riskZoneAdjustments = useMemo(
    () => mapRiskZoneAdjustments(weatherIntel?.riskZoneAdjustments ?? []),
    [weatherIntel],
  );

  const weatherOverlayPoints = useMemo(
    () => weatherIntel?.overlay ?? [],
    [weatherIntel],
  );

  const weatherAlertItems = useMemo(
    () =>
      (weatherIntel?.alerts ?? []).map((alert, index) => ({
        id: Number(`${index + 1}${Math.round(alert.latitude * 1000)}${Math.round(alert.longitude * 1000)}`),
        level: alert.severity === "extreme" ? "Critical" : alert.severity === "high" ? "Warning" : "Info",
        time: "Now",
        triggeredAt: weatherIntel?.fetchedAt ?? new Date().toISOString(),
        title: alert.title || `${weatherSeverityLabel(alert.severity)} weather alert`,
        body: alert.summary,
        meta: "WEATHER",
      })),
    [weatherIntel],
  );

  const weatherAdjustedWatchZonePoints = useMemo(
    () =>
      watchZonePoints.map((zone) => {
        const adjustment = riskZoneAdjustments.get(String(zone.id));
        if (!adjustment) return zone;
        return {
          ...zone,
          riskLevel: adjustment.weatherAdjustedRiskLevel,
          riskScore: adjustment.weatherAdjustedRiskScore,
        };
      }),
    [riskZoneAdjustments, watchZonePoints],
  );

  const scopedWatchZonePoints = useMemo(() =>
    weatherAdjustedWatchZonePoints.filter((z) => {
      if (selectedState) {
        const st = (z.locationState || stateForCoordinates(z.latitude, z.longitude)).trim();
        if (st !== selectedState) return false;
      }
      if (!mapFocus || activeRadiusKm === null) return true;
      return haversineKm(z.latitude, z.longitude, mapFocus.latitude, mapFocus.longitude) <= activeRadiusKm;
    }),
    [activeRadiusKm, mapFocus, selectedState, weatherAdjustedWatchZonePoints],
  );

  const geofencePoints = useMemo(
    () =>
      geofences.flatMap((g) => {
        const lat = toNumber(g.centroid_latitude);
        const lng = toNumber(g.centroid_longitude);
        if (lat === null || lng === null) return [];
        return [{ id: g.id, name: g.name, geofenceType: g.geofence_type, status: g.status, description: g.description, radiusMeters: toNumber(g.radius_meters) ?? 0, latitude: lat, longitude: lng, locationState: g.metadata?.location_state }];
      }),
    [geofences],
  );

  const scopedGeofencePoints = useMemo(() =>
    geofencePoints.filter((g) => {
      if (selectedState) {
        const st = (g.locationState || stateForCoordinates(g.latitude, g.longitude)).trim();
        if (st !== selectedState) return false;
      }
      if (!mapFocus || activeRadiusKm === null) return true;
      return haversineKm(g.latitude, g.longitude, mapFocus.latitude, mapFocus.longitude) <= activeRadiusKm;
    }),
    [activeRadiusKm, geofencePoints, mapFocus, selectedState],
  );

  useEffect(() => {
    if (!authReady || !authToken) {
      setWeatherIntel(null);
      return;
    }

    const headers = buildAuthHeaders(authToken);
    const pointPayload = scopedIncidentPoints.slice(0, 24).map((incident) => ({
      id: `incident-${incident.id}`,
      latitude: incident.latitude,
      longitude: incident.longitude,
      label: incident.title,
      kind: "incident",
      incident_type: incident.incidentType,
      severity: incident.severity,
      summary: incident.summary,
      location_name: incident.locationName,
    }));
    const zonePayload = watchZonePoints
      .filter((zone) => {
        if (selectedState) {
          const stateName = (zone.locationState || stateForCoordinates(zone.latitude, zone.longitude)).trim();
          if (stateName !== selectedState) return false;
        }
        if (!mapFocus || activeRadiusKm === null) return true;
        return haversineKm(zone.latitude, zone.longitude, mapFocus.latitude, mapFocus.longitude) <= activeRadiusKm;
      })
      .slice(0, 24)
      .map((zone) => ({
        id: String(zone.id),
        name: zone.name,
        latitude: zone.latitude,
        longitude: zone.longitude,
        risk_level: zone.riskLevel,
        risk_score: zone.riskScore,
      }));

    if (pointPayload.length === 0 && zonePayload.length === 0) {
      setWeatherIntel(null);
      return;
    }

    let active = true;
    async function loadWeather() {
      try {
        const response = await fetch(`${API_BASE_URL}/weather-intelligence/`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            points: pointPayload,
            watch_zones: zonePayload,
          }),
        });
        if (!response.ok || !active) return;
        const payload = await response.json();
        if (!active) return;
        setWeatherIntel(toWeatherIntelligenceResponse(payload));
      } catch {
        if (active) setWeatherIntel(null);
      }
    }

    void loadWeather();
    return () => {
      active = false;
    };
  }, [
    activeRadiusKm,
    authReady,
    authToken,
    mapFocus,
    scopedIncidentPoints,
    selectedState,
    watchZonePoints,
  ]);

  const droppedGeofencePins = useMemo(
    () =>
      droppedPins
        .filter((p) => p.action === "watch_zone")
        .map((p) => ({
          id: p.id as unknown as number,
          name: p.label,
          geofenceType: "watch_zone",
          status: "active",
          description: "User-dropped watch area",
          radiusMeters: p.radiusMeters ?? 500,
          latitude: p.latitude,
          longitude: p.longitude,
          locationState: "",
          isUserDropped: true,
          pinColor: p.color,
        })),
    [droppedPins],
  );

  const persistedIncidentPins = useMemo(
    () =>
      incidents.flatMap((incident) => {
        const actionValue = incident.metadata?.pin_action;
        const createdFrom = incident.metadata?.created_from;
        const latitude = toNumber(incident.latitude);
        const longitude = toNumber(incident.longitude);
        if (!createdFrom || !isPinAction(actionValue) || latitude === null || longitude === null) {
          return [];
        }
        const action = actionValue === "watch_area" ? "watch_zone" : actionValue;
        const pinConfig = PIN_ACTION_MAP[action];
        return [{
          id: `incident-pin-${incident.id}`,
          latitude,
          longitude,
          label: incident.title || `${pinConfig.label} · ${formatPinLocationName(latitude, longitude)}`,
          locationName: formatPinLocationName(latitude, longitude),
          coordinateLabel: formatPinLabel(latitude, longitude),
          action,
          note: incident.summary || undefined,
          createdAt: incident.detected_at || incident.created_at || new Date().toISOString(),
          color: pinConfig.color,
          persisted: true,
        } satisfies DroppedPin];
      }),
    [incidents],
  );

  const persistedGeofencePins = useMemo(
    () =>
      geofences.flatMap((geofence) => {
        const actionValue = geofence.metadata?.pin_action;
        const createdFrom = geofence.metadata?.created_from;
        const latitude = toNumber(geofence.centroid_latitude);
        const longitude = toNumber(geofence.centroid_longitude);
        if (!createdFrom || !isPinAction(actionValue) || latitude === null || longitude === null) {
          return [];
        }
        const action = actionValue === "watch_area" ? "watch_zone" : actionValue;
        const pinConfig = PIN_ACTION_MAP[action];
        return [{
          id: `geofence-pin-${geofence.id}`,
          latitude,
          longitude,
          label: geofence.name || `${pinConfig.label} · ${formatPinLocationName(latitude, longitude)}`,
          locationName: formatPinLocationName(latitude, longitude),
          coordinateLabel: formatPinLabel(latitude, longitude),
          action,
          note: geofence.description || undefined,
          radiusMeters: toNumber(geofence.radius_meters) ?? undefined,
          createdAt: String((geofence.metadata?.created_at as string | undefined) ?? new Date().toISOString()),
          color: pinConfig.color,
          persisted: true,
        } satisfies DroppedPin];
      }),
    [geofences],
  );

  const combinedDroppedPins = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...droppedPins, ...persistedIncidentPins, ...persistedGeofencePins];
    return combined.filter((pin) => {
      const key = `${pin.action}|${pin.latitude.toFixed(6)}|${pin.longitude.toFixed(6)}|${pin.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [droppedPins, persistedGeofencePins, persistedIncidentPins]);

  const allGeofencePoints = useMemo(
    () => [...scopedGeofencePoints, ...droppedGeofencePins],
    [scopedGeofencePoints, droppedGeofencePins],
  );

  const reportTypeOptions = useMemo(() => [...REPORT_TYPE_VALUES], []);

  const emphasizeRecentIncidents = useMemo(() => {
    if (datePreset !== "custom") return true;
    if (!customEndDate) return true;
    const end = new Date(`${customEndDate}T23:59:59`);
    if (isNaN(end.getTime())) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end >= today;
  }, [customEndDate, datePreset]);

  const handlePinActionSelect = useCallback(
    async (
      action: PinAction,
      pin: { latitude: number; longitude: number; label: string },
      actionPayload?: PinActionPayload,
    ) => {
      const normalizedAction = action === "watch_area" ? "watch_zone" : action;
      const apiLatitude = toBackendCoordinate(pin.latitude);
      const apiLongitude = toBackendCoordinate(pin.longitude);
      const coordinateLabel = formatPinLabel(apiLatitude, apiLongitude);

      if (normalizedAction === "report_incident") {
        const query = new URLSearchParams({
          lat: apiLatitude.toFixed(6),
          lng: apiLongitude.toFixed(6),
          label: coordinateLabel,
        });
        router.push(`/dashboard/incident-reports?${query.toString()}`);
        return;
      }

      const def = PIN_ACTION_MAP[normalizedAction];
      const newPin: DroppedPin = {
        id: generatePinId(),
        latitude: pin.latitude,
        longitude: pin.longitude,
        label: `${def.label} · ${formatPinLocationName(pin.latitude, pin.longitude)}`,
        locationName: formatPinLocationName(pin.latitude, pin.longitude),
        coordinateLabel: formatPinLabel(pin.latitude, pin.longitude),
        action: normalizedAction,
        radiusMeters: normalizedAction === "watch_zone" ? 500 : normalizedAction === "save_location" ? 100 : undefined,
        createdAt: new Date().toISOString(),
        color: def.color,
      };

      try {
        if (normalizedAction === "watch_zone") {
          if (!authToken) throw new Error("You need to sign in before creating a watch area.");
          const response = await fetch(`${API_BASE_URL}/watch-zones/`, {
            method: "POST",
            headers: buildAuthHeaders(authToken),
            body: JSON.stringify({
              name: formatPinLocationName(pin.latitude, pin.longitude),
              status: "active",
              zone_type: "watch_area",
              current_risk_level: "baseline",
              current_risk_score: 0,
              centroid_latitude: apiLatitude,
              centroid_longitude: apiLongitude,
              boundary: {},
              notes: `Created from a dropped pin in live intelligence at ${formatPinLabel(pin.latitude, pin.longitude)}.`,
              metadata: { created_from: "live_intelligence_pin", pin_action: normalizedAction, radius_meters: 500 },
            }),
          });
          if (!response.ok) { const t = await response.text(); throw new Error(t || "Unable to create the watch area right now."); }
          const responsePayload = (await response.json()) as Record<string, unknown>;
          setWatchZones((prev) => [toWatchZoneRecord(responsePayload), ...prev]);
        }

        if (normalizedAction === "mark_hazard") {
          if (!authToken) throw new Error("You need to sign in before marking a hazard.");
          const response = await fetch(`${API_BASE_URL}/incidents/`, {
            method: "POST",
            headers: buildAuthHeaders(authToken),
            body: JSON.stringify({
              title: `Marked hazard · ${formatPinLabel(pin.latitude, pin.longitude)}`,
              incident_type: actionPayload?.hazardType ?? "road_obstruction",
              confidence: "emerging",
              severity: "medium",
              status: "unconfirmed",
              location_name: `Near ${formatPinLabel(pin.latitude, pin.longitude)}`,
              latitude: apiLatitude,
              longitude: apiLongitude,
              summary: `Created from a dropped ${(actionPayload?.hazardType ?? "road_obstruction").replace(/_/g, " ")} pin in live intelligence.`,
              metadata: {
                created_from: "live_intelligence_pin",
                pin_action: normalizedAction,
                hazard_type: actionPayload?.hazardType ?? "road_obstruction",
              },
            }),
          });
          if (!response.ok) throw new Error("Unable to create the hazard report right now.");
          const responsePayload = (await response.json()) as Record<string, unknown>;
          setIncidents((prev) => [toIncidentRecord(responsePayload), ...prev]);
        }

        if (normalizedAction === "save_location") {
          if (!authToken) throw new Error("You need to sign in before saving a location.");
          const response = await fetch(`${API_BASE_URL}/geofences/`, {
            method: "POST",
            headers: buildAuthHeaders(authToken),
            body: JSON.stringify({
              name: `Saved location - ${coordinateLabel}`,
              geofence_type: "custom",
              status: "active",
              centroid_latitude: apiLatitude,
              centroid_longitude: apiLongitude,
              radius_meters: 100,
              description: "Saved from a dropped pin in live intelligence.",
              notify_on_signal: false,
              notify_on_incident: false,
              metadata: {
                created_from: "live_intelligence_pin",
                pin_action: normalizedAction,
                saved_location: true,
              },
            }),
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Unable to save this location right now.");
          }
          const responsePayload = (await response.json()) as Record<string, unknown>;
          setGeofences((prev) => [toGeofenceRecord(responsePayload), ...prev]);
        }

        if (normalizedAction === "request_help" || normalizedAction === "add_observation") {
          if (!authToken) {
            throw new Error(
              normalizedAction === "request_help"
                ? "You need to sign in before requesting help."
                : "You need to sign in before adding an observation.",
            );
          }
          const response = await fetch(`${API_BASE_URL}/incidents/`, {
            method: "POST",
            headers: buildAuthHeaders(authToken),
            body: JSON.stringify(
              normalizedAction === "request_help"
                ? {
                    title: `Help request - ${coordinateLabel}`,
                    incident_type: actionPayload?.helpType === "security" ? "suspicious_activity" : "medical_emergency",
                    confidence: "emerging",
                    severity: "high",
                    status: "unconfirmed",
                    location_name: `Near ${coordinateLabel}`,
                    latitude: apiLatitude,
                    longitude: apiLongitude,
                    summary: `${(actionPayload?.helpType ?? "medical_emergency").replace(/_/g, " ")} requested from a dropped pin in live intelligence.`,
                    metadata: {
                      created_from: "live_intelligence_pin",
                      pin_action: normalizedAction,
                      requires_support: true,
                      help_type: actionPayload?.helpType ?? "medical_emergency",
                    },
                  }
                : {
                    title: `Observation - ${coordinateLabel}`,
                    incident_type: "suspicious_activity",
                    confidence: "raw",
                    severity: "low",
                    status: "unconfirmed",
                    location_name: `Near ${coordinateLabel}`,
                    latitude: apiLatitude,
                    longitude: apiLongitude,
                    summary: actionPayload?.observationText?.trim() || "Field observation created from a dropped pin in live intelligence.",
                    metadata: {
                      created_from: "live_intelligence_pin",
                      pin_action: normalizedAction,
                      observation_only: true,
                      observation_text: actionPayload?.observationText?.trim() || "",
                    },
                  },
            ),
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(
              text ||
                (normalizedAction === "request_help"
                  ? "Unable to request help right now."
                  : "Unable to save the observation right now."),
            );
          }
          const responsePayload = (await response.json()) as Record<string, unknown>;
          setIncidents((prev) => [toIncidentRecord(responsePayload), ...prev]);
        }

        setDroppedPins((prev) => [...prev, newPin]);
        setSelectedPin(newPin);
        setRightMode("pin_detail");
      } catch (error) {
        console.error(error);
        setDroppedPins((prev) => [...prev, newPin]);
        setSelectedPin(newPin);
        setRightMode("pin_detail");
      }
    },
    [authToken, router],
  );

  const handleRemovePin = useCallback((id: string) => {
    setDroppedPins((prev) => prev.filter((p) => p.id !== id));
    if (selectedPin?.id === id) { setSelectedPin(null); setRightMode("controls"); }
  }, [selectedPin]);

  // ── Deep link ─────────────────────────────────────────────────────────────

  const deepLinkedIncident = useMemo(() => {
    const param = searchParams.get("incident");
    if (!param) return null;
    const id = Number(param);
    if (!isFinite(id)) return null;
    return scopedIncidentPoints.find((inc) => inc.id === id) ?? null;
  }, [scopedIncidentPoints, searchParams]);

  const resolvedSelectedIncident =
    (rightMode === "incident" ? selectedIncident : null) ?? deepLinkedIncident;
  const resolvedSelectedIncidentWeather = useMemo(
    () =>
      resolvedSelectedIncident
        ? incidentWeatherContexts.get(`incident-${resolvedSelectedIncident.id}`) ?? null
        : null,
    [incidentWeatherContexts, resolvedSelectedIncident],
  );
  const resolvedRightMode: RightMode =
    !selectedIncident && deepLinkedIncident ? "incident" : rightMode;

  // ── Metrics ───────────────────────────────────────────────────────────────

  const alertCount = alerts.filter((a) => a.level !== "Info").length;
  const activeThreatCount = scopedIncidentPoints.filter(
    (i) => i.severity === "high" || i.severity === "critical",
  ).length;

  const metrics = [
    {
      label: "Live Reports",
      value: String(scopedIncidentPoints.length),
      subtext: loadingIntel ? "Loading..." : `${activeThreatCount} high-severity`,
      variant: activeThreatCount > 0 ? "danger" : "default",
    },
    {
      label: "Watch Zones",
      value: String(scopedWatchZonePoints.length),
      subtext: `${scopedWatchZonePoints.filter((z) => z.riskLevel === "high" || z.riskLevel === "critical").length} elevated`,
      variant: scopedWatchZonePoints.length > 0 ? "warning" : "default",
    },
    {
      label: "Alerts",
      value: String(alerts.length),
      subtext: `${alertCount} require attention`,
      variant: alertCount > 0 ? "warning" : "default",
    },
    {
      label: "Pins",
      value: String(combinedDroppedPins.length),
      subtext: combinedDroppedPins.length > 0
        ? `${combinedDroppedPins.filter((p) => p.action === "watch_zone").length} geofenced`
        : "Drop pins to track locations",
      variant: combinedDroppedPins.length > 0 ? "success" : "default",
    },
  ] as const;

  // ── Location label ────────────────────────────────────────────────────────

  const locationLabel = useMemo(() => {
    const parts = [selectedState, selectedCity, selectedStreet].filter(Boolean);
    if (parts.length > 0) return parts.join(" › ");
    if (mapFocus) return `${mapFocus.latitude.toFixed(4)}, ${mapFocus.longitude.toFixed(4)}`;
    return selectedState || "Nigeria";
  }, [mapFocus, selectedCity, selectedState, selectedStreet]);

  // ── Shared panel content ──────────────────────────────────────────────────

  const filterPanelContent = (
    <FilterPanel
      scopedCount={scopedIncidentPoints.length}
      activeRadiusKm={activeRadiusKm}
      datePreset={datePreset}
      setDatePreset={setDatePreset}
      selectedReportType={selectedReportType}
      setSelectedReportType={setSelectedReportType}
      customStartDate={customStartDate}
      setCustomStartDate={setCustomStartDate}
      customEndDate={customEndDate}
      setCustomEndDate={setCustomEndDate}
      layerVisibility={layerVisibility}
      toggleLayer={(k) => setLayerVisibility((prev) => ({ ...prev, [k]: !prev[k] }))}
      reportTypeOptions={reportTypeOptions}
    />
  );

  const feedPanelContent = (
    <>
      {combinedDroppedPins.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-violet-400">Dropped Pins</p>
          <DroppedPinsList
            pins={combinedDroppedPins}
            onSelect={(pin) => { setSelectedPin(pin); setRightMode("pin_detail"); }}
            onRemove={handleRemovePin}
          />
        </div>
      )}

      {weatherAlertItems.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-400">Flood / Weather Alerts</p>
          <div className="space-y-2">
            {weatherAlertItems.slice(0, 3).map((alert) => (
              <div key={alert.id} className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{alert.title}</p>
                  <span className="text-[10px] text-cyan-300/70">{alert.meta}</span>
                </div>
                <p className="mt-1 text-xs text-white/45">{alert.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-400">Recent Alerts</p>
          <div className="space-y-2">
            {alerts.slice(0, 4).map((alert) => (
              <div key={alert.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{alert.title}</p>
                  <span className="text-[10px] text-white/30">{alert.time}</span>
                </div>
                <p className="mt-1 text-xs text-white/45">{alert.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {combinedDroppedPins.length === 0 && weatherAlertItems.length === 0 && alerts.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-white/30">No active alerts.</p>
          <p className="mt-1 text-xs text-white/20">Data will appear here as incidents are detected.</p>
        </div>
      )}
    </>
  );

  if (!mounted) return null;

  // ── Desktop right panel content ───────────────────────────────────────────

  const desktopPanelBody = (() => {
    if (resolvedRightMode === "incident" && resolvedSelectedIncident) {
      return (
        <IncidentDetail
          incident={resolvedSelectedIncident}
          weatherContext={resolvedSelectedIncidentWeather}
          onBack={() => { setSelectedIncident(null); setRightMode("controls"); }}
        />
      );
    }
    if (resolvedRightMode === "pin_detail" && selectedPin) {
      return (
        <PinDetailPanel
          pin={selectedPin}
          onBack={() => { setSelectedPin(null); setRightMode("controls"); }}
          onRemove={handleRemovePin}
        />
      );
    }
    if (panelTab === "filter") return filterPanelContent;
    return feedPanelContent;
  })();

  const desktopTabLabel =
    resolvedRightMode === "incident" ? "Incident"
    : resolvedRightMode === "pin_detail" ? "Pin"
    : "Feed";

  const mobileSidebarBody = (() => {
    if (resolvedRightMode === "incident" && resolvedSelectedIncident) {
      return (
        <IncidentDetail
          incident={resolvedSelectedIncident}
          weatherContext={resolvedSelectedIncidentWeather}
          onBack={() => {
            setSelectedIncident(null);
            setRightMode("controls");
          }}
        />
      );
    }
    if (resolvedRightMode === "pin_detail" && selectedPin) {
      return (
        <PinDetailPanel
          pin={selectedPin}
          onBack={() => {
            setSelectedPin(null);
            setRightMode("controls");
          }}
          onRemove={handleRemovePin}
        />
      );
    }
    return panelTab === "filter" ? filterPanelContent : feedPanelContent;
  })();

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.04),transparent_50%)]" />

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/live-intelligence"
        onNavigate={(path) => router.push(path)}
        onLogout={handleLogout}
        role={role}
      />

      <div className="lg:ml-72">
        <TopBar
          onMenuOpen={handleMenuOpen}
          locationLabel={locationLabel}
          alertCount={alerts.length}
          droppedPinCount={droppedPins.length}
        />

        <div className="grid h-[calc(100dvh-56px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Map area */}
          <section className="relative overflow-hidden">
            <DashboardMap
              controlsTargetId="live-intelligence-map-controls"
              mode={resolvedRightMode}
              onRequestModeChange={(m) => setRightMode(m as RightMode)}
              selectedState={selectedState}
              selectedCity={selectedCity}
              selectedStreet={selectedStreet}
              zoom={zoom}
              mapStyle={mapStyle}
              exactPin={exactPin}
              incidents={scopedIncidentPoints}
              watchZones={scopedWatchZonePoints}
              geofences={allGeofencePoints}
              droppedPins={droppedPins}
              myPins={combinedDroppedPins}
              showIncidents={layerVisibility.incidents}
              showHeatmap={layerVisibility.heatmaps}
              showRiskZones={layerVisibility.riskZones}
              showGeofencing={layerVisibility.geofencing}
              showWeatherLayer={layerVisibility.weather}
              emphasizeRecentIncidents={emphasizeRecentIncidents}
              onMapStyleChange={setMapStyle}
              onExactPinChange={setExactPin}
              onStateChange={(s) => { setSelectedState(s); setSelectedCity(""); setSelectedStreet(""); }}
              onCityChange={(c) => { setSelectedCity(c); setSelectedStreet(""); }}
              onStreetChange={setSelectedStreet}
              onZoomChange={setZoom}
              onFocusChange={setMapFocus}
              onMapHoverChange={setMapHoverPreview}
              onPinActionSelect={handlePinActionSelect}
              onIncidentSelect={(inc) => {
                setSelectedIncident(inc);
                setRightMode("incident");
                setMobilePanelOpen(true);
              }}
              onDroppedPinSelect={(pin) => {
                setSelectedPin(pin as unknown as DroppedPin);
                setRightMode("pin_detail");
                setMobilePanelOpen(true);
              }}
              selectedIncident={resolvedSelectedIncident}
              onClearSelectedIncident={() => {
                setSelectedIncident(null);
                setRightMode("controls");
                if (searchParams.get("incident")) router.replace("/dashboard/live-intelligence");
              }}
              filterPanel={filterPanelContent}
              mobileFeedPanel={feedPanelContent}
              weatherOverlay={weatherOverlayPoints}
            />

            {mapHoverPreview && mapHoverLabel ? (
              <div
                className="pointer-events-none fixed z-40 max-w-[240px] rounded-2xl border border-white/10 bg-[#08101d]/95 px-3 py-2 text-left shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-md"
                style={{ left: mapHoverPreview.clientX + 14, top: mapHoverPreview.clientY + 14 }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                  Location preview
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{mapHoverLabel}</div>
                <div className="mt-1 font-mono text-[11px] text-white/45">
                  {formatPinLabel(mapHoverPreview.latitude, mapHoverPreview.longitude)}
                </div>
              </div>
            ) : null}

            {/* Metrics overlay */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-1.5 sm:p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:pb-3">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 sm:grid-cols-4">
                {metrics.map((m) => (
                  <MetricCard key={m.label} {...m} />
                ))}
              </div>
            </div>
          </section>

          {/* ── Desktop right panel ── */}
          <aside className="hidden lg:flex min-h-0 flex-col overflow-hidden border-t border-white/[0.06] bg-[#090F1E] lg:border-l lg:border-t-0">
            {/* Tab nav — always visible unless detail panel is open */}
            {resolvedRightMode === "controls" && (
              <RightPanelNav
                activeTab={panelTab}
                onTabChange={setPanelTab}
                feedLabel="Feed"
              />
            )}

            {/* Detail panel header breadcrumb */}
            {(resolvedRightMode === "incident" || resolvedRightMode === "pin_detail") && (
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2">
                <button
                  onClick={() => { setSelectedIncident(null); setSelectedPin(null); setRightMode("controls"); }}
                  className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/30 transition hover:text-white/60"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
                  </svg>
                  Feed
                </button>
                <span className="text-white/20">/</span>
                <span className="text-[10px] uppercase tracking-wider text-white/50">
                  {resolvedRightMode === "incident" ? "Incident" : "Pin"}
                </span>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" id="live-intelligence-map-controls">
              {desktopPanelBody}
            </div>
          </aside>
        </div>
      </div>

      {mobilePanelOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            aria-label="Close intelligence panel"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMobilePanelOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(88vw,380px)] flex-col border-l border-white/[0.06] bg-[#090F1E]/98 shadow-[0_0_40px_rgba(0,0,0,0.42)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-400">Map Panel</p>
                <p className="mt-1 text-sm text-white/45">
                  {resolvedRightMode === "incident" ? "Incident detail" : resolvedRightMode === "pin_detail" ? "Pinned location" : panelTab === "filter" ? "Filters" : "Feed"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobilePanelOpen(false)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] p-2 text-white/55 transition hover:text-white"
                aria-label="Close panel"
              >
                <CloseIcon size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                {resolvedRightMode === "controls" ? (
                  <RightPanelNav
                    activeTab={panelTab}
                    onTabChange={setPanelTab}
                    feedLabel="Feed"
                  />
                ) : (
                  <div className="flex items-center gap-2 border-b border-white/[0.06] px-1 pb-3">
                    <button
                      onClick={() => {
                        setSelectedIncident(null);
                        setSelectedPin(null);
                        setRightMode("controls");
                      }}
                      className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/35 transition hover:text-white/65"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    <span className="text-white/20">/</span>
                    <span className="text-[10px] uppercase tracking-wider text-white/50">
                      {resolvedRightMode === "incident" ? "Incident" : "Pin"}
                    </span>
                  </div>
                )}
                <div className="min-h-0">
                  {mobileSidebarBody}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
