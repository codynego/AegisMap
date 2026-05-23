"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import {
  getCurrentRole,
  getPublicNavItems,
  isTrustedReporterRole,
} from "@/lib/access";
import {
  getStoredUserLocation,
  requestAndStoreUserLocation,
  resolveNearestHub,
} from "@/lib/user-location";

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertRecord = {
  id: number;
  severity: "critical" | "high" | "low" | string;
  status: string;
  title: string;
  message: string;
  triggered_at: string;
  location_name?: string;
  location_state?: string;
  location_latitude?: number | string | null;
  location_longitude?: number | string | null;
};

type ApiListResponse<T> = { results?: T[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getList<T>(payload: T[] | ApiListResponse<T>): T[] {
  return Array.isArray(payload) ? payload : (payload.results ?? []);
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

function severityConfig(severity: string) {
  if (severity === "critical")
    return {
      bar: "bg-red-500",
      badge: "bg-red-500/15 text-red-300 border-red-500/25",
      dot: "bg-red-400",
      border: "border-red-500/20",
      bg: "bg-red-500/5",
    };
  if (severity === "high")
    return {
      bar: "bg-orange-400",
      badge: "bg-orange-500/15 text-orange-300 border-orange-500/25",
      dot: "bg-orange-400",
      border: "border-orange-500/20",
      bg: "bg-orange-500/5",
    };
  return {
    bar: "bg-cyan-500",
    badge: "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
    dot: "bg-cyan-400",
    border: "border-cyan-500/15",
    bg: "bg-cyan-500/5",
  };
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isAlertInUserState(alert: AlertRecord, state: string, area: string) {
  const tState = state.trim().toLowerCase();
  if (!tState) return false;
  const alertState = (alert.location_state ?? "").trim().toLowerCase();
  if (alertState) return alertState === tState;
  const text = `${alert.title} ${alert.message}`.toLowerCase();
  return text.includes(tState) || (area ? text.includes(area.toLowerCase()) : false);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-white/35">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${accent ?? "text-white"}`}>{value}</span>
    </div>
  );
}

function AlertCard({ alert }: { alert: AlertRecord }) {
  const cfg = severityConfig(alert.severity);
  const isOpen = alert.status === "open" || alert.status === "acknowledged";

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border ${cfg.border} ${cfg.bg} p-4 transition hover:brightness-110`}
    >
      {/* severity bar */}
      <span className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${cfg.bar}`} />

      <div className="pl-3">
        {/* header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${cfg.badge}`}
            >
              {alert.severity}
            </span>
            {isOpen && (
              <span className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${cfg.dot}`} />
                {alert.status}
              </span>
            )}
            {!isOpen && (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30">
                {alert.status}
              </span>
            )}
          </div>
          <span className="shrink-0 text-[11px] text-white/35">{relativeTime(alert.triggered_at)}</span>
        </div>

        {/* title + message */}
        <h2 className="mt-2 text-sm font-semibold leading-snug text-white">{alert.title}</h2>
        <p className="mt-1 text-xs leading-5 text-white/55">{alert.message}</p>

        {/* location tag */}
        {alert.location_name && (
          <p className="mt-2 text-[10px] text-white/30">📍 {alert.location_name}</p>
        )}
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const role = getCurrentRole();
  const isTrusted = isTrustedReporterRole(role);
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState<boolean>(
    () => typeof window !== "undefined" && !navigator.geolocation,
  );
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(() => {
    const s = getStoredUserLocation();
    return s ? { latitude: s.latitude, longitude: s.longitude } : null;
  });
  const [authToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("geopulse.token") : null,
  );

  const currentArea = useMemo(() => {
    if (!position) return { label: "", state: "" };
    const hub = resolveNearestHub(position.latitude, position.longitude);
    return { label: hub.label, state: hub.state };
  }, [position]);

  // mount guard
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // request location
  useEffect(() => {
    if (typeof window === "undefined") return;
    let active = true;
    requestAndStoreUserLocation({ timeoutMs: 10000, enableHighAccuracy: true }).then((next) => {
      if (!active) return;
      if (!next) { setLocationDenied(true); return; }
      setPosition({ latitude: next.latitude, longitude: next.longitude });
      setLocationDenied(false);
    });
    return () => { active = false; };
  }, []);

  // fetch alerts
  useEffect(() => {
    if (!authToken) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        if (!position) { if (active) { setAlerts([]); setLoading(false); } return; }

        const url = new URL(`${API_BASE_URL}/alerts/`);
        url.searchParams.set("state", currentArea.state);

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Token ${authToken}` },
        });
        if (!res.ok || !active) return;

        const payload = await res.json();
        if (!active) return;

        const parsed: AlertRecord[] = getList(payload).map((item: unknown) => {
          const r = isRecord(item) ? item : {};
          return {
            id: Number(r.id ?? 0),
            severity: String(r.severity ?? "low"),
            status: String(r.status ?? "open"),
            title: String(r.title ?? "Alert"),
            message: String(r.message ?? ""),
            triggered_at: String(r.triggered_at ?? ""),
            location_name: String(r.location_name ?? ""),
            location_state: String(r.location_state ?? ""),
            location_latitude: toNullableNumber(r.location_latitude),
            location_longitude: toNullableNumber(r.location_longitude),
          };
        });

        setAlerts(
          parsed.filter((a) => isAlertInUserState(a, currentArea.state, currentArea.label)),
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [authToken, position, currentArea.label, currentArea.state]);

  const scopedAlerts = useMemo(
    () =>
      position
        ? alerts.filter((a) => isAlertInUserState(a, currentArea.state, currentArea.label))
        : [],
    [alerts, currentArea, position],
  );

  const openCount = useMemo(
    () => scopedAlerts.filter((a) => a.status === "open" || a.status === "acknowledged").length,
    [scopedAlerts],
  );
  const criticalCount = useMemo(
    () => scopedAlerts.filter((a) => a.severity === "critical").length,
    [scopedAlerts],
  );
  const resolvedCount = useMemo(
    () => scopedAlerts.filter((a) => a.status === "resolved").length,
    [scopedAlerts],
  );

  const handleTurnOnLocation = useCallback(async () => {
    const next = await requestAndStoreUserLocation({ timeoutMs: 10000, enableHighAccuracy: true });
    if (!next) { setLocationDenied(true); return; }
    setPosition({ latitude: next.latitude, longitude: next.longitude });
    setLocationDenied(false);
  }, []);

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(6,182,212,0.05),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(255,82,82,0.04),transparent)]" />

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/alerts"
        onNavigate={(path) => router.push(path)}
        onLogout={handleLogout}
        role={role}
      />

      <div className="lg:ml-64">
        {/* ── Header ── */}
        <header className="sticky top-0 z-30 flex h-13 items-center justify-between border-b border-white/[0.06] bg-[#070D1A]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 lg:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-300">Live Alerts</span>
            </span>
            {currentArea.label && (
              <span className="truncate text-xs text-white/35">· {currentArea.label}</span>
            )}
          </div>

          {isTrusted && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Reporter
            </span>
          )}
        </header>

        {/* ── Main ── */}
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full space-y-4">

          {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Open" value={openCount} />
              <StatCard label="Critical" value={criticalCount} accent={criticalCount > 0 ? "text-red-400" : undefined} />
              <StatCard label="Resolved" value={resolvedCount} accent="text-emerald-400" />
            </div>

          {/* Reporter notice */}
            {isTrusted && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-xs text-emerald-200">
                Reporter tools active — use the <strong>Verification Queue</strong> tab to confirm nearby reports.
              </div>
            )}

          {/* Alert list */}
            <div className="space-y-3">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-white/30">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
                </div>
              )}

              {!loading && !position && (
                <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/60 p-5 text-center">
                  <p className="text-sm text-white/40">
                    {locationDenied
                      ? "Location access is denied. Enable it in your browser to see local alerts."
                      : "Enable location to see alerts near you."}
                  </p>
                  {!locationDenied && (
                    <button
                      type="button"
                      onClick={() => void handleTurnOnLocation()}
                      className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-400/20"
                    >
                      Enable location
                    </button>
                  )}
                </div>
              )}

              {!loading && position && scopedAlerts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/60 p-5 text-center text-sm text-white/30">
                  No active alerts in your area right now.
                </div>
              )}

              {scopedAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}