"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentRole } from "@/lib/access";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { haversineKm, resolveNearestHub, stateForCoordinates } from "@/lib/user-location";

type WatchZoneRecord = {
  id: number;
  name: string;
  current_risk_level: string;
  current_risk_score: number | string | null;
  centroid_latitude: number | string | null;
  centroid_longitude: number | string | null;
  status?: string;
  metadata?: {
    created_from?: string;
    pin_action?: string;
    location_state?: string;
    radius_meters?: number | string;
  };
};

type IncidentRecord = {
  id: number;
  status: string;
  severity: string;
  latitude: number | string | null;
  longitude: number | string | null;
  detected_at: string;
  created_at: string;
};

type ApiListResponse<T> = { results?: T[] };

type WatchAreaItem = {
  id: number;
  name: string;
  displayLabel: string;
  coordinateLabel: string;
  state: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  riskScore: number;
  riskLevel: string;
  incidentCount: number;
  distanceKm: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

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

function getList<T>(payload: T[] | ApiListResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function isActiveIncident(incident: IncidentRecord) {
  const status = String(incident.status ?? "").toLowerCase();
  return !(status.includes("resolved") || status.includes("closed") || status.includes("archived"));
}

function scoreClass(score: number) {
  if (score >= 80) return { chip: "border-red-500/30 bg-red-500/10 text-red-300", label: "Critical" };
  if (score >= 60) return { chip: "border-orange-500/30 bg-orange-500/10 text-orange-300", label: "High" };
  if (score >= 35) return { chip: "border-amber-500/30 bg-amber-500/10 text-amber-300", label: "Elevated" };
  return { chip: "border-cyan-500/25 bg-cyan-500/10 text-cyan-200", label: "Moderate" };
}

function formatLocationLabel(latitude: number, longitude: number) {
  const nearest = resolveNearestHub(latitude, longitude);
  return `${nearest.label}, ${nearest.state}`;
}

function watchAreaQuery(latitude: number, longitude: number, state: string, label: string) {
  const params = new URLSearchParams({
    watch_area_lat: latitude.toFixed(6),
    watch_area_lng: longitude.toFixed(6),
    watch_area_state: state,
    watch_area_label: label,
  });
  return `/dashboard/live-intelligence?${params.toString()}`;
}

export default function WatchAreaPage() {
  const router = useRouter();
  const role = getCurrentRole();
  const [token, setToken] = useState<string | null>(null);
  const [watchZones, setWatchZones] = useState<WatchZoneRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    setToken(typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token"));
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const currentToken = typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token");
    setToken(currentToken);
    if (!currentToken) {
      setWatchZones([]);
      setIncidents([]);
      setLoading(false);
      return;
    }

    let active = true;
    const headers = buildAuthHeaders(currentToken);

    async function load() {
      try {
        const [watchRes, incidentRes] = await Promise.all([
          fetch(`${API_BASE_URL}/watch-zones/`, { headers }),
          fetch(`${API_BASE_URL}/incidents/`, { headers }),
        ]);

        if (!active) return;

        if (watchRes.ok) {
          const data = await watchRes.json();
          setWatchZones(getList<WatchZoneRecord>(data));
        }

        if (incidentRes.ok) {
          const data = await incidentRes.json();
          setIncidents(getList<IncidentRecord>(data));
        }
      } catch {
        if (active) {
          setWatchZones([]);
          setIncidents([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [mounted]);

  const watchAreas = useMemo<WatchAreaItem[]>(() => {
    return watchZones
      .flatMap((zone) => {
        const latitude = toNumber(zone.centroid_latitude);
        const longitude = toNumber(zone.centroid_longitude);
        const riskScore = toNumber(zone.current_risk_score);
        if (latitude === null || longitude === null || riskScore === null) return [];
        if (zone.metadata?.created_from !== "live_intelligence_pin" || zone.metadata?.pin_action !== "watch_zone") return [];

        const radiusMeters = toNumber(zone.metadata?.radius_meters) ?? 1500;
        const state = zone.metadata?.location_state || stateForCoordinates(latitude, longitude);
        const incidentCount = incidents.filter((incident) => {
          if (!isActiveIncident(incident)) return false;
          const incLat = toNumber(incident.latitude);
          const incLng = toNumber(incident.longitude);
          if (incLat === null || incLng === null) return false;
          if (stateForCoordinates(incLat, incLng) !== state) return false;
          return haversineKm(latitude, longitude, incLat, incLng) <= Math.max(1.5, radiusMeters / 1000);
        }).length;

        return [{
          id: zone.id,
          name: zone.name,
          displayLabel: zone.name?.trim() || formatLocationLabel(latitude, longitude),
          coordinateLabel: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          state,
          latitude,
          longitude,
          radiusMeters,
          riskScore,
          riskLevel: zone.current_risk_level,
          incidentCount,
          distanceKm: 0,
        }];
      })
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        if (b.incidentCount !== a.incidentCount) return b.incidentCount - a.incidentCount;
        return a.displayLabel.localeCompare(b.displayLabel);
      });
  }, [incidents, watchZones]);

  const elevatedCount = useMemo(
    () => watchAreas.filter((area) => area.riskScore >= 60).length,
    [watchAreas],
  );

  const averageRisk = useMemo(() => {
    if (watchAreas.length === 0) return 0;
    const total = watchAreas.reduce((sum, area) => sum + area.riskScore, 0);
    return total / watchAreas.length;
  }, [watchAreas]);

  async function handleRemoveWatchArea(area: WatchAreaItem) {
    if (!token) return;

    const confirmed = window.confirm(`Remove ${area.displayLabel}? This will delete the watch area.`);
    if (!confirmed) return;

    setRemovingId(area.id);
    const previousZones = watchZones;
    setWatchZones((current) => current.filter((zone) => zone.id !== area.id));

    try {
      const response = await fetch(`${API_BASE_URL}/watch-zones/${area.id}/`, {
        method: "DELETE",
        headers: buildAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    } catch {
      setWatchZones(previousZones);
      window.alert("Could not remove that watch area right now.");
    } finally {
      setRemovingId(null);
    }
  }

  const roleLabel = role === "admin" || role === "analyst" ? "Operational access" : "Community access";

  return (
    <div className="min-h-screen bg-[#050912] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(6,182,212,0.08),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(255,183,77,0.07),transparent_40%)]" />

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/watch-area"
        onNavigate={(path) => router.push(path)}
        onLogout={() => {
          localStorage.removeItem("geopulse.token");
          localStorage.removeItem("geopulse.user");
          window.location.assign("/login");
        }}
        role={role}
      />

      <div className="relative min-h-screen lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#050912]/90 px-4 backdrop-blur-xl sm:px-6">
          <button
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 lg:hidden"
          >
            ☰
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" />
            <span className="truncate text-sm text-white/55">Watch Area</span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/live-intelligence")}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:border-cyan-400/30 hover:text-cyan-200"
          >
            Live map
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/[0.08] bg-[#08101F]/95 px-4 py-4 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">Watch Area</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Your watch zones</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                User-created watch areas appear here with risk score, incident count, and a direct link to open the exact area on live intelligence.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard/live-intelligence")}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:border-cyan-400/30 hover:text-cyan-200"
              >
                Open live intelligence
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:border-white/[0.16] hover:text-white"
              >
                Overview
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Watch areas</p>
              <p className="mt-1 text-2xl font-semibold text-white">{watchAreas.length}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Elevated zones</p>
              <p className="mt-1 text-2xl font-semibold text-white">{elevatedCount}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Average risk</p>
              <p className="mt-1 text-2xl font-semibold text-white">{averageRisk.toFixed(0)}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 py-5">
          {!mounted || loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-3xl border border-white/[0.06] bg-white/[0.03]" />
              ))}
            </div>
          ) : !token ? (
            <div className="rounded-3xl border border-white/[0.06] bg-[#08101F]/90 p-6 text-center">
              <p className="text-lg font-semibold text-white">Sign in to see your watch areas</p>
              <p className="mt-2 text-sm text-white/50">
                This page shows the watch areas you created and the live map link for each one.
              </p>
            </div>
          ) : watchAreas.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {watchAreas.map((area) => {
                const scoreMeta = scoreClass(area.riskScore);
                return (
                  <article
                    key={area.id}
                    className="rounded-3xl border border-white/[0.06] bg-[#08101F]/92 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.25)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">User created watch area</p>
                        <h2 className="mt-1 truncate text-lg font-semibold text-white">{area.displayLabel}</h2>
                        <p className="mt-1 text-xs text-white/35">{area.coordinateLabel}</p>
                        <p className="mt-1 text-xs text-white/30">{area.state}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${scoreMeta.chip}`}>
                        {scoreMeta.label}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">Risk score</p>
                        <p className="mt-1 text-xl font-semibold text-white">{area.riskScore.toFixed(0)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-white/30">Incidents</p>
                        <p className="mt-1 text-xl font-semibold text-white">{area.incidentCount}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-white/35">Radius {area.radiusMeters >= 1000 ? `${(area.radiusMeters / 1000).toFixed(1)} km` : `${area.radiusMeters} m`}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(watchAreaQuery(area.latitude, area.longitude, area.state, area.displayLabel))}
                          className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-500/20"
                        >
                          <span>View on map</span>
                          <span aria-hidden className="text-cyan-200">↗</span>
                        </button>
                        <button
                          type="button"
                          disabled={removingId === area.id}
                          onClick={() => void handleRemoveWatchArea(area)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60 transition hover:border-red-400/30 hover:text-red-200 disabled:cursor-wait disabled:opacity-60"
                        >
                          <span>{removingId === area.id ? "Removing" : "Remove"}</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/[0.08] bg-[#08101F]/70 p-8 text-center">
              <p className="text-lg font-semibold text-white">No watch areas yet</p>
              <p className="mt-2 text-sm text-white/45">
                Create a watch area from live intelligence and it will appear here automatically.
              </p>
              <button
                type="button"
                onClick={() => router.push("/dashboard/live-intelligence")}
                className="mt-4 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:border-cyan-400/30 hover:text-cyan-200"
              >
                Go to live intelligence
              </button>
            </div>
          )}
        </main>

        <footer className="pb-2 text-center text-[10px] uppercase tracking-[0.22em] text-white/25">
          {roleLabel}
        </footer>
      </div>
      </div>
    </div>
  );
}
