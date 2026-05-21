"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

const NAV_ITEMS = [
  "Dashboard",
  "Live Intelligence",
  "Incident Reports",
  "Risk Zones",
  "Heatmaps",
  "Route Intelligence",
  "Geofencing",
  "AI Predictions",
  "Drone Intelligence",
];

const INCIDENT_LEGEND = [
  { label: "Kidnapping", color: "#ff5f6d" },
  { label: "Armed Robbery", color: "#ff3f5a" },
  { label: "Violence", color: "#f8c15b" },
  { label: "Road Threat", color: "#ff9c5a" },
  { label: "Suspicious Movement", color: "#4cd7f6" },
  { label: "Abnormal Sighting", color: "#7fd0ff" },
  { label: "Camp Indicator", color: "#8f7dff" },
  { label: "Fire / Smoke", color: "#ff9b52" },
  { label: "Flood", color: "#46c0ff" },
] as const;

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

function formatIncidentType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

        <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#4edea3]" />
          <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-emerald-400">
            System Active
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

        <div className="flex items-center gap-2.5 border-l border-white/[0.06] pl-3">
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
    <div className={`rounded-2xl border p-4 ${accentColor}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-current opacity-60">{label}</p>
      <p className="mt-2 text-3xl font-bold text-current tabular-nums">{value}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/50">{subtext}</p>
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

function isSameDay(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function buildHourlySeries(values: Array<string | null | undefined>, buckets = 6) {
  const series = Array.from({ length: buckets }, () => 0);
  const now = Date.now();

  for (const value of values) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) continue;
    const deltaHours = Math.floor((now - timestamp) / 3600000);
    if (deltaHours < 0 || deltaHours >= buckets) continue;
    const bucketIndex = buckets - 1 - deltaHours;
    series[bucketIndex] += 1;
  }

  return series;
}

function SparklineCard({
  title,
  subtitle,
  data,
  accent,
}: {
  title: string;
  subtitle: string;
  data: number[];
  accent: string;
}) {
  const peak = Math.max(...data, 1);
  const points = data
    .map((value, index) => {
      const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
      const y = 88 - (value / peak) * 64;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/78 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-white/40">{subtitle}</p>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
      </div>
      <div className="mt-4 h-24 overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02] p-2">
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            className={accent}
          />
        </svg>
      </div>
    </div>
  );
}

function OverviewPanel({
  incidents,
  watchZones,
  alerts,
  selectedIncident,
  loading,
}: {
  incidents: SelectedIncident[];
  watchZones: Array<{
    id: number;
    name: string;
    riskLevel: string;
    riskScore: number;
  }>;
  alerts: DashboardAlert[];
  selectedIncident: SelectedIncident | null;
  loading: boolean;
}) {
  const todayIncidentCount = incidents.filter((incident) => isSameDay(incident.detectedAt)).length;
  const highSeverityCount = incidents.filter((incident) => incident.severity === "high" || incident.severity === "critical").length;
  const elevatedZoneCount = watchZones.filter((zone) => zone.riskLevel === "high" || zone.riskLevel === "critical").length;
  const actionAlertCount = alerts.filter((alert) => alert.level !== "Info").length;
  const dominantIncident = useMemo(() => {
    const counts = new Map<string, number>();
    for (const incident of incidents) {
      counts.set(incident.incidentType, (counts.get(incident.incidentType) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No incidents yet";
  }, [incidents]);
  const topZone = [...watchZones].sort((a, b) => b.riskScore - a.riskScore)[0];
  const incidentTrend = buildHourlySeries(incidents.map((incident) => incident.detectedAt));
  const alertTrend = buildHourlySeries(alerts.map((alert) => alert.triggeredAt));
  const zoneTrend = [
    watchZones.filter((zone) => zone.riskLevel === "low").length,
    watchZones.filter((zone) => zone.riskLevel === "medium").length,
    watchZones.filter((zone) => zone.riskLevel === "high").length,
    watchZones.filter((zone) => zone.riskLevel === "critical").length,
  ];

  const aiSummaries = [
    {
      label: "Situational Readout",
      title: `${todayIncidentCount} incidents today`,
      body: highSeverityCount > 0
        ? `${highSeverityCount} high-severity incident${highSeverityCount === 1 ? "" : "s"} are driving the current risk picture.`
        : "No high-severity incidents are active at the moment.",
      tone: "text-cyan-400",
    },
    {
      label: "Threat Focus",
      title: `${actionAlertCount} active alerts`,
      body: elevatedZoneCount > 0
        ? `${elevatedZoneCount} high-risk zone${elevatedZoneCount === 1 ? "" : "s"} need active watch. Dominant pattern: ${dominantIncident}.`
        : `Threat pressure remains contained. Dominant pattern: ${dominantIncident}.`,
      tone: "text-amber-400",
    },
    {
      label: "AI Summary",
      title: topZone ? topZone.name : "All zones nominal",
      body: topZone
        ? `Top watch-zone pressure is ${topZone.riskScore.toFixed(0)} points in ${topZone.riskLevel.toUpperCase()} mode.`
        : "No watch zone pressure is currently elevated.",
      tone: "text-emerald-400",
    },
  ];

  return (
    <aside className="space-y-5 bg-[#090F1E]">
      <div className="border-b border-white/[0.06] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono-ui text-[10px] uppercase tracking-[0.22em] text-cyan-400">High-level overview</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-white">What&apos;s happening right now?</h2>
            <p className="mt-2 text-sm leading-6 text-white/45">
              Quick situational awareness across incidents, threats, alerts, AI summaries, trend graphs, and live activity.
            </p>
          </div>
          <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
            Overview Mode
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 pb-6">
        {selectedIncident ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-cyan-400">Selected incident</p>
                <p className="mt-2 text-base font-semibold text-white">{selectedIncident.title}</p>
                <p className="mt-1 text-xs text-white/40">{selectedIncident.locationName || "Mapped incident point"}</p>
              </div>
              <SeverityBadge level={selectedIncident.severity} />
            </div>
            <p className="mt-3 text-sm leading-6 text-white/55">{selectedIncident.summary || "No summary available."}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/45">
            Syncing overview data from live sources.
          </div>
        ) : null}

        <div className="grid gap-3">
          {aiSummaries.map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className={`font-mono-ui text-[10px] uppercase tracking-[0.18em] ${item.tone}`}>{item.label}</p>
              <p className="mt-2 text-base font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/55">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          <SparklineCard title="Incident trend" subtitle="Incidents by hour" data={incidentTrend} accent="text-cyan-400" />
          <SparklineCard title="Alert flow" subtitle="Alerts by hour" data={alertTrend} accent="text-amber-400" />
          <SparklineCard title="Zone pressure" subtitle="Risk distribution" data={zoneTrend} accent="text-emerald-400" />
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-cyan-400">Recent alerts</p>
          <div className="mt-3 space-y-3">
            {alerts.slice(0, 4).map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
            {alerts.length === 0 ? (
              <p className="text-sm text-white/35">No recent alerts.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-emerald-400">Live activity</p>
          <div className="mt-3 space-y-3">
            {[...incidents]
              .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
              .slice(0, 4)
              .map((incident) => (
                <div key={incident.id} className="rounded-xl border border-white/[0.06] bg-[#0A1020]/75 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-white">{incident.title}</p>
                    <span className="whitespace-nowrap text-[11px] tabular-nums text-white/30">{relativeTime(incident.detectedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/40">{incident.locationName || "Mapped incident point"}</p>
                  <p className="mt-2 text-sm leading-6 text-white/55">{incident.summary || "Incoming activity captured in the live feed."}</p>
                </div>
              ))}
            {incidents.length === 0 ? <p className="text-sm text-white/35">No live activity yet.</p> : null}
          </div>
        </div>
      </div>
    </aside>
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
            { label: "Type", value: formatIncidentType(incident.incidentType) },
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

function IntelPanel({
  alerts,
  loading,
  selectedIncident,
  onClearSelection,
  controlsSlot,
}: {
  alerts: DashboardAlert[];
  loading: boolean;
  selectedIncident: SelectedIncident | null;
  onClearSelection: () => void;
  controlsSlot?: ReactNode;
}) {
  if (selectedIncident) {
    return <IncidentDetail incident={selectedIncident} onBack={onClearSelection} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Live Intelligence</h2>
            <p className="mt-0.5 text-xs text-white/40">Real-Time Incident Feed</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            <span className="text-xs font-medium text-cyan-400">{alerts.length} ACTIVE</span>
          </div>
        </div>
      </div>

      {controlsSlot ? <div className="border-b border-white/[0.06] p-4">{controlsSlot}</div> : null}

      <div className="border-b border-white/[0.06] p-5">
        <p className="mb-3 text-[10px] uppercase tracking-wider text-white/30">Incident Types</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {INCIDENT_LEGEND.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }}
              />
              <span className="truncate text-[11px] text-white/50">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        ) : null}

        {!loading && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04]">
              <ClipboardIcon />
            </div>
            <p className="text-sm font-medium text-white/40">No active alerts</p>
            <p className="mt-1 text-xs text-white/20">Click a map incident to inspect details</p>
          </div>
        ) : null}

        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </div>

      <div className="border-t border-white/[0.06] p-4">
        <button className="w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 active:scale-[0.98]">
          Execute Countermeasures
        </button>
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
                  <span>{formatIncidentType(report.incidentType)}</span>
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

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(0);
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
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loadingIntel, setLoadingIntel] = useState(Boolean(authToken));
  const [selectedIncident, setSelectedIncident] = useState<SelectedIncident | null>(null);

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
        const [iRes, wRes, aRes] = await Promise.all([
          fetch(`${API_BASE_URL}/incidents/`, { headers }),
          fetch(`${API_BASE_URL}/watch-zones/`, { headers }),
          fetch(`${API_BASE_URL}/alerts/`, { headers }),
        ]);
        if (!active) return;

        const [iData, wData, aData] = await Promise.all([iRes.json(), wRes.json(), aRes.json()]);

        if (iRes.ok) setIncidents(getList(iData));
        if (wRes.ok) setWatchZones(getList(wData));
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
            incidentType: inc.incident_type,
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

  const locationLabel = useMemo(() => {
    const parts = [selectedState, selectedCity, selectedStreet].filter(Boolean);
    if (exactPin) {
      return `${parts.join(" › ") || exactPin.label} • ${exactPin.latitude.toFixed(4)}, ${exactPin.longitude.toFixed(4)}`;
    }
    if (parts.length > 0) return parts.join(" › ");
    if (mapFocus) return `${mapFocus.latitude.toFixed(4)}, ${mapFocus.longitude.toFixed(4)}`;
    return selectedState || "Nigeria";
  }, [exactPin, mapFocus, selectedCity, selectedState, selectedStreet]);

  const highSeverityCount = incidentPoints.filter((i) => i.severity === "high" || i.severity === "critical").length;
  const elevatedZoneCount = watchZonePoints.filter((z) => z.riskLevel === "high" || z.riskLevel === "critical").length;
  const actionAlertCount = alerts.filter((a) => a.level !== "Info").length;

  const metrics = [
    {
      label: "Active Incidents",
      value: String(incidentPoints.length),
      subtext: loadingIntel ? "Loading data..." : `${highSeverityCount} high-severity`,
      variant: highSeverityCount > 0 ? "danger" : "default",
    },
    {
      label: "Watch Zones",
      value: String(watchZonePoints.length),
      subtext: loadingIntel ? "Loading data..." : `${elevatedZoneCount} elevated risk`,
      variant: elevatedZoneCount > 0 ? "warning" : "default",
    },
    {
      label: "Location Pin",
      value: exactPin ? "Pinned" : "Standby",
      subtext: exactPin ? `${exactPin.latitude.toFixed(4)}, ${exactPin.longitude.toFixed(4)}` : "Tap map or search to pin",
      variant: exactPin ? "success" : "default",
    },
    {
      label: "Alert Feed",
      value: String(alerts.length),
      subtext: loadingIntel ? "Syncing feed..." : `${actionAlertCount} require attention`,
      variant: actionAlertCount > 0 ? "warning" : "default",
    },
  ] as const;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.04),transparent_50%)]" />

      <NavSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeIndex={activeNav}
        onLogout={handleLogout}
        onNavSelect={(index) => {
          setActiveNav(index);
          if (index === 0) {
            router.push("/dashboard");
          }
          if (index === 1) {
            router.push("/dashboard/live-intelligence");
          }
        }}
      />

      {intelOpen ? (
        <>
          <button
            aria-label="Close overview panel"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setIntelOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col overflow-y-auto border-l border-white/[0.06] bg-[#0A1020] lg:hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <h3 className="font-semibold text-white">Overview</h3>
              <button
                aria-label="Close"
                onClick={() => setIntelOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <CloseIcon size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <OverviewPanel
                incidents={incidentPoints}
                watchZones={watchZonePoints}
                alerts={alerts}
                loading={loadingIntel}
                selectedIncident={selectedIncident}
              />
            </div>
          </div>
        </>
      ) : null}

      <div className="lg:ml-72">
        <TopBar
          onMenuOpen={() => setSidebarOpen(true)}
          locationLabel={locationLabel}
          onNotificationsOpen={() => setIntelOpen(true)}
          alertCount={alerts.length}
        />

        <div className="border-b border-white/[0.06] bg-[#08101f]/70 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono-ui text-[10px] uppercase tracking-[0.24em] text-cyan-400">High-level overview</p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-white">What&apos;s happening right now?</h2>
              <p className="mt-1 text-sm text-white/45">
                Quick situational awareness across incidents, active threats, alerts, AI summaries, trend graphs, and live activity.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-cyan-400">Overview mode</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>

            <OverviewPanel
              incidents={incidentPoints}
              watchZones={watchZonePoints}
              alerts={alerts}
              loading={loadingIntel}
              selectedIncident={selectedIncident}
            />
          </section>
        </div>
      </div>
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

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.4V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5" />
      <path d="M9 17a3 3 0 006 0" />
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

function ClipboardIcon() {
  return (
    <svg className="h-6 w-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}
