"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole, getPublicNavItems, INTERNAL_NAV_ITEMS, isAnalystRole, type NavItem } from "@/lib/access";
import { formatReportType, normalizeReportType } from "@/lib/report-types";
import {
  getStoredUserLocation,
  haversineKm,
  requestAndStoreUserLocation,
  resolveNearestHub,
  stateForCoordinates,
} from "@/lib/user-location";

// ─── Types ────────────────────────────────────────────────────────────────────

type DashboardAlert = {
  id: number;
  level: string;
  triggeredAt?: string;
  title: string;
  body: string;
  meta: string;
  locationName?: string;
  locationState?: string;
  locationLatitude?: number | string | null;
  locationLongitude?: number | string | null;
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
  zone_type?: string;
  current_risk_level: string;
  current_risk_score: number | string | null;
  centroid_latitude: number | string | null;
  centroid_longitude: number | string | null;
  metadata?: {
    created_from?: string;
    pin_action?: string;
    location_state?: string;
  };
};

type WatchAreaItem = {
  id: number;
  name: string;
  displayLabel: string;
  coordinateLabel: string;
  state: string;
  distanceKm: number;
  sourceLabel: string;
};

type ApiListResponse<T> = { results?: T[] };

type SafetyLevel = "low" | "guarded" | "elevated" | "high" | "critical";

type NearbyIncident = {
  id: number;
  title: string;
  incidentType: string;
  severity: string;
  confidence: string;
  status: string;
  summary: string;
  detectedAt: string;
  distanceKm: number;
  locationName: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

const RISK_STYLE: Record<SafetyLevel, { label: string; chip: string; border: string; dot: string; score: string }> = {
  low:      { label: "Low risk",  chip: "bg-emerald-500/10 text-emerald-300", border: "border-emerald-500/20", dot: "bg-emerald-400", score: "text-emerald-300" },
  guarded:  { label: "Guarded",   chip: "bg-cyan-500/10 text-cyan-300",       border: "border-cyan-500/20",    dot: "bg-cyan-400",    score: "text-cyan-300" },
  elevated: { label: "Elevated",  chip: "bg-amber-500/10 text-amber-300",     border: "border-amber-500/20",   dot: "bg-amber-400",   score: "text-amber-300" },
  high:     { label: "High risk", chip: "bg-orange-500/10 text-orange-300",   border: "border-orange-500/20",  dot: "bg-orange-400",  score: "text-orange-300" },
  critical: { label: "Critical",  chip: "bg-red-500/10 text-red-300",         border: "border-red-500/20",     dot: "bg-red-400",     score: "text-red-300" },
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function toNum(v: number | string | null | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getList<T>(payload: T[] | ApiListResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function relTime(v?: string | null): string {
  if (!v) return "Now";
  const m = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 60000));
  if (m < 1) return "Now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function scoreToLevel(s: number): SafetyLevel {
  return s >= 90 ? "critical" : s >= 70 ? "high" : s >= 45 ? "elevated" : s >= 20 ? "guarded" : "low";
}

function sevWeight(s: string) { return s === "critical" ? 5 : s === "high" ? 3.5 : s === "medium" ? 2 : 1; }
function confWeight(c: string) {
  switch (confidenceTier(c)) {
    case "verified":
      return 1.25;
    case "probable":
      return 1.1;
    case "emerging":
      return 0.95;
    default:
      return 0.8;
  }
}

type ConfidenceTier = "raw" | "emerging" | "probable" | "verified";

const CONFIDENCE_STYLE: Record<ConfidenceTier, { label: string; chip: string; border: string; dot: string }> = {
  raw: { label: "Unverified", chip: "bg-slate-500/10 text-slate-300", border: "border-slate-500/20", dot: "bg-slate-400" },
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

function confidenceRank(confidence: string): number {
  switch (confidenceTier(confidence)) {
    case "verified": return 3;
    case "probable": return 2;
    case "emerging": return 1;
    default: return 0;
  }
}
function incidentTypeWeight(type: string) {
  const normalized = normalizeReportType(type);
  switch (normalized) {
    case "kidnapping":
      return 1.45;
    case "armed_robbery":
      return 1.25;
    case "gunshots_heard":
      return 1.2;
    case "unsafe_route":
      return 1;
    case "fire_outbreak":
      return 0.95;
    case "medical_emergency":
      return 0.75;
    case "flooding":
      return 0.7;
    case "suspicious_activity":
      return 0.65;
    case "road_accident":
      return 0.55;
    case "road_obstruction":
      return 0.4;
    default:
      return 0.75;
  }
}
function freshWeight(v: string, nowTs: number) {
  const h = Math.max(0, (nowTs - new Date(v).getTime()) / 36e5);
  return h <= 6 ? 1.35 : h <= 24 ? 1 : h <= 72 ? 0.65 : h <= 168 ? 0.35 : 0.15;
}

function isActive(inc: IncidentRecord) {
  const s = inc.status.trim().toLowerCase();
  return s !== "closed" && s !== "resolved" && s !== "dismissed";
}

function levelSummary(level: SafetyLevel, area: string): string {
  const msgs: Record<SafetyLevel, string> = {
    critical: `Critical pressure near ${area}. Minimise movement and use SOS if needed.`,
    high:     `High-risk signals active near ${area}. Move with caution.`,
    elevated: `Elevated activity near ${area}. Verify routes before travelling.`,
    guarded:  `${area} is being monitored. Stay alert and keep notifications on.`,
    low:      `Conditions near ${area} are relatively calm right now.`,
  };
  return msgs[level];
}

function isAlertRelevantToState(alert: DashboardAlert, state: string, area: string) {
  if (!state || state.toLowerCase() === "unknown") {
    return false;
  }
  const alertState = (alert.locationState ?? "").trim().toLowerCase();
  if (alertState) {
    return alertState === state.toLowerCase();
  }
  const haystack = `${alert.title} ${alert.body} ${alert.meta}`.toLowerCase();
  return haystack.includes(state.toLowerCase()) || haystack.includes(area.toLowerCase());
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = {
  menu: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  chevron: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  shield: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 3l7 4v5c0 5-3.5 8.3-7 9-3.5-.7-7-4-7-9V7l7-4Z" /><path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  ),
  report: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8M8 12h8" />
    </svg>
  ),
  warning: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M10.3 4.3 2.1 18a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  ),
  pin: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" /><circle cx="12" cy="10" r="2.1" />
    </svg>
  ),
  map: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <polygon points="3 7 9 4 15 7 21 4 21 17 15 20 9 17 3 20" /><line x1="9" y1="4" x2="9" y2="17" /><line x1="15" y1="7" x2="15" y2="20" />
    </svg>
  ),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sidebar({
  open, onClose, activeIdx, onNav, onLogout, navItems,
}: {
  open: boolean; onClose: () => void; activeIdx: number; onNav: (i: number) => void; onLogout: () => void; navItems: NavItem[];
}) {
  return (
    <>
      {open && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/[0.06] bg-[#070D1A]/98 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="border-b border-white/[0.06] px-6 py-7">
          <h1 className="text-xl font-bold tracking-tight text-cyan-400">GeoPulse AI</h1>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">Safety Intelligence</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-3">
          {navItems.map((item, i) => (
            <button key={item.label} onClick={() => { onNav(i); onClose(); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${activeIdx === i ? "bg-cyan-500/10 text-cyan-300" : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${activeIdx === i ? "bg-cyan-400" : "bg-white/15"}`} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-white/[0.06] p-3">
          <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/40 transition hover:bg-white/[0.04] hover:text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

function SafetyRing({ score, level }: { score: number; level: SafetyLevel }) {
  const cfg = RISK_STYLE[level];
  const r = 36, circ = 2 * Math.PI * r;
  const fill = circ - (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={fill}
          strokeLinecap="round" transform="rotate(-90 48 48)"
          className={`transition-all duration-700 ${
            level === "critical" ? "stroke-red-400" : level === "high" ? "stroke-orange-400" :
            level === "elevated" ? "stroke-amber-400" : level === "guarded" ? "stroke-cyan-400" : "stroke-emerald-400"
          }`}
        />
      </svg>
      <div className="absolute text-center">
        <p className={`text-2xl font-bold tabular-nums leading-none ${cfg.score}`}>{score}</p>
        <p className="text-[9px] uppercase tracking-widest text-white/30 mt-0.5">score</p>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: SafetyLevel }) {
  const cfg = RISK_STYLE[tone];
  return (
    <div className={`flex flex-col items-start justify-between gap-1.5 rounded-xl border ${cfg.border} bg-white/[0.03] px-2.5 py-2 sm:flex-row sm:items-center sm:px-3 sm:py-2.5`}>
      <span className="text-[9px] sm:text-xs text-white/45">{label}</span>
      <span className={`text-xs sm:text-sm font-bold tabular-nums ${value > 0 ? cfg.score : "text-white/60"}`}>{value}</span>
    </div>
  );
}

function ActionButton({
  label, sublabel, icon, onClick, variant = "default",
}: {
  label: string; sublabel: string; icon: React.ReactNode; onClick: () => void; variant?: "default" | "danger";
}) {
  const base = variant === "danger"
    ? "border-red-500/20 bg-red-500/8 hover:bg-red-500/14"
    : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]";
  const iconBg = variant === "danger" ? "bg-red-500/15 text-red-300" : "bg-white/[0.06] text-white/60";

  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 sm:gap-3 rounded-2xl border ${base} px-3 py-3 sm:px-4 sm:py-3.5 text-left transition active:scale-[0.99]`}>
      <div className={`flex h-8 sm:h-9 w-8 sm:w-9 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-0.5 truncate text-[10px] sm:text-[11px] text-white/40">{sublabel}</p>
      </div>
      <span className="flex-shrink-0 text-white/20 hidden sm:block">{I.chevron}</span>
    </button>
  );
}

function IncidentCard({ inc, onClick }: { inc: NearbyIncident; onClick: () => void }) {
  const sev = inc.severity as SafetyLevel;
  const cfg = RISK_STYLE[sev] ?? RISK_STYLE.low;
  const confidence = CONFIDENCE_STYLE[confidenceTier(inc.confidence)];
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-2 text-left transition hover:border-cyan-500/20 hover:bg-white/[0.04] sm:p-3.5"
    >
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs sm:text-sm font-semibold text-white">{inc.title}</p>
          <p className="mt-0.5 truncate text-[9px] sm:text-[11px] text-white/35">{inc.locationName || "Mapped location"}</p>
        </div>
        <span className={`flex-shrink-0 rounded-full border px-1 sm:px-1.5 py-0.5 text-[8px] sm:text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${cfg.chip} ${cfg.border}`}>
          {inc.severity}
        </span>
      </div>
      {inc.summary && <p className="mt-1 sm:mt-2 line-clamp-1 sm:line-clamp-2 text-[11px] sm:text-xs leading-4 sm:leading-5 text-white/45 truncate">{inc.summary}</p>}
      <div className="mt-1 sm:mt-2 flex items-center gap-0.5 sm:gap-1.5 text-[8px] sm:text-[10px] text-white/30 truncate">
        <span className="flex-shrink-0">{formatReportType(normalizeReportType(inc.incidentType))}</span>
        <span className="flex-shrink-0">·</span>
        <span className="flex-shrink-0">{inc.distanceKm.toFixed(1)}km</span>
        <span className="flex-shrink-0">·</span>
        <span className="flex-shrink-0">{relTime(inc.detectedAt)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-widest text-white/35">
        <span className={`h-1.5 w-1.5 rounded-full ${confidence.dot}`} />
        <span className={`rounded-full border px-1.5 py-0.5 ${confidence.chip} ${confidence.border}`}>{confidence.label}</span>
      </div>
      <div className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80">Open detail</div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const role = getCurrentRole();

  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = useMemo<NavItem[]>(
    () => (isAnalystRole(role) ? INTERNAL_NAV_ITEMS : getPublicNavItems(role)),
    [role],
  );

  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("geopulse.token"),
  );
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [watchZones, setWatchZones] = useState<WatchZoneRecord[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(Boolean(authToken));

  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(() => {
    const stored = getStoredUserLocation();
    return stored ? { latitude: stored.latitude, longitude: stored.longitude } : null;
  });
  const [locationDenied, setLocationDenied] = useState(() =>
    typeof window === "undefined" ? false : !navigator.geolocation,
  );

  const anchor = useMemo(
    () => position ?? { latitude: 0, longitude: 0 },
    [position],
  );
  const [scoreNow] = useState(() => Date.now());

  const currentArea = useMemo(() => {
    if (!position) {
      return { label: "Unknown location", state: "Unknown", latitude: 0, longitude: 0 };
    }
    return resolveNearestHub(position.latitude, position.longitude);
  }, [position]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let active = true;
    void requestAndStoreUserLocation({ timeoutMs: 10000, enableHighAccuracy: true }).then((next) => {
      if (!active) return;
      if (!next) {
        setLocationDenied(true);
        return;
      }
      setPosition({ latitude: next.latitude, longitude: next.longitude });
      setLocationDenied(false);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    const h = { Authorization: `Token ${authToken}` };

    async function load() {
      setLoading(true);
      try {
        const alertsUrl = new URL(`${API_BASE_URL}/alerts/`);
        if (position) {
          alertsUrl.searchParams.set("state", currentArea.state);
        }

        const [iRes, wRes, aRes] = await Promise.all([
          fetch(`${API_BASE_URL}/incidents/`, { headers: h }),
          fetch(`${API_BASE_URL}/watch-zones/`, { headers: h }),
          position
            ? fetch(alertsUrl.toString(), { headers: h })
            : Promise.resolve(null),
        ]);
        if (!active) return;
        const [iData, wData, aData] = await Promise.all([
          iRes.json(),
          wRes.json(),
          aRes ? aRes.json() : Promise.resolve(null),
        ]);
        if (iRes.ok) setIncidents(getList(iData));
        if (wRes.ok) setWatchZones(getList(wData));
        if (aRes?.ok) {
          setAlerts(
            getList(aData as ApiListResponse<Record<string, unknown>>).map((a, i) => {
              const sev = String(a.severity ?? "info").toLowerCase();
              return {
                id: Number(a.id ?? i + 1),
                level: sev === "critical" ? "Critical" : sev === "high" ? "Warning" : "Info",
                triggeredAt: String(a.triggered_at ?? ""),
                title: String(a.title ?? "Alert"),
                body: String(a.message ?? ""),
                meta: String(a.status ?? "OPEN").toUpperCase(),
                locationName: String(a.location_name ?? a.locationName ?? ""),
                locationState: String(a.location_state ?? a.locationState ?? ""),
                locationLatitude: toNullableNumber(a.location_latitude ?? a.locationLatitude),
                locationLongitude: toNullableNumber(a.location_longitude ?? a.locationLongitude),
              };
            }),
          );
        } else if (!position) {
          setAlerts([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [authToken, position, currentArea.state]);

  const nearbyIncidents = useMemo(() => {
    if (!position) return [];

    return incidents
      .flatMap((inc): NearbyIncident[] => {
        if (!isActive(inc)) return [];
        const lat = toNum(inc.latitude), lng = toNum(inc.longitude);
        if (lat === null || lng === null) return [];
        if (stateForCoordinates(lat, lng) !== currentArea.state) return [];
        return [{
          id: inc.id, title: inc.title, incidentType: inc.incident_type,
          severity: inc.severity, confidence: inc.confidence, status: inc.status,
          summary: inc.summary, detectedAt: inc.detected_at || inc.created_at,
          distanceKm: haversineKm(anchor.latitude, anchor.longitude, lat, lng),
          locationName: inc.location_name,
        }];
      })
      .sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence) || a.distanceKm - b.distanceKm)
      .slice(0, 5);
  }, [anchor, currentArea.state, incidents, position]);

  const nearbyZones = useMemo(() => {
    if (!position) return [];

    return watchZones
      .flatMap((z) => {
        const lat = toNum(z.centroid_latitude), lng = toNum(z.centroid_longitude), score = toNum(z.current_risk_score);
        if (lat === null || lng === null || score === null) return [];
        if (stateForCoordinates(lat, lng) !== currentArea.state) return [];
        return [{ id: z.id, name: z.name, level: z.current_risk_level, score, distanceKm: haversineKm(anchor.latitude, anchor.longitude, lat, lng) }];
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [anchor, currentArea.state, position, watchZones]);

  const nearbyWatchAreas = useMemo<WatchAreaItem[]>(() => {
    const isUserCreatedWatchZone = (area: WatchZoneRecord) =>
      area.metadata?.created_from === "live_intelligence_pin" && area.metadata?.pin_action === "watch_zone";

    const exactLabel = (area: WatchZoneRecord) => {
      const lat = toNum(area.centroid_latitude);
      const lng = toNum(area.centroid_longitude);
      if (isUserCreatedWatchZone(area) && lat !== null && lng !== null) {
        return area.name?.trim() || `${resolveNearestHub(lat, lng).label}, ${resolveNearestHub(lat, lng).state}`;
      }
      return area.name;
    };

    return watchZones
      .flatMap((area) => {
        const lat = toNum(area.centroid_latitude);
        const lng = toNum(area.centroid_longitude);
        if (!isUserCreatedWatchZone(area)) return [];
        const sourceLabel = "User-defined";
        const state = area.metadata?.location_state || (lat !== null && lng !== null ? stateForCoordinates(lat, lng) : "Active");
        return [{
          id: area.id,
          name: area.name,
          displayLabel: exactLabel(area),
          coordinateLabel: lat !== null && lng !== null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "",
          state,
          distanceKm: position && lat !== null && lng !== null ? haversineKm(anchor.latitude, anchor.longitude, lat, lng) : 0,
          sourceLabel,
        }];
      })
      .sort((a, b) => {
        if (a.sourceLabel !== b.sourceLabel) return a.sourceLabel === "User-defined" ? -1 : 1;
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 6);
  }, [anchor, position, watchZones]);

  const stateAlerts = useMemo(
    () => {
      if (!position) return [];
      return alerts.filter((alert) => isAlertRelevantToState(alert, currentArea.state, currentArea.label));
    },
    [alerts, currentArea.label, currentArea.state, position],
  );

  const severeRecentIncidentCount = useMemo(
    () =>
      nearbyIncidents.filter((incident) => {
        const ageHours = Math.max(
          0,
          (scoreNow - new Date(incident.detectedAt).getTime()) / 36e5,
        );
        return (
          (incident.severity === "high" || incident.severity === "critical") &&
          ageHours <= 72
        );
      }).length,
    [nearbyIncidents, scoreNow],
  );

  const highZoneCount = useMemo(
    () =>
      nearbyZones.filter(
        (zone) => zone.level.includes("high") || zone.level.includes("critical"),
      ).length,
    [nearbyZones],
  );

  const safetyScore = useMemo(() => {
    const incP = nearbyIncidents.reduce((s, i) => {
      const prox = Math.max(0.25, 1 - i.distanceKm / 40);
      return (
        s +
        sevWeight(i.severity) *
          incidentTypeWeight(i.incidentType) *
          confWeight(i.confidence) *
          freshWeight(i.detectedAt, scoreNow) *
          prox
      );
    }, 0);
    const zoneP = nearbyZones.reduce(
      (s, z) => s + (z.score / 100) * 4.2 * Math.max(0.3, 1 - z.distanceKm / 50),
      0,
    );
    const feedP = stateAlerts.filter((a) => a.level !== "Info").length * 1.1;
    const incidentVolumeFactor =
      nearbyIncidents.length <= 1
        ? 0.58
        : nearbyIncidents.length === 2
          ? 0.76
          : nearbyIncidents.length === 3
            ? 0.9
            : 1;
    return Math.min(
      100,
      Math.round(incP * 7.5 * incidentVolumeFactor + zoneP * 8 + feedP * 1.5),
    );
  }, [nearbyIncidents, nearbyZones, scoreNow, stateAlerts]);

  const level = useMemo(() => {
    const baseLevel = scoreToLevel(safetyScore);
    if (baseLevel !== "critical") {
      return baseLevel;
    }
    if (severeRecentIncidentCount >= 3 || highZoneCount >= 2) {
      return "critical";
    }
    return "high";
  }, [highZoneCount, safetyScore, severeRecentIncidentCount]);
  const cfg = RISK_STYLE[level];
  const attentionCount = stateAlerts.filter((a) => a.level !== "Info").length;

  const handleLogout = useCallback(() => {
    localStorage.removeItem("geopulse.token");
    localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }, []);

  const handleTurnOnLocation = useCallback(async () => {
    const next = await requestAndStoreUserLocation({ timeoutMs: 10000, enableHighAccuracy: true });
    if (!next) {
      setLocationDenied(true);
      return;
    }

    setPosition({ latitude: next.latitude, longitude: next.longitude });
    setLocationDenied(false);
  }, []);

  const nav = useCallback((i: number) => {
    const next = navItems[i];
    if (next) {
      router.push(next.path);
    }
  }, [navItems, router]);

  if (!mounted) return null;

  const locationLabel = position
    ? `${currentArea.label} · ${position.latitude.toFixed(3)}, ${position.longitude.toFixed(3)}`
    : "Location access is off";

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(6,182,212,0.05),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(255,82,82,0.04),transparent)]" />

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard"
        onNavigate={(path) => router.push(path)}
        onLogout={handleLogout}
        role={role}
      />

      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#060B16]/90 px-4 backdrop-blur-xl sm:px-6">
          <button aria-label="Open menu" onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 lg:hidden">
            {I.menu}
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.dot}`} />
            <span className="truncate text-sm text-white/55">{locationLabel}</span>
            {locationDenied && <span className="hidden flex-shrink-0 text-[10px] text-white/25 sm:inline">· manual</span>}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${cfg.chip} ${cfg.border}`}>
              {cfg.label}
            </span>
          </div>
        </header>

        <main className="space-y-3 sm:space-y-4 px-3 py-3 sm:px-6 lg:px-8">

          {locationDenied ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-amber-200">
                  Location access is off. Turn it on to get precise nearby alerts and safer route intelligence.
                </p>
                <button
                  type="button"
                  onClick={() => void handleTurnOnLocation()}
                  className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-amber-100 transition hover:bg-amber-300/20"
                >
                  Turn on location access
                </button>
              </div>
            </div>
          ) : null}

          {/* ── Safety status card ── */}
          <div className={`rounded-3xl border ${cfg.border} bg-[#08101F]/90 p-3 sm:p-5`}>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex-shrink-0 scale-75 sm:scale-100 origin-top">
                <SafetyRing score={safetyScore} level={level} />
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left sm:pt-1">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/35">Current area safety</p>
                <h1 className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-white">{currentArea.label}, {currentArea.state}</h1>
                <p className="mt-1.5 text-xs leading-5 text-white/50">{levelSummary(level, currentArea.label)}</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatPill label="Nearby alerts" value={nearbyIncidents.length} tone={nearbyIncidents.length > 0 ? "elevated" : "low"} />
              <StatPill label="Risk zones" value={nearbyZones.length} tone={highZoneCount > 0 ? "high" : "guarded"} />
              <StatPill label="Feed alerts" value={attentionCount} tone={attentionCount > 0 ? "elevated" : "low"} />
            </div>
          </div>

          {/* ── Quick actions ── */}
          <div className="space-y-1.5 sm:space-y-2">
            <p className="px-1 text-[9px] sm:text-[10px] uppercase tracking-widest text-white/30">Quick actions</p>
            <ActionButton label="Submit a report" sublabel="Log incident type, location, and detail" icon={I.report} onClick={() => nav(2)} />
            <ActionButton label="Check route safety" sublabel="Safer corridors, risk segments, best timing" icon={I.shield} onClick={() => nav(3)} />
            <ActionButton label="Open live map" sublabel="Incidents, watch zones, and heatmap" icon={I.map} onClick={() => nav(1)} />
            <ActionButton label="Emergency · SOS" sublabel="Call 112 immediately" icon={I.warning} onClick={() => (window.location.href = "tel:112")} variant="danger" />
          </div>

          {/* ── Two-column on desktop: incidents + zones ── */}
          <div className="grid w-full gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

            {/* Verified incidents */}
            <div className="min-w-0 rounded-3xl border border-white/[0.06] bg-[#08101F]/90 p-3 sm:p-5">
              <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/30">Nearby alerts by confidence</p>
                  <h2 className="mt-0.5 text-sm sm:text-base font-semibold text-white">Live around you</h2>
                </div>
                <button onClick={() => nav(1)} className="hidden sm:flex flex-shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/50 transition hover:text-cyan-300">
                  View map
                </button>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />)}
                </div>
              ) : nearbyIncidents.length > 0 ? (
                <div className="space-y-1.5 sm:space-y-2">
                  {nearbyIncidents.map((inc) => (
                    <IncidentCard
                      key={inc.id}
                      inc={inc}
                      onClick={() => router.push(`/dashboard/live-intelligence?incident=${inc.id}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/[0.08] p-3 sm:p-4 text-center text-xs text-white/30">
                  No nearby alerts in your current area
                </div>
              )}
            </div>

            {/* Watch zones + location info */}
            <div className="min-w-0 space-y-3 sm:space-y-4">
              <div className="min-w-0 rounded-3xl border border-white/[0.06] bg-[#08101F]/90 p-3 sm:p-5">
                <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/30">Nearby risk zones</p>
                    <h2 className="mt-0.5 text-sm sm:text-base font-semibold text-white">Area watch list</h2>
                  </div>
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] text-white/40">
                    {nearbyZones.length} active
                  </span>
                </div>

                {nearbyZones.length > 0 ? (
                  <div className="space-y-1 sm:space-y-2">
                    {nearbyZones.map((z) => {
                      const zl = scoreToLevel(z.score);
                      const zcfg = RISK_STYLE[zl];
                      return (
                          <div key={z.id} className="flex min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 py-2 sm:gap-3 sm:px-3.5 sm:py-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs sm:text-sm font-semibold text-white">{z.name}</p>
                            <p className="text-[8px] sm:text-[11px] text-white/35 truncate">{z.distanceKm.toFixed(1)}km · {z.score.toFixed(0)}</p>
                          </div>
                          <span className={`flex-shrink-0 rounded-full border px-1 sm:px-2 py-0.5 text-[8px] sm:text-[10px] uppercase tracking-wider whitespace-nowrap ${zcfg.chip} ${zcfg.border}`}>
                            {z.level.replace(/_/g, " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/[0.08] p-3 text-center text-xs text-white/30">
                    No active risk zones nearby
                  </div>
                )}
              </div>

              <div className="min-w-0 rounded-3xl border border-white/[0.06] bg-[#08101F]/90 p-3 sm:p-5">
                <div className="mb-2 sm:mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-cyan-300/60">Watch areas</p>
                    <h2 className="mt-0.5 text-sm sm:text-base font-semibold text-white">User-defined watch areas</h2>
                  </div>
                  <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] text-cyan-200">
                    {nearbyWatchAreas.length} active
                  </span>
                </div>

                {nearbyWatchAreas.length > 0 ? (
                  <div className="space-y-1 sm:space-y-2">
                    {nearbyWatchAreas.map((area) => (
                      <div key={area.id} className="flex min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-2 py-2 sm:gap-3 sm:px-3.5 sm:py-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs sm:text-sm font-semibold text-white">{area.displayLabel}</p>
                          <p className="text-[8px] sm:text-[11px] text-white/35 truncate">{area.coordinateLabel}</p>
                          <p className="text-[8px] sm:text-[11px] text-white/25 truncate">{area.distanceKm.toFixed(1)}km · {area.state}</p>
                        </div>
                        <span className="flex-shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-1 sm:px-2 py-0.5 text-[8px] sm:text-[10px] uppercase tracking-wider whitespace-nowrap text-cyan-200">
                          {area.sourceLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/[0.08] p-3 text-center text-xs text-white/30">
                    No active watch areas nearby
                  </div>
                )}
              </div>

              {/* Location status */}
              <div className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 sm:px-4 py-2.5 sm:py-3.5">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${locationDenied ? "bg-white/20" : "bg-cyan-400"}`} />
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-white/30">
                    {locationDenied ? "Manual location" : "Live location"}
                  </p>
                </div>
                <p className="mt-1.5 text-sm text-white/60">{locationLabel}</p>
                <p className="mt-0.5 text-xs text-white/30">
                  {locationDenied
                    ? "Enable location for more precise area safety ranking."
                    : "Safety score is ranked around your current position."}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
