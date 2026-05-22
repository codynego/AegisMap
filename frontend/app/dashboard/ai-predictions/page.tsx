"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardMap } from "@/components/dashboard-map";
import { isRouteRiskReportType, normalizeReportType } from "@/lib/report-types";

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

type PredictionCategory =
  | "emerging_hotspot"
  | "escalation_risk"
  | "time_based_danger"
  | "route_instability"
  | "unusual_activity"
  | "spillover_risk";

type RiskLevel = "low" | "guarded" | "elevated" | "high" | "critical";
type PredictionWindow = "24h" | "72h" | "7d";
type PanelTab = "overview" | "feed" | "trends";

type PredictionRecord = {
  id: string;
  clusterName: string;
  category: PredictionCategory;
  level: RiskLevel;
  probability: number;
  confidence: number;
  window: PredictionWindow;
  latitude: number;
  longitude: number;
  summary: string;
  rationale: string[];
  timingNote: string;
  sourceCount: number;
  recentCount: number;
  previousCount: number;
  activeReports: number;
  highSeverityCount: number;
  nightShare: number;
  routeSignal: number;
  anomalySignal: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

const NAV_ITEMS = [
  { label: "Home", path: "/dashboard" },
  { label: "Map", path: "/dashboard/live-intelligence" },
  { label: "Report", path: "/dashboard/incident-reports" },
  { label: "Routes", path: "/dashboard/route-intelligence" },
  { label: "Alerts", path: "/dashboard/ai-predictions" },
  { label: "Profile", path: "/dashboard/drone-intelligence" },
];

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string; border: string; dot: string }> = {
  critical: { color: "text-red-300", bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-400" },
  high: { color: "text-orange-300", bg: "bg-orange-500/10", border: "border-orange-500/30", dot: "bg-orange-400" },
  elevated: { color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400" },
  guarded: { color: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", dot: "bg-cyan-400" },
  low: { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-400" },
};

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getList<T>(payload: T[] | ApiListResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function haversine(latA: number, lngA: number, latB: number, lngB: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((latA * Math.PI) / 180) *
      Math.cos((latB * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isOngoing(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized !== "resolved" && normalized !== "closed" && normalized !== "dismissed";
}

function isNightHour(iso: string) {
  const date = new Date(iso);
  const hour = date.getHours();
  return hour >= 20 || hour < 6;
}

function severityWeight(severity: string) {
  if (severity === "critical") return 1.25;
  if (severity === "high") return 1;
  if (severity === "medium") return 0.7;
  return 0.45;
}

function riskLevelFromProbability(probability: number): RiskLevel {
  if (probability >= 82) return "critical";
  if (probability >= 68) return "high";
  if (probability >= 52) return "elevated";
  if (probability >= 36) return "guarded";
  return "low";
}

function windowFromProbability(probability: number): PredictionWindow {
  if (probability >= 80) return "24h";
  if (probability >= 58) return "72h";
  return "7d";
}

function confidenceLabel(confidence: number) {
  if (confidence >= 78) return "High";
  if (confidence >= 60) return "Moderate";
  return "Developing";
}

function categoryLabel(category: PredictionCategory) {
  switch (category) {
    case "emerging_hotspot":
      return "Emerging hotspot";
    case "escalation_risk":
      return "Escalation risk";
    case "time_based_danger":
      return "Time-based danger";
    case "route_instability":
      return "Route instability";
    case "unusual_activity":
      return "Unusual activity";
    case "spillover_risk":
      return "Incident spillover";
  }
}

function predictionSummary(category: PredictionCategory, clusterName: string, window: PredictionWindow) {
  switch (category) {
    case "emerging_hotspot":
      return `Elevated probability of rising activity around ${clusterName} within ${window}.`;
    case "escalation_risk":
      return `Signals suggest danger levels may intensify near ${clusterName} within ${window}.`;
    case "time_based_danger":
      return `Night-time exposure is increasing around ${clusterName} over the next ${window}.`;
    case "route_instability":
      return `This corridor shows instability patterns that may worsen within ${window}.`;
    case "unusual_activity":
      return `Anomalous incident activity has appeared near ${clusterName} and merits monitoring.`;
    case "spillover_risk":
      return `Risk may spread from nearby active zones toward ${clusterName} within ${window}.`;
  }
}

function buildDailySeries(incidents: MapIncidentPoint[], days: number) {
  const labels: string[] = [];
  const values: number[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const bucket = new Date(now);
    bucket.setHours(0, 0, 0, 0);
    bucket.setDate(bucket.getDate() - i);
    const next = new Date(bucket);
    next.setDate(next.getDate() + 1);

    labels.push(bucket.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    values.push(
      incidents.filter((incident) => {
        const time = new Date(incident.detectedAt).getTime();
        return time >= bucket.getTime() && time < next.getTime();
      }).length,
    );
  }

  return { labels, values };
}

function buildHourlyRiskSeries(incidents: MapIncidentPoint[]) {
  const buckets = Array.from({ length: 6 }, () => 0);
  incidents.forEach((incident) => {
    const hour = new Date(incident.detectedAt).getHours();
    const index = Math.min(5, Math.floor(hour / 4));
    buckets[index] += severityWeight(incident.severity);
  });
  return {
    labels: ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"],
    values: buckets,
  };
}

function findNearestZone(
  incident: MapIncidentPoint,
  watchZones: WatchZonePoint[],
  maxDistanceKm: number,
) {
  let best: WatchZonePoint | null = null;
  let minDistance = Infinity;

  watchZones.forEach((zone) => {
    const distance = haversine(incident.latitude, incident.longitude, zone.latitude, zone.longitude);
    if (distance < minDistance) {
      minDistance = distance;
      best = zone;
    }
  });

  if (!best || minDistance > maxDistanceKm) return null;
  return { zone: best, distanceKm: minDistance };
}

function buildPredictions(incidents: MapIncidentPoint[], watchZones: WatchZonePoint[]): PredictionRecord[] {
  const clusters = new Map<
    string,
    {
      name: string;
      latitude: number;
      longitude: number;
      anchorZone?: WatchZonePoint;
      incidents: MapIncidentPoint[];
      routeTaggedCount: number;
    }
  >();

  incidents.forEach((incident) => {
    const nearest = findNearestZone(incident, watchZones, 45);
    const fallbackLat = Number(incident.latitude.toFixed(1));
    const fallbackLng = Number(incident.longitude.toFixed(1));
    const key = nearest ? `zone-${nearest.zone.id}` : `grid-${fallbackLat}-${fallbackLng}`;
    const cluster = clusters.get(key) ?? {
      name: nearest?.zone.name ?? incident.locationName,
      latitude: nearest?.zone.latitude ?? incident.latitude,
      longitude: nearest?.zone.longitude ?? incident.longitude,
      anchorZone: nearest?.zone,
      incidents: [],
      routeTaggedCount: 0,
    };

    cluster.incidents.push(incident);
    if (
      isRouteRiskReportType(incident.incidentType) ||
      incident.incidentType === "armed_robbery" ||
      incident.incidentType === "kidnapping" ||
      incident.locationName.toLowerCase().includes("road") ||
      incident.locationName.toLowerCase().includes("highway") ||
      incident.locationName.toLowerCase().includes("corridor")
    ) {
      cluster.routeTaggedCount += 1;
    }

    clusters.set(key, cluster);
  });

  const now = Date.now();
  const seventyTwoHoursAgo = now - 72 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  const basePredictions = [...clusters.entries()]
    .map(([clusterKey, cluster]) => {
      const recent = cluster.incidents.filter((incident) => new Date(incident.detectedAt).getTime() >= sevenDaysAgo);
      const previous = cluster.incidents.filter((incident) => {
        const time = new Date(incident.detectedAt).getTime();
        return time >= fourteenDaysAgo && time < sevenDaysAgo;
      });
      const shortTerm = cluster.incidents.filter((incident) => new Date(incident.detectedAt).getTime() >= seventyTwoHoursAgo);
      const activeReports = recent.filter((incident) => isOngoing(incident.status)).length;
      const highSeverityCount = recent.filter(
        (incident) => incident.severity === "high" || incident.severity === "critical",
      ).length;
      const nightShare = recent.length > 0 ? recent.filter((incident) => isNightHour(incident.detectedAt)).length / recent.length : 0;
      const routeSignal = recent.length > 0 ? cluster.routeTaggedCount / Math.max(cluster.incidents.length, 1) : 0;
      const anomalySignal = previous.length === 0 && recent.length >= 2 ? 1 : clamp((recent.length - previous.length) / 5, 0, 1);
      const growth = recent.length / Math.max(previous.length, 1);
      const zoneSupport = (cluster.anchorZone?.riskScore ?? 0) / 100;

      const hotspotScore = recent.length * 8 + shortTerm.length * 5 + growth * 8;
      const escalationScore = highSeverityCount * 9 + activeReports * 6 + zoneSupport * 18;
      const timeScore = nightShare * 26 + (shortTerm.length >= 2 ? 10 : 0);
      const routeScore = routeSignal * 24 + (cluster.routeTaggedCount >= 3 ? 12 : 0);
      const unusualScore = anomalySignal * 28;
      const spilloverScore = zoneSupport * 16 + (growth > 1.4 ? 10 : 0);

      const categoryScores: Array<[PredictionCategory, number]> = [
        ["emerging_hotspot", hotspotScore],
        ["escalation_risk", escalationScore],
        ["time_based_danger", timeScore],
        ["route_instability", routeScore],
        ["unusual_activity", unusualScore],
        ["spillover_risk", spilloverScore],
      ];

      const [category, topCategoryScore] = categoryScores.sort((left, right) => right[1] - left[1])[0];
      const probability = clamp(
        Math.round(
          22 +
            recent.length * 7 +
            shortTerm.length * 4 +
            growth * 7 +
            highSeverityCount * 4 +
            activeReports * 3 +
            zoneSupport * 20 +
            routeSignal * 12,
        ),
        24,
        94,
      );
      const confidence = clamp(
        Math.round(
          35 +
            Math.min(25, cluster.incidents.length * 3) +
            Math.min(15, recent.length * 2) +
            zoneSupport * 18 +
            (topCategoryScore >= 24 ? 8 : 0),
        ),
        36,
        92,
      );
      const window = windowFromProbability(probability);
      const level = riskLevelFromProbability(probability);
      const rationale = [
        `${recent.length} incidents in the last 7 days versus ${previous.length} in the prior week.`,
        highSeverityCount > 0
          ? `${highSeverityCount} high-severity incident${highSeverityCount === 1 ? "" : "s"} support the escalation signal.`
          : "Severity profile remains mixed rather than concentrated.",
        nightShare >= 0.5
          ? `${Math.round(nightShare * 100)}% of recent activity occurred at night.`
          : `Night-time activity remains limited at ${Math.round(nightShare * 100)}% of recent reports.`,
      ];

      if (routeSignal >= 0.45) {
        rationale.push("The recent pattern is concentrated around corridors and route-linked reports.");
      }
      if (anomalySignal >= 0.8) {
        rationale.push("This region was relatively quiet before the latest spike, which raises anomaly risk.");
      }
      if (cluster.anchorZone && cluster.anchorZone.riskScore >= 60) {
        rationale.push(`Existing watch-zone pressure around ${cluster.anchorZone.name} corroborates the forecast.`);
      }

      return {
        id: clusterKey,
        clusterName: cluster.name,
        category,
        level,
        probability,
        confidence,
        window,
        latitude: cluster.latitude,
        longitude: cluster.longitude,
        summary: predictionSummary(category, cluster.name, window),
        rationale,
        timingNote:
          category === "time_based_danger"
            ? "Recent activity is clustering after dark. Evening movement should be monitored more closely."
            : category === "route_instability"
              ? "Repeated route-linked reporting suggests corridor conditions may degrade further."
              : "This is a probability-based forecast, not a claim of confirmed adversary presence.",
        sourceCount: cluster.incidents.length,
        recentCount: recent.length,
        previousCount: previous.length,
        activeReports,
        highSeverityCount,
        nightShare,
        routeSignal,
        anomalySignal,
      };
    })
    .filter((prediction) => prediction.recentCount >= 2 || prediction.probability >= 58);

  return basePredictions
    .sort((left, right) => {
      if (right.probability !== left.probability) return right.probability - left.probability;
      return right.confidence - left.confidence;
    })
    .slice(0, 12);
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </svg>
  );
}

function Sidebar({
  open,
  onClose,
  activeIdx,
  onNav,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  activeIdx: number;
  onNav: (index: number) => void;
  onLogout: () => void;
}) {
  return (
    <>
      {open ? (
        <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />
      ) : null}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/[0.06] bg-[#070D1A]/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-7">
          <h1 className="text-xl font-bold tracking-tight text-cyan-400">GeoPulse AI</h1>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">Forward-Looking Intelligence</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                onNav(index);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                activeIdx === index
                  ? "bg-cyan-500/10 text-cyan-300"
                  : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${activeIdx === index ? "bg-cyan-400" : "bg-white/15"}`} />
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

function RiskBadge({ level, score }: { level: RiskLevel; score: number }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest ${cfg.bg} ${cfg.border} ${cfg.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {level}
      <span className="opacity-70">{score}%</span>
    </span>
  );
}

function MetricCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
      <p className="text-[10px] uppercase tracking-widest text-white/35">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{subtext}</p>
    </div>
  );
}

function MiniBars({ labels, values }: { labels: string[]; values: number[] }) {
  const maxValue = Math.max(...values, 1);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
      <div className="flex items-end gap-2">
        {values.map((value, index) => (
          <div key={`${labels[index]}-${index}`} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end rounded-xl bg-white/[0.03] px-1.5 pb-1.5">
              <div
                className="w-full rounded-lg bg-gradient-to-t from-cyan-500/70 to-emerald-400/80"
                style={{ height: `${Math.max(8, (value / maxValue) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-white/35">{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PredictionCard({
  prediction,
  active,
  onSelect,
}: {
  prediction: PredictionRecord;
  active: boolean;
  onSelect: (predictionId: string) => void;
}) {
  const cfg = RISK_CONFIG[prediction.level];
  return (
    <button
      type="button"
      onClick={() => onSelect(prediction.id)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        active
          ? `${cfg.border} ${cfg.bg} ring-1 ring-cyan-400/30`
          : "border-white/[0.06] bg-[#0A1020]/80 hover:border-cyan-500/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/35">{categoryLabel(prediction.category)}</p>
          <p className="mt-1 text-sm font-semibold text-white">{prediction.clusterName}</p>
        </div>
        <RiskBadge level={prediction.level} score={prediction.probability} />
      </div>
      <p className="mt-3 text-sm leading-6 text-white/70">{prediction.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/40">
        <span className="rounded-full border border-white/[0.08] px-2 py-1">
          Confidence {confidenceLabel(prediction.confidence)} ({prediction.confidence}%)
        </span>
        <span className="rounded-full border border-white/[0.08] px-2 py-1">Window {prediction.window}</span>
        <span className="rounded-full border border-white/[0.08] px-2 py-1">
          {prediction.recentCount} recent reports
        </span>
      </div>
    </button>
  );
}

function PanelContent({
  activeTab,
  predictions,
  focusedPrediction,
  dailySeries,
  hourlySeries,
  loading,
  minConfidence,
  selectedCategory,
  showIncidents,
  showHeatmap,
  showPredictions,
  onConfidenceChange,
  onCategoryChange,
  onToggleIncidents,
  onToggleHeatmap,
  onTogglePredictions,
  onSelectPrediction,
}: {
  activeTab: PanelTab;
  predictions: PredictionRecord[];
  focusedPrediction: PredictionRecord | null;
  dailySeries: { labels: string[]; values: number[] };
  hourlySeries: { labels: string[]; values: number[] };
  loading: boolean;
  minConfidence: number;
  selectedCategory: PredictionCategory | "all";
  showIncidents: boolean;
  showHeatmap: boolean;
  showPredictions: boolean;
  onConfidenceChange: (value: number) => void;
  onCategoryChange: (value: PredictionCategory | "all") => void;
  onToggleIncidents: () => void;
  onToggleHeatmap: () => void;
  onTogglePredictions: () => void;
  onSelectPrediction: (predictionId: string) => void;
}) {
  if (activeTab === "overview") {
    return (
      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
          <p className="text-[10px] uppercase tracking-widest text-cyan-300">Prediction posture</p>
          <p className="mt-2 text-sm leading-6 text-white/70">
            These forecasts are conservative probability estimates based on recent reporting, route-linked pressure,
            clustering, and watch-zone context. They indicate rising risk patterns, not confirmed actor intent.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-white/35">Layer controls</p>
            <span className="text-[10px] text-white/30">{predictions.length} predictions</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Incidents", active: showIncidents, onClick: onToggleIncidents },
              { label: "Heatmap", active: showHeatmap, onClick: onToggleHeatmap },
              { label: "Predictions", active: showPredictions, onClick: onTogglePredictions },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={`rounded-xl border px-3 py-2.5 text-xs font-semibold uppercase tracking-widest transition ${
                  item.active
                    ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-300"
                    : "border-white/[0.08] bg-[#060B16] text-white/45 hover:text-white/70"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-white/35">Confidence filter</p>
            <span className="text-xs text-white/45">{minConfidence}%+</span>
          </div>
          <input
            type="range"
            min={35}
            max={85}
            step={5}
            value={minConfidence}
            onChange={(event) => onConfidenceChange(Number(event.target.value))}
            className="mt-3 w-full accent-cyan-400"
          />
          <div className="mt-3">
            <p className="mb-2 text-[10px] uppercase tracking-widest text-white/35">Prediction type</p>
            <select
              value={selectedCategory}
              onChange={(event) => onCategoryChange(event.target.value as PredictionCategory | "all")}
              className="w-full rounded-xl border border-white/[0.08] bg-[#060B16] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50"
            >
              <option value="all">All predictions</option>
              <option value="emerging_hotspot">Emerging hotspots</option>
              <option value="escalation_risk">Escalation risk</option>
              <option value="time_based_danger">Time-based danger</option>
              <option value="route_instability">Route instability</option>
              <option value="unusual_activity">Unusual activity</option>
              <option value="spillover_risk">Incident spillover</option>
            </select>
          </div>
        </div>

        {focusedPrediction ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/35">Focused forecast</p>
                <p className="mt-1 text-sm font-semibold text-white">{focusedPrediction.clusterName}</p>
              </div>
              <RiskBadge level={focusedPrediction.level} score={focusedPrediction.probability} />
            </div>
            <p className="mt-3 text-sm leading-6 text-white/70">{focusedPrediction.summary}</p>
            <p className="mt-3 text-xs leading-5 text-white/50">{focusedPrediction.timingNote}</p>
            <div className="mt-3 space-y-2">
              {focusedPrediction.rationale.slice(0, 3).map((item) => (
                <div key={item} className="flex gap-2 text-xs leading-5 text-white/55">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400/70" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (activeTab === "feed") {
    return (
      <div className="space-y-3 p-4">
        {predictions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-5 text-center text-sm text-white/35">
            No conservative prediction signals met the current filter.
          </div>
        ) : null}
        {predictions.map((prediction) => (
          <PredictionCard
            key={prediction.id}
            prediction={prediction}
            active={focusedPrediction?.id === prediction.id}
            onSelect={onSelectPrediction}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/35">Activity trajectory</p>
            <p className="mt-1 text-sm font-semibold text-white">Last 7 days of incident volume</p>
          </div>
          {loading ? <span className="text-[11px] text-white/30">Refreshing...</span> : null}
        </div>
        <div className="mt-4">
          <MiniBars labels={dailySeries.labels} values={dailySeries.values} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/35">Time-of-day pressure</p>
          <p className="mt-1 text-sm font-semibold text-white">Severity-weighted risk by 4-hour window</p>
        </div>
        <div className="mt-4">
          <MiniBars labels={hourlySeries.labels} values={hourlySeries.values} />
        </div>
      </div>
    </div>
  );
}

export default function AIPredictionsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(4);
  const [activeTab, setActiveTab] = useState<PanelTab>("overview");
  const [selectedPredictionId, setSelectedPredictionId] = useState<string | null>(null);
  const [minConfidence, setMinConfidence] = useState(50);
  const [selectedCategory, setSelectedCategory] = useState<PredictionCategory | "all">("all");
  const [showIncidents, setShowIncidents] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPredictions, setShowPredictions] = useState(true);
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("geopulse.token"),
  );
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [watchZones, setWatchZones] = useState<WatchZoneRecord[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loading, setLoading] = useState(Boolean(authToken));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    const headers = { Authorization: `Token ${authToken}` };

    async function load() {
      setLoading(true);
      try {
        const [incidentRes, watchZoneRes, alertRes] = await Promise.all([
          fetch(`${API_BASE_URL}/incidents/`, { headers }),
          fetch(`${API_BASE_URL}/watch-zones/`, { headers }),
          fetch(`${API_BASE_URL}/alerts/`, { headers }),
        ]);

        if (!active) return;

        const [incidentData, watchZoneData, alertData] = await Promise.all([
          incidentRes.json(),
          watchZoneRes.json(),
          alertRes.json(),
        ]);

        if (incidentRes.ok) setIncidents(getList(incidentData));
        if (watchZoneRes.ok) setWatchZones(getList(watchZoneData));
        if (alertRes.ok) {
          setAlerts(
            getList(alertData as ApiListResponse<Record<string, unknown>>).map((alert, index) => ({
              id: Number(alert.id ?? index + 1),
              level: String(alert.severity ?? "info"),
              triggeredAt: String(alert.triggered_at ?? ""),
              title: String(alert.title ?? "Alert"),
              body: String(alert.message ?? ""),
              meta: String(alert.status ?? "ACTIVE").toUpperCase(),
            })),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 60000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [authToken]);

  const incidentPoints = useMemo(
    () =>
      incidents.flatMap((incident) => {
        const latitude = toNumber(incident.latitude);
        const longitude = toNumber(incident.longitude);
        if (latitude === null || longitude === null) return [];
        return [
          {
            id: incident.id,
            title: incident.title,
            incidentType: normalizeReportType(incident.incident_type),
            severity: incident.severity,
            confidence: incident.confidence,
            status: incident.status,
            summary: incident.summary,
            detectedAt: incident.detected_at || incident.created_at,
            latitude,
            longitude,
            locationName: incident.location_name,
          },
        ];
      }),
    [incidents],
  );

  const watchZonePoints = useMemo(
    () =>
      watchZones.flatMap((zone) => {
        const latitude = toNumber(zone.centroid_latitude);
        const longitude = toNumber(zone.centroid_longitude);
        if (latitude === null || longitude === null) return [];
        return [
          {
            id: zone.id,
            name: zone.name,
            riskLevel: zone.current_risk_level,
            riskScore: toNumber(zone.current_risk_score) ?? 0,
            latitude,
            longitude,
          },
        ];
      }),
    [watchZones],
  );

  const predictions = useMemo(() => buildPredictions(incidentPoints, watchZonePoints), [incidentPoints, watchZonePoints]);

  const filteredPredictions = useMemo(
    () =>
      predictions.filter(
        (prediction) =>
          prediction.confidence >= minConfidence &&
          (selectedCategory === "all" || prediction.category === selectedCategory),
      ),
    [minConfidence, predictions, selectedCategory],
  );

  const focusedPrediction =
    filteredPredictions.find((prediction) => prediction.id === selectedPredictionId) ??
    filteredPredictions[0] ??
    null;

  const predictionZones = useMemo(
    () =>
      filteredPredictions.map((prediction, index) => ({
        id: index + 1,
        name: prediction.clusterName,
        riskLevel: prediction.level,
        riskScore: prediction.probability,
        latitude: prediction.latitude,
        longitude: prediction.longitude,
      })),
    [filteredPredictions],
  );

  const exactPin = focusedPrediction
    ? {
        latitude: focusedPrediction.latitude,
        longitude: focusedPrediction.longitude,
        label: `${focusedPrediction.clusterName} forecast`,
      }
    : null;

  const dailySeries = useMemo(() => buildDailySeries(incidentPoints, 7), [incidentPoints]);
  const hourlySeries = useMemo(() => buildHourlyRiskSeries(incidentPoints), [incidentPoints]);

  const topPrediction = filteredPredictions[0] ?? null;
  const criticalForecasts = filteredPredictions.filter(
    (prediction) => prediction.level === "critical" || prediction.level === "high",
  ).length;
  const avgConfidence = filteredPredictions.length
    ? Math.round(filteredPredictions.reduce((sum, prediction) => sum + prediction.confidence, 0) / filteredPredictions.length)
    : 0;
  const recentEscalations = filteredPredictions.filter((prediction) => prediction.category === "escalation_risk").length;

  const handleLogout = useCallback(() => {
    localStorage.removeItem("geopulse.token");
    localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }, []);

  const handleNav = useCallback(
    (index: number) => {
      setActiveNav(index);
      router.push(NAV_ITEMS[index].path);
    },
    [router],
  );

  if (!mounted) return null;

  const tabs: Array<{ id: PanelTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "feed", label: `Prediction Feed ${filteredPredictions.length ? `(${filteredPredictions.length})` : ""}` },
    { id: "trends", label: "Trend Charts" },
  ];

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased lg:h-screen lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_0%_0%,rgba(6,182,212,0.04),transparent)]" />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeIdx={activeNav}
        onNav={handleNav}
        onLogout={handleLogout}
      />

      <div className="hidden h-screen flex-col overflow-hidden lg:ml-64 lg:flex">
        <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#060B16]/90 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-400">AI Predictions</span>
            </div>
            <span className="text-sm text-white/40">
              {topPrediction ? topPrediction.summary : "Conservative forecasting for emerging risk patterns"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {topPrediction ? <RiskBadge level={topPrediction.level} score={topPrediction.probability} /> : null}
            <span className="text-[11px] text-white/30">{alerts.length} alert{alerts.length !== 1 ? "s" : ""}</span>
          </div>
        </header>

        <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-white">Forecasting & Risk Projection</h1>
          <p className="mt-1 text-sm text-white/40">
            Forward-looking intelligence based on incident recurrence, timing, clustering, and existing watch-zone pressure.
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_390px] overflow-hidden">
          <div className="relative min-h-0">
            <DashboardMap
              selectedState="Kogi"
              zoom={6}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              exactPin={exactPin}
              incidents={incidentPoints}
              watchZones={predictionZones}
              showControlsUi={false}
              showIncidents={showIncidents}
              showHeatmap={showHeatmap}
              showRiskZones={showPredictions}
              showGeofencing={false}
            />
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden border-l border-white/[0.06]">
            <div className="grid shrink-0 grid-cols-3 gap-2 border-b border-white/[0.06] px-4 py-4">
              <MetricCard
                label="Forecast Zones"
                value={String(filteredPredictions.length)}
                subtext={loading ? "Refreshing..." : `${criticalForecasts} high pressure`}
              />
              <MetricCard
                label="Avg Confidence"
                value={`${avgConfidence}%`}
                subtext="Probability backed by reporting density"
              />
              <MetricCard
                label="Escalation Signals"
                value={String(recentEscalations)}
                subtext="Clusters with rising severity pressure"
              />
            </div>

            <div className="flex shrink-0 border-b border-white/[0.06]">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 text-[11px] font-semibold uppercase tracking-widest transition ${
                    activeTab === tab.id
                      ? "border-b-2 border-cyan-400 text-cyan-300"
                      : "text-white/35 hover:text-white/60"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <PanelContent
                activeTab={activeTab}
                predictions={filteredPredictions}
                focusedPrediction={focusedPrediction}
                dailySeries={dailySeries}
                hourlySeries={hourlySeries}
                loading={loading}
                minConfidence={minConfidence}
                selectedCategory={selectedCategory}
                showIncidents={showIncidents}
                showHeatmap={showHeatmap}
                showPredictions={showPredictions}
                onConfidenceChange={setMinConfidence}
                onCategoryChange={setSelectedCategory}
                onToggleIncidents={() => setShowIncidents((value) => !value)}
                onToggleHeatmap={() => setShowHeatmap((value) => !value)}
                onTogglePredictions={() => setShowPredictions((value) => !value)}
                onSelectPrediction={setSelectedPredictionId}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#060B16]/90 px-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70"
            >
              <MenuIcon />
            </button>
            <div>
              <p className="text-sm font-semibold text-white">AI Predictions</p>
              <p className="text-[10px] uppercase tracking-widest text-white/35">
                {topPrediction ? `${topPrediction.probability}% forecast probability` : "No active forecast"}
              </p>
            </div>
          </div>
          {topPrediction ? <RiskBadge level={topPrediction.level} score={topPrediction.probability} /> : null}
        </header>

        <div className="h-[42vh]">
          <DashboardMap
            selectedState="Kogi"
            zoom={5}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            exactPin={exactPin}
            incidents={incidentPoints}
            watchZones={predictionZones}
            showControlsUi={false}
            showIncidents={showIncidents}
            showHeatmap={showHeatmap}
            showRiskZones={showPredictions}
            showGeofencing={false}
          />
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              label="Forecast Zones"
              value={String(filteredPredictions.length)}
              subtext={loading ? "Refreshing..." : `${criticalForecasts} high pressure`}
            />
            <MetricCard label="Avg Confidence" value={`${avgConfidence}%`} subtext="Conservative model" />
            <MetricCard label="Escalation" value={String(recentEscalations)} subtext="Rising severity patterns" />
          </div>

          <div className="flex rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition ${
                  activeTab === tab.id
                    ? "bg-cyan-500/10 text-cyan-300"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {tab.id === "feed" ? "Feed" : tab.id === "trends" ? "Trends" : "Overview"}
              </button>
            ))}
          </div>

          <PanelContent
            activeTab={activeTab}
            predictions={filteredPredictions}
            focusedPrediction={focusedPrediction}
            dailySeries={dailySeries}
            hourlySeries={hourlySeries}
            loading={loading}
            minConfidence={minConfidence}
            selectedCategory={selectedCategory}
            showIncidents={showIncidents}
            showHeatmap={showHeatmap}
            showPredictions={showPredictions}
            onConfidenceChange={setMinConfidence}
            onCategoryChange={setSelectedCategory}
            onToggleIncidents={() => setShowIncidents((value) => !value)}
            onToggleHeatmap={() => setShowHeatmap((value) => !value)}
            onTogglePredictions={() => setShowPredictions((value) => !value)}
            onSelectPrediction={setSelectedPredictionId}
          />
        </div>
      </div>
    </div>
  );
}
