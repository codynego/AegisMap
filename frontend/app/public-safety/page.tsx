"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardMap } from "@/components/dashboard-map";
import { formatReportType } from "@/lib/report-types";

type PublicIncident = {
  id: number;
  title: string;
  incident_type: string;
  severity: string;
  status: string;
  location_name: string;
  location_state: string;
  latitude: number | null;
  longitude: number | null;
  detected_at: string;
  summary: string;
  visibility_score: number;
};

type PublicAlert = {
  id: number;
  severity: string;
  status: string;
  title: string;
  message: string;
  location_name: string;
  location_state: string;
  location_latitude: number | null;
  location_longitude: number | null;
  triggered_at: string;
};

type PublicRouteAdvisory = {
  id: number;
  route_name: string;
  risk_level: string;
  incident_count: number;
  states: string[];
  summary: string;
  updated_at: string;
};

type PublicStats = {
  active_alerts: number;
  verified_incidents_today: number;
  monitored_routes: number;
  states_covered: number;
};

type PublicSafetyResponse = {
  generated_at: string;
  incidents: PublicIncident[];
  alerts: PublicAlert[];
  route_advisories: PublicRouteAdvisory[];
  stats: PublicStats;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

const PUBLIC_STATE_OPTIONS = [
  { label: "All states", value: "" },
  { label: "Lagos", value: "Lagos" },
  { label: "FCT Abuja", value: "FCT Abuja" },
  { label: "Edo", value: "Edo" },
  { label: "Ogun", value: "Ogun" },
  { label: "Oyo", value: "Oyo" },
  { label: "Delta", value: "Delta" },
  { label: "Rivers", value: "Rivers" },
  { label: "Kaduna", value: "Kaduna" },
  { label: "Kano", value: "Kano" },
  { label: "Enugu", value: "Enugu" },
  { label: "Ondo", value: "Ondo" },
  { label: "Osun", value: "Osun" },
];

function relativeTime(value: string) {
  const then = new Date(value).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function severityTone(severity: string) {
  if (severity === "critical") return "border-red-400/30 bg-red-500/10 text-red-200";
  if (severity === "high") return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  if (severity === "medium") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
}

function routeTone(level: string) {
  if (level === "High") return "border-red-400/30 bg-red-500/10 text-red-200";
  if (level === "Moderate") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
}

type ConfidenceTier = "raw" | "emerging" | "probable" | "verified";

const CONFIDENCE_STYLE: Record<ConfidenceTier, { label: string; chip: string; border: string; dot: string }> = {
  raw: { label: "Raw", chip: "bg-slate-500/10 text-slate-300", border: "border-slate-500/20", dot: "bg-slate-400" },
  emerging: { label: "Emerging", chip: "bg-amber-500/10 text-amber-300", border: "border-amber-500/20", dot: "bg-amber-400" },
  probable: { label: "Probable", chip: "bg-orange-500/10 text-orange-300", border: "border-orange-500/20", dot: "bg-orange-400" },
  verified: { label: "Verified", chip: "bg-emerald-500/10 text-emerald-300", border: "border-emerald-500/20", dot: "bg-emerald-400" },
};

function confidenceTierFromVisibility(score: number): ConfidenceTier {
  if (score >= 0.8) return "verified";
  if (score >= 0.6) return "probable";
  if (score >= 0.3) return "emerging";
  return "raw";
}

function ConfidenceBadge({ tier }: { tier: ConfidenceTier }) {
  const style = CONFIDENCE_STYLE[tier];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${style.chip} ${style.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

export default function PublicSafetyPage() {
  const [selectedState, setSelectedState] = useState("");
  const [routeQuery, setRouteQuery] = useState("");
  const [data, setData] = useState<PublicSafetyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${API_BASE_URL}/public/safety-summary/`);
        if (selectedState) {
          url.searchParams.set("state", selectedState);
        }
        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error("Unable to load public safety data right now.");
        }
        const payload = (await response.json()) as PublicSafetyResponse;
        if (!active) return;
        setData(payload);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load public safety data right now.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [selectedState]);

  const mapIncidents = useMemo(
    () =>
      (data?.incidents ?? [])
        .filter((incident) => incident.latitude !== null && incident.longitude !== null)
        .map((incident) => ({
          id: incident.id,
          title: incident.title,
          incidentType: incident.incident_type,
          severity: incident.severity,
          confidence: confidenceTierFromVisibility(incident.visibility_score),
          status: incident.status,
          summary: incident.summary,
          detectedAt: incident.detected_at,
          latitude: incident.latitude as number,
          longitude: incident.longitude as number,
          locationName: incident.location_name,
          visibilityScore: incident.visibility_score,
        })),
    [data],
  );

  const filteredRoutes = useMemo(() => {
    const advisories = data?.route_advisories ?? [];
    if (!routeQuery.trim()) {
      return advisories;
    }
    const needle = routeQuery.trim().toLowerCase();
    return advisories.filter((route) => route.route_name.toLowerCase().includes(needle));
  }, [data, routeQuery]);

  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-[#050914] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.11),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(248,193,91,0.08),transparent_28%)]" />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#050914]/85 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-10 xl:px-12">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">Public Safety Map</p>
            <h1 className="mt-1 text-lg font-semibold text-white">GeoPulse Public Safety View</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/75 transition hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-[#05111c] transition hover:bg-cyan-300"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="w-full px-4 pb-8 pt-10 sm:px-6 lg:px-10 xl:px-12">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-cyan-400/15 bg-[#08101f]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-300">Verified only</p>
              <h2 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Explore a limited, generalized view of public safety conditions.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                This page shows non-sensitive public advisories with progressive confidence labels. Exact locations, raw reports, operational layers, and high-risk intelligence stay behind login.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                  Verified public alerts
                </span>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                  Generalized locations
                </span>
                <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                  No raw intelligence
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Active public alerts</p>
                <p className="mt-3 text-4xl font-bold text-white">{stats?.active_alerts ?? "—"}</p>
              </div>
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Verified incidents today</p>
                <p className="mt-3 text-4xl font-bold text-white">{stats?.verified_incidents_today ?? "—"}</p>
              </div>
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Monitored routes</p>
                <p className="mt-3 text-4xl font-bold text-white">{stats?.monitored_routes ?? "—"}</p>
              </div>
              <div className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">States covered</p>
                <p className="mt-3 text-4xl font-bold text-white">{stats?.states_covered ?? "—"}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full px-4 pb-8 sm:px-6 lg:px-10 xl:px-12">
          <div className="mb-4 flex flex-col gap-4 rounded-3xl border border-white/[0.06] bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">State filter</p>
              <p className="mt-1 text-sm text-white/55">Browse generalized public safety conditions across all states or focus on one.</p>
            </div>
            <select
              value={selectedState}
              onChange={(event) => setSelectedState(event.target.value)}
              className="h-11 rounded-2xl border border-white/[0.08] bg-[#0A1020]/90 px-4 text-sm text-white outline-none"
            >
              {PUBLIC_STATE_OPTIONS.map((state) => (
                <option key={state.label} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-white/[0.06] bg-[#07101A]/90">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Live Public Safety Map</p>
              <p className="mt-1 text-sm text-white/55">
                Incident pins are generalized and sanitized. Heatmap intensity reflects verified public-safety activity only.
              </p>
            </div>
            <div className="h-[540px]">
              <DashboardMap
                selectedState={selectedState}
                zoom={2}
                incidents={mapIncidents}
                watchZones={[]}
                geofences={[]}
                showControlsUi={false}
                showHeatmap
                showIncidents
                showRiskZones={false}
                showGeofencing={false}
              />
            </div>
          </div>
        </section>

        <section className="grid w-full gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 xl:px-12">
          <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Recent public incidents</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Public confidence ladder</h3>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/40">
                {(data?.incidents ?? []).length} visible
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/45">
                  Loading public advisories...
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-200">
                  {error}
                </div>
              ) : (data?.incidents.length ?? 0) > 0 ? (
                data?.incidents.slice(0, 6).map((incident) => {
                  const tier = confidenceTierFromVisibility(incident.visibility_score);
                  return (
                    <article key={incident.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{incident.title}</h4>
                          <p className="mt-1 text-sm leading-6 text-white/60">{incident.summary}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${severityTone(incident.severity)}`}>
                          {incident.severity}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <ConfidenceBadge tier={tier} />
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/40">
                          {formatReportType(incident.incident_type)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
                        <span>{incident.location_name}</span>
                        <span>{relativeTime(incident.detected_at)}</span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/45">
                  No public advisories are available for this state right now.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Route safety</p>
                  <h3 className="mt-1 text-xl font-semibold text-white">Public route advisories</h3>
                </div>
                <input
                  value={routeQuery}
                  onChange={(event) => setRouteQuery(event.target.value)}
                  placeholder="Search route or corridor"
                  className="h-11 rounded-2xl border border-white/[0.08] bg-[#0A1020]/90 px-4 text-sm text-white placeholder:text-white/25 outline-none"
                />
              </div>

              <div className="mt-5 space-y-3">
                {filteredRoutes.length > 0 ? (
                  filteredRoutes.map((route) => (
                    <article key={route.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-white">{route.route_name}</h4>
                          <p className="mt-1 text-sm text-white/55">{route.summary}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${routeTone(route.risk_level)}`}>
                          {route.risk_level}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
                        <span>{route.incident_count} verified incident{route.incident_count === 1 ? "" : "s"}</span>
                        <span>{route.states.join(", ") || "General corridor"}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/45">
                    No matching public route advisories found.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-cyan-400/15 bg-[#08101f]/90 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Unlock more with login</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Advanced intelligence stays protected.</h3>
              <p className="mt-3 text-sm leading-7 text-white/60">
                Login to access live route intelligence, personalized alerts, report submission, verification queues, and deeper operational map layers.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-[#05111c] transition hover:bg-cyan-300"
                >
                  Login to continue
                </Link>
                <Link
                  href="/register"
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/75 transition hover:text-white"
                >
                  Create account
                </Link>
              </div>
              <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm text-white/45">
                Login to access live route intelligence and personalized alerts.
              </div>
            </div>

            <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Visible now</p>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/40">
                  {(data?.incidents ?? []).length} visible
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(data?.incidents ?? []).map((incident) => (
                  <article key={incident.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{incident.title}</h4>
                        <p className="mt-1 text-xs text-white/45">{formatReportType(incident.incident_type)}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${severityTone(incident.severity)}`}>
                        {incident.severity}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-white/50">{incident.location_name}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
