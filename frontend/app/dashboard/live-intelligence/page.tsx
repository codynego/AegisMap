"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DashboardMap } from "@/components/dashboard-map";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole } from "@/lib/access";
import {
  formatReportType,
  normalizeReportType,
  REPORT_TYPE_VALUES,
} from "@/lib/report-types";

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
};

type WatchZoneRecord = {
  id: number;
  name: string;
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

type ApiListResponse<T> = {
  results?: T[];
};

type ExactPin = {
  latitude: number;
  longitude: number;
  label: string;
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
};

type DatePreset = "all" | "today" | "7d" | "30d" | "custom";
type LayerFilterKey = "incidents" | "heatmaps" | "riskZones" | "geofencing";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

const NAV_ITEMS = [
  "Home",
  "Map",
  "Report",
  "Routes",
  "Alerts",
  "Profile",
];

// Live activity feed items removed — keep the sidebar focused on map controls and incident detail.

function relativeTime(value?: string | null) {
  if (!value) return "Now";
  const then = new Date(value).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getList<T>(payload: T[] | ApiListResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function haversineKilometers(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(latitudeB - latitudeA);
  const dLng = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesDatePreset(
  dateValue: string,
  preset: DatePreset,
  customStart: string,
  customEnd: string,
) {
  if (preset === "all") return true;

  const incidentDate = new Date(dateValue);
  if (Number.isNaN(incidentDate.getTime())) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "today") {
    return incidentDate >= startOfToday;
  }

  if (preset === "7d") {
    return incidentDate.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
  }

  if (preset === "30d") {
    return incidentDate.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
  }

  if (preset === "custom") {
    if (!customStart && !customEnd) return true;
    const start = customStart ? new Date(`${customStart}T00:00:00`) : null;
    const end = customEnd ? new Date(`${customEnd}T23:59:59`) : null;

    if (start && incidentDate < start) return false;
    if (end && incidentDate > end) return false;
  }

  return true;
}

function SeverityBadge({ level }: { level: string }) {
  const lower = level.toLowerCase();
  if (lower === "critical") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-400">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />Critical
      </span>
    );
  }
  if (lower === "high") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />High
      </span>
    );
  }
  if (lower === "medium") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />Low
    </span>
  );
}

function NavSidebar({
  open,
  onClose,
  activeIndex,
  onNavSelect,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  activeIndex: number;
  onNavSelect: (index: number) => void;
  onLogout: () => void;
}) {
  return (
    <>
      {open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-white/[0.06] bg-[#070D1A]/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-7 py-8">
          <h1 className="font-display text-4xl font-bold tracking-[-0.04em] text-cyan-400">GeoPulse AI</h1>
          <p className="mt-2 font-mono-ui text-[11px] uppercase tracking-[0.28em] text-white/45">
            Tactical Command Center
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item}
              onClick={() => {
                onNavSelect(index);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                activeIndex === index
                  ? "bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/20"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${activeIndex === index ? "bg-emerald-400" : "bg-white/20"}`} />
              <span className="text-[15px] font-medium">{item}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-4">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-white/50 transition hover:bg-white/[0.04] hover:text-white"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="text-[15px] font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// NavSidebar removed — dashboard overview is now sidebar-free.

function TopBar({
  onMenuOpen,
  onNotificationsOpen,
  locationLabel,
  alertCount,
}: {
  onMenuOpen: () => void;
  onNotificationsOpen: () => void;
  locationLabel: string;
  alertCount: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0A1020]/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={onMenuOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 lg:hidden"
        >
          <MenuIcon />
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#4cd7f6]" />
          <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-cyan-400">
            Live Monitor
          </span>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm text-white/80">{locationLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          aria-label="Open intelligence panel"
          onClick={onNotificationsOpen}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 transition hover:text-white"
        >
          <BellIcon />
          {alertCount > 0 ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-400" /> : null}
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 sm:flex">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-500/20 ring-1 ring-cyan-400/30">
            <span className="text-[10px] font-semibold text-cyan-300">VT</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none text-white">V. Thorne</p>
            <p className="mt-0.5 text-[10px] text-cyan-400/70">Senior Operator</p>
          </div>
        </div>
      </div>
    </header>
  );
}

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
  const accentColor = {
    default: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
    danger: "text-red-400 border-red-500/20 bg-red-500/5",
    warning: "text-amber-400 border-amber-500/20 bg-amber-500/5",
    success: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
  }[variant];

  return (
    <div className={`rounded-lg border px-2 py-1.5 sm:rounded-xl sm:p-3 ${accentColor}`}>
      <p className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.14em] text-current opacity-60">
        {label}
      </p>
      <p className="mt-0.5 text-sm sm:mt-1 sm:text-2xl font-bold text-current tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[9px] sm:mt-1 sm:line-clamp-2 sm:text-[11px] leading-relaxed text-white/50">
        {subtext}
      </p>
    </div>
  );
}

function AlertItem({ alert }: { alert: DashboardAlert }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <SeverityBadge level={alert.level} />
        <span className="whitespace-nowrap text-[11px] tabular-nums text-white/30">{alert.time}</span>
      </div>
      <p className="mt-3 font-semibold leading-snug text-white">{alert.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-white/50">{alert.body}</p>
      {alert.meta ? (
        <p className="mt-2 text-[11px] uppercase tracking-wider text-emerald-400/70">{alert.meta}</p>
      ) : null}
    </div>
  );
}

function IncidentDetail({
  incident,
  onBack,
}: {
  incident: SelectedIncident;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] px-5 py-5">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-sm text-white/40 transition hover:text-white/70"
        >
          <ArrowLeftIcon />
          Back to feed
        </button>
        <SeverityBadge level={incident.severity} />
        <h2 className="mt-3 text-xl font-bold leading-snug text-white">{incident.title}</h2>
        <p className="mt-1.5 text-sm text-white/40">{incident.locationName || "Unknown location"}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Type", value: formatReportType(incident.incidentType) },
            { label: "Status", value: incident.status },
            { label: "Confidence", value: incident.confidence },
            { label: "Detected", value: incident.detectedAt ? new Date(incident.detectedAt).toLocaleDateString() : "Unknown" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/30">{label}</p>
              <p className="mt-1 text-sm font-medium capitalize text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Coordinates</p>
          <p className="mt-1.5 font-mono-ui text-sm text-cyan-400">
            {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Summary</p>
          <p className="text-sm leading-relaxed text-white/60">
            {incident.summary || "No incident summary available."}
          </p>
        </div>
      </div>
    </div>
  );
}

function LiveActivityBoard({
  incidents,
  watchZones,
  alerts,
}: {
  incidents: Array<SelectedIncident>;
  watchZones: Array<{
    id: number;
    name: string;
    riskLevel: string;
    riskScore: number;
  }>;
  alerts: DashboardAlert[];
}) {
  const recentReports = [...incidents]
    .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
    .slice(0, 4);

  const patrolUpdates = [...watchZones]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 4);

  const streamItems = [...alerts].slice(0, 5);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-cyan-400">Live Reports</p>
        <div className="mt-4 space-y-3">
          {recentReports.length > 0 ? (
            recentReports.map((report) => (
              <div key={report.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{report.title}</p>
                    <p className="mt-1 text-xs text-white/40">{report.locationName || "Mapped incident point"}</p>
                  </div>
                  <SeverityBadge level={report.severity} />
                </div>
                <p className="mt-3 text-sm leading-6 text-white/55">{report.summary || "Incoming activity logged by the monitoring stream."}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-white/30">
                  <span>{formatReportType(report.incidentType)}</span>
                  <span>{relativeTime(report.detectedAt)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/60 p-5 text-sm text-white/35">
              No live incident reports yet.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-emerald-400">Patrol Updates</p>
        <div className="mt-4 space-y-3">
          {patrolUpdates.length > 0 ? (
            patrolUpdates.map((zone) => {
              const tone = zone.riskLevel.toLowerCase();
              const badgeClass =
                tone === "critical" || tone === "high"
                  ? "bg-red-500/15 text-red-400"
                  : tone === "medium"
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-cyan-500/15 text-cyan-400";

              return (
                <div key={zone.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{zone.name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${badgeClass}`}>
                      {zone.riskLevel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/55">Patrol queue updated with risk score {zone.riskScore.toFixed(0)}.</p>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/60 p-5 text-sm text-white/35">
              No patrol updates available.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-fuchsia-400">Streaming Activity</p>
        <div className="mt-4 space-y-3">
          {streamItems.length > 0 ? (
            streamItems.map((alert) => (
              <div key={alert.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{alert.title}</p>
                  <span className="whitespace-nowrap text-[11px] tabular-nums text-white/30">{alert.time}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/55">{alert.body}</p>
                {alert.meta ? <p className="mt-2 text-[11px] uppercase tracking-wider text-emerald-400/70">{alert.meta}</p> : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/60 p-5 text-sm text-white/35">
              No stream events yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LivePulseCard({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
      <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-cyan-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/55">{body}</p>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118.6 14.6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 10-3 0v.68C7.63 5.36 6 7.92 6 11v3.6c0 .53-.21 1.04-.595 1.415L4 17h5" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

export default function LiveIntelligencePage() {
  const role = getCurrentRole();

  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(1);
  const [selectedState, setSelectedState] = useState("Lagos");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStreet, setSelectedStreet] = useState("");
  const [zoom, setZoom] = useState(3);
  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/dark-v11");
  const [exactPin, setExactPin] = useState<ExactPin | null>(null);
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number } | null>(null);
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token"),
  );
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [watchZones, setWatchZones] = useState<WatchZoneRecord[]>([]);
  const [geofences, setGeofences] = useState<GeofenceRecord[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loadingIntel, setLoadingIntel] = useState(Boolean(authToken));
  const [selectedIncident, setSelectedIncident] = useState<SelectedIncident | null>(null);
  const [rightMode, setRightMode] = useState<"controls" | "incident" | "filter">("controls");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedReportType, setSelectedReportType] = useState("all");
  const [layerVisibility, setLayerVisibility] = useState<Record<LayerFilterKey, boolean>>({
    incidents: true,
    heatmaps: true,
    riskZones: true,
    geofencing: true,
  });

  function handleLogout() {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    const headers = { Authorization: `Token ${authToken}` };

    async function loadIntel() {
      setLoadingIntel(true);
      try {
        const [iRes, wRes, gRes, aRes] = await Promise.all([
          fetch(`${API_BASE_URL}/incidents/`, { headers }),
          fetch(`${API_BASE_URL}/watch-zones/`, { headers }),
          fetch(`${API_BASE_URL}/geofences/?status=active`, { headers }),
          fetch(`${API_BASE_URL}/alerts/`, { headers }),
        ]);
        if (!active) return;

        const [iData, wData, gData, aData] = await Promise.all([
          iRes.json(),
          wRes.json(),
          gRes.json(),
          aRes.json(),
        ]);

        if (iRes.ok) setIncidents(getList(iData));
        if (wRes.ok) setWatchZones(getList(wData));
        if (gRes.ok) setGeofences(getList(gData));
        if (aRes.ok) {
          const mapped = getList(aData as ApiListResponse<Record<string, unknown>>).map((a, idx) => {
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
          setAlerts(mapped);
        }
      } catch {
        if (!active) return;
      } finally {
        if (active) setLoadingIntel(false);
      }
    }

    void loadIntel();
    return () => {
      active = false;
    };
  }, [authToken]);

  const incidentPoints = useMemo(
    () =>
      incidents.flatMap((inc) => {
        const lat = toNumber(inc.latitude);
        const lng = toNumber(inc.longitude);
        if (lat === null || lng === null) return [];
        return [
          {
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
          },
        ];
      }),
    [incidents],
  );

  const activeRadiusKm = useMemo(() => {
    if (selectedStreet || exactPin) return 10;
    if (selectedCity) return 25;
    if (selectedState) return 120;
    return null;
  }, [exactPin, selectedCity, selectedState, selectedStreet]);

  const scopedIncidentPoints = useMemo(() => {
    return incidentPoints.filter((incident) => {
      if (!matchesDatePreset(incident.detectedAt, datePreset, customStartDate, customEndDate)) {
        return false;
      }

      if (selectedReportType !== "all" && incident.incidentType !== selectedReportType) {
        return false;
      }

      if (!mapFocus || activeRadiusKm === null) {
        return true;
      }

      return (
        haversineKilometers(
          incident.latitude,
          incident.longitude,
          mapFocus.latitude,
          mapFocus.longitude,
        ) <= activeRadiusKm
      );
    });
  }, [
    activeRadiusKm,
    customEndDate,
    customStartDate,
    datePreset,
    incidentPoints,
    mapFocus,
    selectedReportType,
  ]);

  const watchZonePoints = useMemo(
    () =>
      watchZones.flatMap((zone) => {
        const lat = toNumber(zone.centroid_latitude);
        const lng = toNumber(zone.centroid_longitude);
        if (lat === null || lng === null) return [];
        return [
          {
            id: zone.id,
            name: zone.name,
            riskLevel: zone.current_risk_level,
            riskScore: toNumber(zone.current_risk_score) ?? 0,
            latitude: lat,
            longitude: lng,
          },
        ];
      }),
    [watchZones],
  );

  const scopedWatchZonePoints = useMemo(() => {
    return watchZonePoints.filter((zone) => {
      if (!mapFocus || activeRadiusKm === null) {
        return true;
      }

      return (
        haversineKilometers(
          zone.latitude,
          zone.longitude,
          mapFocus.latitude,
          mapFocus.longitude,
        ) <= activeRadiusKm
      );
    });
  }, [activeRadiusKm, mapFocus, watchZonePoints]);

  const geofencePoints = useMemo(
    () =>
      geofences.flatMap((geofence) => {
        const lat = toNumber(geofence.centroid_latitude);
        const lng = toNumber(geofence.centroid_longitude);
        if (lat === null || lng === null) return [];
        return [
          {
            id: geofence.id,
            name: geofence.name,
            geofenceType: geofence.geofence_type,
            status: geofence.status,
            description: geofence.description,
            radiusMeters: toNumber(geofence.radius_meters) ?? 0,
            latitude: lat,
            longitude: lng,
          },
        ];
      }),
    [geofences],
  );

  const scopedGeofencePoints = useMemo(() => {
    return geofencePoints.filter((geofence) => {
      if (!mapFocus || activeRadiusKm === null) {
        return true;
      }

      return (
        haversineKilometers(
          geofence.latitude,
          geofence.longitude,
          mapFocus.latitude,
          mapFocus.longitude,
        ) <= activeRadiusKm
      );
    });
  }, [activeRadiusKm, geofencePoints, mapFocus]);

  const reportTypeOptions = useMemo(() => {
    return [...REPORT_TYPE_VALUES];
  }, []);

  const emphasizeRecentIncidents = useMemo(() => {
    if (datePreset !== "custom") {
      return true;
    }

    if (!customEndDate) {
      return true;
    }

    const selectedEnd = new Date(`${customEndDate}T23:59:59`);
    if (Number.isNaN(selectedEnd.getTime())) {
      return true;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return selectedEnd >= startOfToday;
  }, [customEndDate, datePreset]);

  function toggleLayer(layer: LayerFilterKey) {
    setLayerVisibility((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  }

  const locationLabel = useMemo(() => {
    const parts = [selectedState, selectedCity, selectedStreet].filter(Boolean);
    if (exactPin) {
      return `${parts.join(" › ") || exactPin.label} • ${exactPin.latitude.toFixed(4)}, ${exactPin.longitude.toFixed(4)}`;
    }
    if (parts.length > 0) return parts.join(" › ");
    if (mapFocus) return `${mapFocus.latitude.toFixed(4)}, ${mapFocus.longitude.toFixed(4)}`;
    return selectedState || "Nigeria";
  }, [exactPin, mapFocus, selectedCity, selectedState, selectedStreet]);

  const liveReportCount = scopedIncidentPoints.length;
  const activeThreatCount = scopedIncidentPoints.filter((incident) => incident.severity === "high" || incident.severity === "critical").length;
  const movingMarkerCount = scopedWatchZonePoints.length;
  const alertCount = alerts.filter((alert) => alert.level !== "Info").length;

  const metrics = [
    {
      label: "Live Reports",
      value: String(liveReportCount),
      subtext: loadingIntel ? "Loading live reports..." : `${activeThreatCount} high-severity reports`,
      variant: activeThreatCount > 0 ? "danger" : "default",
    },
    {
      label: "Moving Markers",
      value: String(movingMarkerCount),
      subtext: loadingIntel ? "Tracking zone movement..." : `${scopedWatchZonePoints.filter((zone) => zone.riskLevel === "high" || zone.riskLevel === "critical").length} elevated zones`,
      variant: movingMarkerCount > 0 ? "warning" : "default",
    },
    {
      label: "Real-time Alerts",
      value: String(alerts.length),
      subtext: loadingIntel ? "Syncing alerts..." : `${alertCount} require attention`,
      variant: alertCount > 0 ? "warning" : "default",
    },
    {
      label: "Streaming Feed",
      value: "Live",
      subtext: "Reports, patrol updates, and alerts are refreshing continuously.",
      variant: "success",
    },
  ] as const;

  const activeSelectedIncident = useMemo(() => {
    if (!selectedIncident) return null;
    return scopedIncidentPoints.find((incident) => incident.id === selectedIncident.id) ?? null;
  }, [scopedIncidentPoints, selectedIncident]);
  const deepLinkedIncident = useMemo(() => {
    const incidentParam = searchParams.get("incident");
    if (!incidentParam) return null;
    const incidentId = Number(incidentParam);
    if (!Number.isFinite(incidentId)) return null;
    return scopedIncidentPoints.find((incident) => incident.id === incidentId) ?? null;
  }, [scopedIncidentPoints, searchParams]);
  const resolvedSelectedIncident = activeSelectedIncident ?? deepLinkedIncident;
  const resolvedRightMode =
    !activeSelectedIncident && deepLinkedIncident ? "incident" : rightMode;

  const filterPanel = (
    <div className="grid gap-3">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-amber-400">Date Filter</p>
            <p className="mt-2 text-sm font-semibold text-white">Incidents in current area</p>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Showing {scopedIncidentPoints.length} incident{scopedIncidentPoints.length === 1 ? "" : "s"}
              {activeRadiusKm ? ` within ~${activeRadiusKm}km` : ""}.
            </p>
          </div>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-400">
            {datePreset === "all" ? "All time" : datePreset === "today" ? "Today" : datePreset === "7d" ? "Last 7d" : datePreset === "30d" ? "Last 30d" : "Custom"}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-cyan-400">Report Types</p>
            <p className="mt-2 text-sm font-semibold text-white">Show only one incident category at a time</p>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Filter incident dots by suspicious activity, medical emergency, unsafe route, and the rest of the supported report types.
            </p>
          </div>
        </div>

        <label className="mt-4 grid gap-1.5">
          <span className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-white/35">Report Type</span>
          <select
            value={selectedReportType}
            onChange={(event) => setSelectedReportType(event.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60"
          >
            <option value="all">All report types</option>
            {reportTypeOptions.map((reportType) => (
              <option key={reportType} value={reportType}>
                {formatReportType(reportType)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-white/35">Time Window</span>
        <select
          value={datePreset}
          onChange={(event) => setDatePreset(event.target.value as DatePreset)}
          className="w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60"
        >
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>
      </label>

      {datePreset === "custom" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1.5">
            <span className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-white/35">Start</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(event) => setCustomStartDate(event.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-white/35">End</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(event) => setCustomEndDate(event.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60"
            />
          </label>
        </div>
      ) : null}

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
        <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-emerald-400">Layers</p>
        <p className="mt-2 text-sm font-semibold text-white">Map visibility controls</p>
        <p className="mt-1 text-xs leading-5 text-white/45">
          Toggle the operational layers you want to see on the live intelligence map.
        </p>

        <div className="mt-4 grid gap-2">
          {[
            {
              key: "incidents" as const,
              label: "Incidents",
              description: "Show incident dots on the map.",
            },
            {
              key: "heatmaps" as const,
              label: "Heatmaps",
              description: "Visualize concentration and clustering patterns.",
            },
            {
              key: "riskZones" as const,
              label: "Risk Zones",
              description: "Display AI-generated dangerous areas and threat levels.",
            },
            {
              key: "geofencing" as const,
              label: "Geofencing",
              description: "Monitor virtual boundaries around protected locations.",
            },
          ].map((layer) => (
            <label
              key={layer.key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.06] bg-[#0A1020]/60 px-3 py-3"
            >
              <input
                type="checkbox"
                checked={layerVisibility[layer.key]}
                onChange={() => toggleLayer(layer.key)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-[#0A1020]"
              />
              <span>
                <span className="block text-sm font-medium text-white">{layer.label}</span>
                <span className="mt-1 block text-xs leading-5 text-white/45">{layer.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] bg-[#0A1020]/45 p-3 text-xs leading-5 text-white/40">
          Upcoming layers: AI Predictions, Patrol Activity, Safe Corridors, and Drone Feeds.
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;

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
          onMenuOpen={() => setSidebarOpen(true)}
          onNotificationsOpen={() => {}}
          locationLabel={locationLabel}
          alertCount={alerts.length}
        />

        {/* Monitoring header removed as requested */}

        <div className="grid h-[calc(100dvh-56px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="relative overflow-hidden">
            <DashboardMap
              controlsTargetId="live-intelligence-map-controls"
              mode={resolvedRightMode}
              onRequestModeChange={(m) => setRightMode(m)}
              selectedState={selectedState}
              selectedCity={selectedCity}
              selectedStreet={selectedStreet}
              zoom={zoom}
              mapStyle={mapStyle}
              exactPin={exactPin}
              incidents={scopedIncidentPoints}
              watchZones={scopedWatchZonePoints}
              geofences={scopedGeofencePoints}
              showIncidents={layerVisibility.incidents}
              showHeatmap={layerVisibility.heatmaps}
              showRiskZones={layerVisibility.riskZones}
              showGeofencing={layerVisibility.geofencing}
              emphasizeRecentIncidents={emphasizeRecentIncidents}
              onMapStyleChange={setMapStyle}
              onStateChange={(nextState) => {
                setSelectedState(nextState);
                setSelectedCity("");
                setSelectedStreet("");
                setExactPin(null);
              }}
              onCityChange={(nextCity) => {
                setSelectedCity(nextCity);
                setSelectedStreet("");
              }}
              onStreetChange={setSelectedStreet}
              onZoomChange={setZoom}
              onExactPinChange={setExactPin}
              onFocusChange={setMapFocus}
              onIncidentSelect={(inc) => {
                setSelectedIncident(inc);
                setRightMode('incident');
              }}
              selectedIncident={resolvedSelectedIncident}
              onClearSelectedIncident={() => {
                setSelectedIncident(null);
                setRightMode('controls');
                if (searchParams.get("incident")) {
                  router.replace("/dashboard/live-intelligence");
                }
              }}
              filterPanel={filterPanel}
            />

            <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-1.5 sm:p-3">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2 sm:grid-cols-4">
                {metrics.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </div>
            </div>
          </section>

          <aside className="hidden lg:flex min-h-0 flex-col overflow-hidden border-t border-white/[0.06] bg-[#090F1E] lg:border-l lg:border-t-0">
            <div className="flex-1 min-h-0 p-4">
              <div className="flex h-full min-h-0 flex-col rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-cyan-400">
                  {resolvedRightMode === "incident" ? "Incident Details" : resolvedRightMode === "filter" ? "Date Filter" : "Map Controls"}
                </p>
                <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1" id="live-intelligence-map-controls" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
