"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole, getDefaultRouteForRole, isTrustedReporterRole, isAnalystRole } from "@/lib/access";
import {
  getStoredUserLocation,
  haversineKm,
  requestAndStoreUserLocation,
  stateForCoordinates,
} from "@/lib/user-location";

type SignalRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: string;
  severity: string;
  location_name: string;
  latitude: number | string | null;
  longitude: number | string | null;
  created_at: string;
};

type IncidentQueueRecord = {
  id: number | string;
  title: string;
  summary?: string | null;
  incident_type: string;
  confidence: string;
  severity: string;
  location_name?: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  detected_at?: string | null;
  created_at: string;
};

type ApiListResponse<T> = {
  results?: T[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

function getList<T>(payload: T[] | ApiListResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function relativeTime(value?: string | null) {
  if (!value) return "Now";
  const then = new Date(value).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function VerificationQueuePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(() =>
    typeof window === "undefined" ? false : !navigator.geolocation,
  );
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(() => {
    const stored = getStoredUserLocation();
    return stored ? { latitude: stored.latitude, longitude: stored.longitude } : null;
  });
  const role = getCurrentRole();
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token"),
  );
  const queueMode = isAnalystRole(role) ? "analyst" : "community";

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // allow trusted reporters or analysts/admins
    if (!isTrustedReporterRole(role) && !isAnalystRole(role)) {
      window.location.replace(getDefaultRouteForRole(role));
      return;
    }
  }, [mounted, role]);

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

    async function load() {
      setLoading(true);
      try {
        if (isTrustedReporterRole(role)) {
          const response = await fetch(`${API_BASE_URL}/signals/?verification_queue=true`, {
            headers: { Authorization: `Token ${authToken}` },
          });
          if (!response.ok || !active) return;
          const payload = await response.json();
          if (!active) return;
          setSignals(getList(payload));
        } else if (isAnalystRole(role)) {
          const response = await fetch(`${API_BASE_URL}/incidents/?verification_queue=true`, {
            headers: { Authorization: `Token ${authToken}` },
          });
          if (!response.ok || !active) return;
          const payload = await response.json();
          if (!active) return;
          // normalize incidents into SignalRecord-like shape for display
          const items = (Array.isArray(payload) ? payload : payload.results ?? []).map((it: IncidentQueueRecord) => ({
            id: String(it.id),
            title: it.title,
            description: it.summary ?? "",
            category: it.incident_type,
            confidence: it.confidence,
            severity: it.severity,
            location_name: it.location_name ?? "",
            latitude: it.latitude ?? null,
            longitude: it.longitude ?? null,
            created_at: it.detected_at ?? it.created_at,
          }));
          setSignals(items);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authToken, role]);

  const handleVote = useCallback(
    async (signalId: string, response: "confirm" | "deny" | "unsure") => {
      if (!authToken) return;
      setSubmittingId(signalId);
      try {
        if (isTrustedReporterRole(role)) {
          await fetch(`${API_BASE_URL}/signals/${signalId}/submit_verification/`, {
            method: "POST",
            headers: {
              Authorization: `Token ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ response }),
          });
        } else if (isAnalystRole(role)) {
          await fetch(`${API_BASE_URL}/incidents/${signalId}/submit_verification/`, {
            method: "POST",
            headers: {
              Authorization: `Token ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ response }),
          });
        }
        setSignals((current) => current.filter((s) => s.id !== signalId));
      } finally {
        setSubmittingId(null);
      }
    },
    [authToken, role],
  );

  const handleTurnOnLocation = useCallback(async () => {
    const next = await requestAndStoreUserLocation({ timeoutMs: 10000, enableHighAccuracy: true });
    if (!next) {
      setLocationDenied(true);
      return;
    }

    setPosition({ latitude: next.latitude, longitude: next.longitude });
    setLocationDenied(false);
  }, []);

  const filteredSignals = useMemo(() => {
    if (!position) return [];
    const targetState = stateForCoordinates(position.latitude, position.longitude);

    return signals
      .flatMap((signal) => {
        const latitude = typeof signal.latitude === "number" ? signal.latitude : Number(signal.latitude);
        const longitude = typeof signal.longitude === "number" ? signal.longitude : Number(signal.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
        if (stateForCoordinates(latitude, longitude) !== targetState) return [];

        const distanceKm = haversineKm(position.latitude, position.longitude, latitude, longitude);
        if (distanceKm > 120) return [];
        return [{ ...signal, distanceKm }];
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [position, signals]);

  if (!mounted || (!isTrustedReporterRole(role) && !isAnalystRole(role))) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(6,182,212,0.05),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(255,82,82,0.04),transparent)]" />

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/verification-queue"
        onNavigate={(path) => router.push(path)}
        onLogout={() => {
          window.localStorage.removeItem("geopulse.token");
          window.localStorage.removeItem("geopulse.user");
          window.location.assign("/login");
        }}
        role={role}
        subtitle={queueMode === "analyst" ? "Analyst Verification" : "Community Reporter Network"}
      />

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#060B16]/90 px-4 backdrop-blur-xl sm:px-6">
          <button
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
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" />
            <span className="truncate text-sm text-white/55">Verification Queue</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Community
            </span>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full space-y-5">
            <div className="rounded-3xl border border-emerald-500/20 bg-[#08101F]/90 p-5">
              <p className="text-[10px] uppercase tracking-widest text-emerald-300">Verification queue</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                {queueMode === "analyst" ? "Review nearby incidents" : "Help confirm nearby community reports"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                {queueMode === "analyst"
                  ? "Analyst votes are weighted higher and can move incidents toward approval or dismissal."
                  : "Community reporters help strengthen weighted consensus. Your confirmations carry more influence than a standard public vote."}
              </p>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-5 text-sm text-white/45">
                Loading reports needing confirmation...
              </div>
            ) : null}

            {!loading && !position ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/80 p-5 text-sm text-white/35">
                <p>
                  Enable location access to view reports around you.
                  {locationDenied ? " Location access is currently denied." : ""}
                </p>
                <button
                  type="button"
                  onClick={() => void handleTurnOnLocation()}
                  className="mt-3 rounded-lg border border-cyan-400/35 bg-cyan-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  Turn on location access
                </button>
              </div>
            ) : null}

            {!loading && position && filteredSignals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/80 p-5 text-sm text-white/35">
                No nearby unconfirmed reports are waiting in your queue right now.
              </div>
            ) : null}

            <div className="space-y-4">
              {filteredSignals.map((signal) => (
                <article key={signal.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/35">
                        {signal.confidence} confidence · {signal.severity} severity
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-white">{signal.title}</h2>
                    </div>
                    <span className="text-xs text-white/40">{relativeTime(signal.created_at)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/75">{signal.description}</p>
                  <p className="mt-2 text-xs text-white/45">
                    {signal.location_name || "Mapped location pending label"} · {signal.distanceKm.toFixed(1)}km away
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={submittingId === signal.id}
                      onClick={() => void handleVote(signal.id, "confirm")}
                      className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-emerald-200"
                    >
                      Yes, true
                    </button>
                    <button
                      type="button"
                      disabled={submittingId === signal.id}
                      onClick={() => void handleVote(signal.id, "deny")}
                      className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-200"
                    >
                      No, false
                    </button>
                    <button
                      type="button"
                      disabled={submittingId === signal.id}
                      onClick={() => void handleVote(signal.id, "unsure")}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white/70"
                    >
                      Not sure
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
