"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardMap } from "@/components/dashboard-map";
import { getCurrentRole, isAnalystRole } from "@/lib/access";
import { NIGERIA_STATE_NAMES } from "@/lib/nigeria-locations";
import { NIGERIA_STATE_CENTERS } from "@/lib/nigeria-locations";
import { toWeatherIntelligenceResponse, type WeatherContext, type WeatherOverlayPoint } from "@/lib/weather-intelligence";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

type Insight = { title: string; value: string; tone: string; note: string };

function toNumber(value: unknown) {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : null;
}

function overlayToWeatherContext(item: WeatherOverlayPoint | undefined): WeatherContext | null {
  if (!item) return null;

  const precipitation = item.precipitationMm ?? null;
  const visibilityKm = item.visibilityKm ?? null;
  const code = item.weatherCode ?? null;

  // Derive a human-friendly condition
  let condition = "Unknown";
  if (precipitation != null && precipitation >= 15) condition = "Heavy rain";
  else if (precipitation != null && precipitation >= 1) condition = "Rain";
  else if (code != null && [0, 1, 2, 3].includes(Number(code))) condition = "Clear / Sunny";
  else if (code != null && Number(code) >= 80) condition = "Showers";
  else condition = "Cloudy";

  return {
    label: item.label || item.title || "Weather context",
    severity: item.severity,
    condition,
    rainfallIntensity:
      precipitation == null
        ? "Unknown"
        : precipitation >= 15
          ? "Heavy"
          : precipitation >= 5
            ? "Moderate"
            : "Light",
    visibility:
      visibilityKm == null
        ? "Unknown"
        : visibilityKm < 3
          ? "Low"
          : visibilityKm < 7
            ? "Reduced"
            : "Normal",
    summary: item.summary || "Weather conditions available for this point.",
    alerts: item.summary ? [item.summary] : [],
    precipitationMm: precipitation ?? undefined,
    visibilityKm: visibilityKm ?? null,
    weatherCode: code ?? null,
  };
}

function computeInsights(forecasts: any[] | null): Insight[] {
  if (!forecasts || forecasts.length === 0) {
    return [
      { title: "Hotspot confidence", value: "—", tone: "bg-cyan-500/10 text-cyan-200 border-cyan-500/20", note: "No forecasts available" },
      { title: "Route risk", value: "—", tone: "bg-orange-500/10 text-orange-200 border-orange-500/20", note: "No route risk data" },
      { title: "Alert readiness", value: "—", tone: "bg-emerald-500/10 text-emerald-200 border-emerald-500/20", note: "No alerts" },
    ];
  }

  const avgConfidence = Math.round((forecasts.reduce((s: number, f: any) => s + (Number(f.confidence) || 0), 0) / forecasts.length) * 1) || 0;
  const avgProbability = Math.round((forecasts.reduce((s: number, f: any) => s + (Number(f.probability) || 0), 0) / forecasts.length) * 1) || 0;
  const highCount = forecasts.filter((f: any) => Number(f.probability) >= 75).length;

  const hotspotTone = avgConfidence >= 75 ? "bg-cyan-500/10 text-cyan-200 border-cyan-500/20" : "bg-cyan-500/6 text-white/80 border-cyan-500/15";
  const routeTone = avgProbability >= 70 ? "bg-orange-500/10 text-orange-200 border-orange-500/20" : "bg-emerald-500/10 text-emerald-200 border-emerald-500/20";
  const alertTone = highCount > 0 ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/20" : "bg-white/[0.02] text-white/60 border-white/[0.06]";

  return [
    { title: "Hotspot confidence", value: `${avgConfidence}%`, tone: hotspotTone, note: `${forecasts.length} active signals contributing` },
    { title: "Route risk", value: avgProbability >= 75 ? "High" : avgProbability >= 40 ? "Medium" : "Low", tone: routeTone, note: `Avg probability ${avgProbability}% across corridors` },
    { title: "Alert readiness", value: highCount > 0 ? `${highCount} alerts` : "None", tone: alertTone, note: highCount > 0 ? `Ready: ${highCount} high-probability forecasts` : "No immediate alerts" },
  ];
}

const TIME_HORIZONS = [
  { key: "1h", label: "1h" },
  { key: "6h", label: "6h" },
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
];

const SIGNALS = [
  { icon: "📡", label: "Increased reports", count: "×3" },
  { icon: "🌧️", label: "Heavy rainfall", count: "Radar" },
  { icon: "🚧", label: "Route blockages", count: "Active" },
  { icon: "📊", label: "Historical match", count: "92%" },
];

export default function AiPredictionsDemoPage() {
  const router = useRouter();
  const role = getCurrentRole();
  const [mounted, setMounted] = useState(false);
  const [forecasts, setForecasts] = useState<any[] | null>(null);
  const [loadingForecasts, setLoadingForecasts] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<any | null>(null);
  const [weatherContext, setWeatherContext] = useState<WeatherContext | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string>("");
  const [activeHorizon, setActiveHorizon] = useState("24h");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const canFilterByState = isAnalystRole(role);

  const insights = useMemo(() => computeInsights(forecasts), [forecasts]);
  const mapCenter = useMemo(() => {
    const latitude = toNumber(selectedForecast?.latitude);
    const longitude = toNumber(selectedForecast?.longitude);
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude, zoom: 8 };
    }
    if (selectedState && NIGERIA_STATE_CENTERS[selectedState]) {
      const center = NIGERIA_STATE_CENTERS[selectedState];
      return { latitude: center.latitude, longitude: center.longitude, zoom: 8.2 };
    }
    return { latitude: 8.6753, longitude: 9.082, zoom: 6.2 };
  }, [selectedForecast, selectedState]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    async function loadForecasts() {
      setLoadingForecasts(true);
      setForecastError(null);
      try {
        const token = typeof window !== "undefined" ? window.localStorage.getItem("geopulse.token") : null;
        const params = new URLSearchParams({ limit: "12" });
        if (canFilterByState && selectedState) {
          params.set("state", selectedState);
        }
        const resp = await fetch(`${API_BASE_URL}/risk-forecasts/?${params.toString()}`, {
          headers: token ? { Authorization: `Token ${token}` } : undefined,
        });
        if (!resp.ok) throw new Error(`Forecasts request failed: ${resp.status}`);
        const data = await resp.json();
        setForecasts(data || []);
      } catch (err: any) {
        setForecastError(err?.message || String(err));
        setForecasts([]);
      } finally {
        setLoadingForecasts(false);
      }
    }
    loadForecasts();
  }, [canFilterByState, selectedState]);

  async function fetchWeatherForForecast(forecast: any) {
    setSelectedForecast(forecast);
    setLoadingWeather(true);
    setWeatherContext(null);
    setWeatherError(null);
    try {
      const token = typeof window !== "undefined" ? window.localStorage.getItem("geopulse.token") : null;
      const resp = await fetch(`${API_BASE_URL}/weather-intelligence/`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
        body: JSON.stringify({ points: [{ latitude: forecast.latitude, longitude: forecast.longitude }] }),
      });
      if (!resp.ok) throw new Error(`Weather request failed: ${resp.status}`);
      const data = await resp.json();
      const parsed = toWeatherIntelligenceResponse(data);
      const nextContext = overlayToWeatherContext(parsed.overlay?.[0]);
      if (!nextContext) {
        throw new Error("Weather service returned no weather overlay for this point.");
      }
      setWeatherContext(nextContext);
    } catch (err: any) {
      setWeatherContext(null);
      setWeatherError(err?.message || String(err));
    } finally {
      setLoadingWeather(false);
    }
  }

  // Fetch weather for selected state center when state filter changes
  useEffect(() => {
    async function fetchStateWeather() {
      if (!selectedState) return;
      const center = NIGERIA_STATE_CENTERS[selectedState];
      if (!center) return;
      setLoadingWeather(true);
      setWeatherContext(null);
      setWeatherError(null);
      setSelectedForecast(null);
      try {
        const token = typeof window !== "undefined" ? window.localStorage.getItem("geopulse.token") : null;
        const resp = await fetch(`${API_BASE_URL}/weather-intelligence/`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { Authorization: `Token ${token}` } : {}),
          },
          body: JSON.stringify({ points: [{ latitude: center.latitude, longitude: center.longitude, label: selectedState }] }),
        });
        if (!resp.ok) throw new Error(`Weather request failed: ${resp.status}`);
        const data = await resp.json();
        const parsed = toWeatherIntelligenceResponse(data);
        const nextContext = overlayToWeatherContext(parsed.overlay?.[0]);
        if (!nextContext) {
          throw new Error("Weather service returned no weather overlay for this state.");
        }
        setWeatherContext(nextContext);
      } catch (err: any) {
        setWeatherContext(null);
        setWeatherError(err?.message || String(err));
      } finally {
        setLoadingWeather(false);
      }
    }
    fetchStateWeather();
  }, [selectedState]);

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased font-sans">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_0%,rgba(6,182,212,0.07),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_90%_100%,rgba(255,82,82,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_50%_50%,rgba(6,182,212,0.02),transparent)]" />
      </div>

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/ai-predictions"
        onNavigate={(path) => router.push(path)}
        onLogout={handleLogout}
        role={role}
      />

      <div className="relative z-10 lg:ml-64">
        {/* ── Header ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#070D1A]/95 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white transition"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div className="flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/5 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              <span className="text-[10px] uppercase tracking-widest text-cyan-300 hidden sm:inline">AI Predictions</span>
            </div>
            <span className="hidden md:block truncate text-xs text-white/40">Probabilistic risk & forecast engine</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Horizon</span>
              <div className="flex gap-1">
                {TIME_HORIZONS.map((h) => (
                  <button
                    key={h.key}
                    type="button"
                    onClick={() => setActiveHorizon(h.key)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                      activeHorizon === h.key
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/50 transition hover:text-cyan-300 hover:border-cyan-500/20"
            >
              ← Back
            </button>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 lg:px-8 space-y-5">
          <div className="w-full space-y-5">

            {/* ── Page Hero ── */}
            <section className="relative overflow-hidden rounded-2xl border border-cyan-500/15 bg-[#08101F]/90 p-5 sm:p-7">
              <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_60%_80%_at_100%_50%,rgba(6,182,212,0.06),transparent)]" />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/80">AI Prediction Engine · {activeHorizon} horizon</p>
                  <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-white">Emerging Risk & Forecasts</h1>
                  <p className="mt-1.5 max-w-xl text-sm text-white/50 leading-relaxed">
                    Probabilistic hotspot detection, corridor risk scoring, and environmental forecasts with live confidence metrics.
                  </p>
                </div>
                {/* Mobile horizon selector */}
                <div className="flex sm:hidden gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                  {TIME_HORIZONS.map((h) => (
                    <button
                      key={h.key}
                      type="button"
                      onClick={() => setActiveHorizon(h.key)}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all ${
                        activeHorizon === h.key
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          : "text-white/50"
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stat strip */}
              <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Active Forecasts", value: forecasts ? String(forecasts.length) : "—", accent: "cyan" },
                  { label: "Avg Confidence", value: "72%", accent: "cyan" },
                  { label: "High-Risk Zones", value: "3", accent: "orange" },
                  { label: "Signals Tracked", value: "4", accent: "emerald" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl border ${
                      s.accent === "orange"
                        ? "border-orange-500/15 bg-orange-500/5"
                        : s.accent === "emerald"
                        ? "border-emerald-500/15 bg-emerald-500/5"
                        : "border-cyan-500/15 bg-cyan-500/5"
                    } px-4 py-3`}
                  >
                    <div className={`text-2xl font-bold ${
                      s.accent === "orange" ? "text-orange-300" : s.accent === "emerald" ? "text-emerald-300" : "text-cyan-300"
                    }`}>
                      {s.value}
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/45 uppercase tracking-wider">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Main grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* ── Left panel ── */}
              <aside className="lg:col-span-3 space-y-4">

                {/* State filter */}
                {canFilterByState && (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 p-4">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 mb-3">Filter by State</p>
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-[#050A13] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/40 transition appearance-none cursor-pointer"
                    >
                      <option value="">All states</option>
                      {NIGERIA_STATE_NAMES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {selectedState && (
                      <p className="mt-2 text-[11px] text-white/40 leading-relaxed">
                        Showing forecasts for <span className="text-cyan-400">{selectedState}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Emerging hotspots */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 mb-3">Emerging Hotspots</p>
                  <div className="space-y-2.5">
                    {insights.map((item) => (
                      <div key={item.title} className={`rounded-xl border px-3.5 py-3 ${item.tone}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wide">{item.title}</span>
                          <span className="text-base font-bold">{item.value}</span>
                        </div>
                        <p className="text-[11px] opacity-70 leading-relaxed">{item.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contributing signals */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 mb-3">Contributing Signals</p>
                  <div className="space-y-2">
                    {SIGNALS.map((sig) => (
                      <div key={sig.label} className="flex items-center justify-between rounded-lg bg-white/[0.025] px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{sig.icon}</span>
                          <span className="text-xs text-white/75">{sig.label}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
                          {sig.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confidence meter */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 mb-3">Model Confidence</p>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative h-14 w-14 flex-shrink-0">
                      <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                        <circle
                          cx="28" cy="28" r="22" fill="none"
                          stroke="url(#conf-grad)" strokeWidth="5"
                          strokeDasharray={`${2 * Math.PI * 22 * 0.72} ${2 * Math.PI * 22}`}
                          strokeLinecap="round"
                        />
                        <defs>
                          <linearGradient id="conf-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#f97316" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">72%</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Good confidence</p>
                      <p className="mt-0.5 text-[11px] text-white/50 leading-relaxed">4 active signals contributing to this score</p>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-orange-400 transition-all duration-700"
                      style={{ width: "72%" }}
                    />
                  </div>
                </div>

                {/* Escalation alerts */}
                <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-50" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
                    </span>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-orange-300/70">Escalation Alert</p>
                  </div>
                  <p className="text-sm text-orange-200/80 leading-relaxed">
                    Unusual clustering on corridors — repeated reports in <span className="font-semibold text-orange-300">Sector 4B</span>. Review advised before dispatch.
                  </p>
                </div>
              </aside>

              {/* ── Center: Map + forecast list ── */}
              <section className="lg:col-span-6 space-y-4">

                {/* Map area */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                    <div>
                      <p className="text-xs font-semibold text-white/80">Predictive Risk Map</p>
                      <p className="text-[11px] text-white/40">Pattern + probability map · risk zones, corridors, confidence, and change over time</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-white/40 sm:grid-cols-4">
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-80" />Low</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-300 opacity-80" />Moderate</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400 opacity-80" />High</span>
                      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 opacity-80" />Critical</span>
                    </div>
                  </div>

                  <div className="grid gap-3 border-b border-white/[0.05] px-4 py-3 text-[11px] text-white/55 md:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">What it shows</p>
                      <p className="mt-1 leading-relaxed">Risk zones, hotspots, and corridors where disruption is likely to increase.</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">How to read it</p>
                      <p className="mt-1 leading-relaxed">Green means lower risk; colors intensify as probability and instability rise.</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[9px] uppercase tracking-[0.16em] text-white/30">Time view</p>
                      <p className="mt-1 leading-relaxed">The map updates with recent reports, weather, and movement patterns.</p>
                    </div>
                  </div>

                  {/* DashboardMap */}
                  <div className="h-[340px] sm:h-[420px]">
                    <DashboardMap
                      centerLatitude={mapCenter.latitude}
                      centerLongitude={mapCenter.longitude}
                      zoom={mapCenter.zoom}
                      incidents={
                        forecasts
                          ? forecasts.map((f: any) => ({
                              id: parseInt(String(f.id).replace(/[^0-9]/g, "")) || 0,
                              title: f.cluster_name,
                              incidentType: f.category || "prediction",
                              severity: f.level || "low",
                              confidence: `${f.confidence}%`,
                              status: "predicted",
                              summary: f.summary,
                              detectedAt: new Date().toISOString(),
                              latitude: f.latitude,
                              longitude: f.longitude,
                              locationName: f.cluster_name,
                              visibilityScore: typeof f.probability === "number" ? f.probability / 100 : undefined,
                            }))
                          : []
                      }
                      showIncidents={true}
                      showHeatmap={true}
                      showRiskZones={true}
                      onIncidentSelect={(pt) => {
                        const f = forecasts?.find(
                          (x: any) => Math.abs(x.latitude - pt.latitude) < 0.01 && Math.abs(x.longitude - pt.longitude) < 0.01
                        );
                        if (f) fetchWeatherForForecast(f);
                      }}
                    />
                  </div>
                </div>

                {/* Route + Environmental cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">🛣️</span>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-orange-300/70">Risk Corridor</p>
                    </div>
                    <h3 className="text-base font-semibold text-white">Lokoja–Abuja Corridor</h3>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-white/60">Instability trend</span>
                      <span className="text-sm font-bold text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-0.5">High ↑</span>
                    </div>
                    <div className="mt-3 h-1 w-full rounded-full bg-white/[0.06]">
                      <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-orange-500 to-red-500" />
                    </div>
                    <p className="mt-2 text-[11px] text-white/40">Confidence: 72% · Reports, weather, congestion, route pressure</p>
                  </div>

                  <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">🌊</span>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-300/70">Environmental Forecast</p>
                    </div>
                    <h3 className="text-base font-semibold text-white">Flood Probability</h3>
                    <p className="mt-1 text-sm text-white/60">
                      {selectedForecast
                        ? (selectedForecast.cluster_name || selectedForecast.locationName || `${selectedForecast.latitude?.toFixed(3)}, ${selectedForecast.longitude?.toFixed(3)}`)
                        : selectedState
                        ? selectedState
                        : "Nationwide"}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-white/60">Near-term trend</span>
                      <span className="text-sm font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-0.5">Elevated</span>
                    </div>
                    <div className="mt-3 h-1 w-full rounded-full bg-white/[0.06]">
                      <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-cyan-500 to-blue-400" />
                    </div>
                    <p className="mt-2 text-[11px] text-white/40">Confidence: 68% · Rainfall, river gauge trends, flood exposure</p>
                  </div>
                </div>

                {/* Forecast list */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                    <div>
                      <p className="text-xs font-semibold text-white/80">Risk Forecasts</p>
                      <p className="text-[11px] text-white/40">
                        {loadingForecasts ? "Loading…" : `${forecasts?.length ?? 0} active predictions`}
                      </p>
                    </div>
                    {forecasts && forecasts.length > 0 && (
                      <span className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-1">
                        Live
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto">
                    {loadingForecasts && (
                      <div className="flex items-center justify-center py-10 text-white/40 text-sm gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                        </svg>
                        Loading forecasts…
                      </div>
                    )}
                    {forecastError && (
                      <div className="px-4 py-4 text-sm text-rose-400/80 bg-rose-500/5 flex items-center gap-2">
                        <span>⚠</span> {forecastError}
                      </div>
                    )}
                    {!loadingForecasts && forecasts && forecasts.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-white/30 text-sm gap-2">
                        <span className="text-2xl">🔍</span>
                        No forecasts available
                      </div>
                    )}
                    {!loadingForecasts && forecasts && forecasts.map((f: any) => (
                      <div
                        key={f.id}
                        className={`flex items-center justify-between px-4 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer group ${selectedForecast?.id === f.id ? "bg-cyan-500/5" : ""}`}
                        onClick={() => fetchWeatherForForecast(f)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-orange-500/10 border border-white/[0.06] flex items-center justify-center text-xs font-bold text-cyan-400 flex-shrink-0">
                            {Math.round(f.probability)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white/90 truncate">{f.cluster_name}</p>
                            <p className="text-[11px] text-white/45 truncate">{f.summary}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-white">{f.probability}%</p>
                            <p className="text-[11px] text-white/40">Conf {f.confidence}%</p>
                          </div>
                          <span className="text-white/30 group-hover:text-cyan-400 transition-colors text-xs">→</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Right: weather + detail panel ── */}
              <aside className="lg:col-span-3 space-y-4">

                {/* Selected forecast detail */}
                {selectedForecast ? (
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-300/70">Selected Forecast</p>
                        <h3 className="mt-1 text-sm font-semibold text-white">{selectedForecast.cluster_name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setSelectedForecast(null); setWeatherContext(null); setWeatherError(null); }}
                        className="text-white/30 hover:text-white/70 transition text-sm mt-0.5"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                        <p className="text-white/40 mb-0.5">Probability</p>
                        <p className="font-bold text-cyan-300">{selectedForecast.probability}%</p>
                      </div>
                      <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                        <p className="text-white/40 mb-0.5">Confidence</p>
                        <p className="font-bold text-white">{selectedForecast.confidence}%</p>
                      </div>
                    </div>
                    {selectedForecast.summary && (
                      <p className="mt-3 text-[11px] text-white/50 leading-relaxed">{selectedForecast.summary}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 p-4 text-center">
                    <div className="py-4">
                      <p className="text-2xl mb-2">🎯</p>
                      <p className="text-xs text-white/40">Select a forecast from the list or click a map point to view details</p>
                    </div>
                  </div>
                )}

                {/* Weather context */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 mb-3">Weather</p>

                  {loadingWeather && (
                    <div className="flex items-center justify-center py-6 gap-2 text-white/40 text-xs">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
                      </svg>
                      Fetching weather…
                    </div>
                  )}

                  {!loadingWeather && !weatherContext && (
                    <div className="space-y-2 text-center py-3">
                      <p className="text-[11px] text-white/35">Select a forecast or state to view concise weather information</p>
                      {weatherError && (
                        <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] leading-relaxed text-rose-200">
                          {weatherError}
                        </p>
                      )}
                    </div>
                  )}

                  {!loadingWeather && weatherContext && (
                    <div className="text-sm text-white/80 bg-white/[0.02] rounded-xl px-3 py-3 leading-relaxed">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-white/90">{selectedState ? `${selectedState}` : weatherContext.label}</h4>
                          <p className="mt-1 text-[13px] text-white/70">{weatherContext.summary || `${weatherContext.rainfallIntensity} expected; visibility: ${weatherContext.visibility}.`}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white/90">{weatherContext.condition || "—"}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${weatherContext.severity === "extreme" ? "bg-rose-500 text-white" : weatherContext.severity === "high" ? "bg-orange-500 text-white" : weatherContext.severity === "moderate" ? "bg-yellow-400 text-black" : "bg-emerald-400 text-black"}`}> {weatherContext.severity ?? "low"} </span>
                        </div>
                      </div>
                      {weatherContext.alerts && weatherContext.alerts.length > 0 && (
                        <p className="mt-2 text-[12px] text-amber-300">Alerts: {weatherContext.alerts.join("; ")}</p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-white/[0.06] bg-[#0A1020]/80 p-2">
                          <p className="text-[9px] uppercase tracking-wider text-white/30">Condition</p>
                          <p className="mt-1 text-xs font-semibold text-cyan-300">{weatherContext.condition}</p>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-[#0A1020]/80 p-2">
                          <p className="text-[9px] uppercase tracking-wider text-white/30">Precipitation (mm)</p>
                          <p className="mt-1 text-xs font-semibold text-cyan-300">{weatherContext.precipitationMm != null ? String(weatherContext.precipitationMm) : "—"}</p>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-[#0A1020]/80 p-2">
                          <p className="text-[9px] uppercase tracking-wider text-white/30">Rainfall</p>
                          <p className="mt-1 text-xs font-semibold text-cyan-300">{weatherContext.rainfallIntensity}</p>
                        </div>
                        <div className="rounded-lg border border-white/[0.06] bg-[#0A1020]/80 p-2">
                          <p className="text-[9px] uppercase tracking-wider text-white/30">Visibility (km)</p>
                          <p className="mt-1 text-xs font-semibold text-cyan-300">{weatherContext.visibility}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Model info */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/35 mb-3">Forecast Model</p>
                  <div className="space-y-2.5 text-xs">
                    {[
                      { label: "Algorithm", value: "Ensemble + ML" },
                      { label: "Data sources", value: "Incidents, weather, GIS" },
                      { label: "Last updated", value: "Just now" },
                      { label: "Horizon", value: activeHorizon },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between rounded-lg bg-white/[0.025] px-3 py-2">
                        <span className="text-white/40">{row.label}</span>
                        <span className="font-medium text-white/80">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}