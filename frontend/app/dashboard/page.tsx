"use client";

import { useEffect, useMemo, useState } from "react";

import { DashboardMap } from "@/components/dashboard-map";
import { nigeriaStates } from "@/components/dashboard-map-data";

type DashboardAlert = {
  id: number;
  level: string;
  time: string;
  title: string;
  body: string;
  meta: string;
  tone: string;
  highlight: string;
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
};

type WatchZoneRecord = {
  id: number;
  name: string;
  current_risk_level: string;
  current_risk_score: number | string | null;
  centroid_latitude: number | string | null;
  centroid_longitude: number | string | null;
  status: string;
  notes: string;
};

type ApiListResponse<T> = {
  results?: T[];
};

type ExactPin = {
  latitude: number;
  longitude: number;
  label: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

const navItems = [
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

function relativeTime(value?: string | null) {
  if (!value) {
    return "Now";
  }

  const then = new Date(value).getTime();
  const now = Date.now();
  const deltaMinutes = Math.max(0, Math.round((now - then) / 60000));

  if (deltaMinutes < 1) {
    return "Now";
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d ago`;
}

function toNumber(value: number | string | null | undefined) {
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
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload.results ?? [];
}

function levelTone(level: string) {
  if (level === "critical" || level === "high") {
    return "var(--tertiary-container)";
  }
  if (level === "medium" || level === "warning") {
    return "#f8c15b";
  }
  return "var(--primary)";
}

function levelHighlight(level: string) {
  if (level === "critical" || level === "high") {
    return "bg-[rgb(255,129,122,0.08)]";
  }
  if (level === "medium" || level === "warning") {
    return "bg-[rgb(248,193,91,0.08)]";
  }
  return "";
}

function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {mobileOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-[rgb(61,73,76,0.2)] bg-[rgb(9,14,28,0.92)] backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-8">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.03em] text-[var(--primary)]">
            GeoPulse AI
          </h1>
          <p className="mt-2 font-mono-ui text-[12px] uppercase tracking-[0.28em] text-[var(--on-surface-variant)]">
            Tactical Command Center
          </p>
          <button
            aria-label="Close navigation"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(61,73,76,0.3)] bg-[rgb(22,27,43,0.7)] text-white lg:hidden"
            onClick={onClose}
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-5 py-3">
          {navItems.map((item, index) => (
            <button
              key={item}
              onClick={onClose}
              className={`flex w-full items-center gap-4 px-5 py-4 text-left transition ${
                index === 0
                  ? "border-l-4 border-l-[var(--secondary)] bg-[rgb(0,165,114,0.18)] text-[var(--secondary)]"
                  : "text-[var(--on-surface-variant)] hover:bg-[rgb(47,52,69,0.38)] hover:text-[var(--on-surface)]"
              }`}
            >
              <span
                className={`h-5 w-5 rounded-[4px] border ${
                  index === 0
                    ? "border-[var(--secondary)] bg-[rgb(78,222,163,0.1)]"
                    : "border-[rgb(134,147,151,0.45)]"
                }`}
              />
              <span className="text-[18px] font-semibold">{item}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-[rgb(61,73,76,0.2)] p-5">
          <button className="flex w-full items-center gap-4 px-5 py-4 text-left text-[var(--on-surface-variant)] transition hover:text-[var(--tertiary-container)]">
            <span className="h-5 w-5 rounded-[4px] border border-[rgb(134,147,151,0.45)]" />
            <span className="text-[18px] font-semibold">Logout</span>
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
}: {
  onMenuOpen: () => void;
  onNotificationsOpen: () => void;
  locationLabel: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[rgb(61,73,76,0.28)] bg-[rgb(26,31,47,0.56)] px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <button
          aria-label="Open navigation"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(61,73,76,0.3)] bg-[rgb(22,27,43,0.65)] text-white lg:hidden"
          onClick={onMenuOpen}
        >
          <span className="flex flex-col gap-1">
            <span className="block h-0.5 w-4 bg-white" />
            <span className="block h-0.5 w-4 bg-white" />
            <span className="block h-0.5 w-4 bg-white" />
          </span>
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-[rgb(61,73,76,0.4)] bg-[rgb(22,27,43,0.72)] px-5 py-2 sm:flex">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--secondary)] shadow-[0_0_10px_rgba(78,222,163,0.9)]" />
          <span className="font-mono-ui text-[12px] uppercase tracking-[0.14em] text-[var(--secondary)]">
            System Active
          </span>
        </div>

        <div className="min-w-0 items-center gap-3 text-[var(--on-surface-variant)] sm:flex">
          <span className="hidden h-4 w-4 rounded-full border border-[rgb(134,147,151,0.55)] sm:block" />
          <span className="truncate text-sm text-[var(--on-surface)] sm:text-base">{locationLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-4 text-[var(--on-surface-variant)]">
          <button
            aria-label="Open notifications"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(61,73,76,0.3)] bg-[rgb(22,27,43,0.65)] text-[var(--on-surface-variant)] transition hover:border-[var(--primary)] hover:text-white"
            onClick={onNotificationsOpen}
          >
            <span className="relative block h-5 w-5 rounded-full border border-current">
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--tertiary-container)]" />
            </span>
          </button>
          <span className="hidden h-5 w-5 rounded-full border border-[rgb(134,147,151,0.45)] md:block" />
          <span className="hidden h-5 w-5 rounded-full border border-[rgb(134,147,151,0.45)] md:block" />
        </div>
        <div className="hidden h-8 w-px bg-[rgb(61,73,76,0.3)] md:block" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-semibold leading-none text-[var(--on-surface)]">
              Cmdr. V. Thorne
            </p>
            <p className="font-mono-ui text-[12px] text-[var(--primary)]">Senior Operator</p>
          </div>
          <div className="h-11 w-11 rounded-lg border border-[rgb(76,215,246,0.35)] bg-[radial-gradient(circle_at_50%_30%,rgba(76,215,246,0.18),rgba(10,15,30,1))]" />
        </div>
      </div>
    </header>
  );
}

function MetricCard({
  label,
  title,
  body,
  tone,
}: {
  label: string;
  title: string;
  body: string;
  tone: string;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-[rgb(61,73,76,0.3)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono-ui text-[11px] uppercase tracking-[0.16em]" style={{ color: tone }}>
          {label}
        </span>
        <span className="h-4 w-4 rounded-full border border-[rgb(134,147,151,0.35)]" />
      </div>
      <p className="text-[22px] font-semibold leading-tight text-[var(--on-surface)]">{title}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--on-surface-variant)]">{body}</p>
    </div>
  );
}

function LiveIntelligencePanel({
  alerts,
  mobile,
}: {
  alerts: DashboardAlert[];
  mobile?: boolean;
}) {
  return (
    <aside className={`flex min-h-0 flex-col bg-[var(--surface-container-low)] ${mobile ? "h-full" : ""}`}>
      <div className="flex items-center justify-between border-b border-[rgb(61,73,76,0.2)] px-6 py-6">
        <div>
          <h2 className="text-[20px] font-semibold leading-tight text-[var(--on-surface)]">
            Live Intelligence
          </h2>
          <p className="mt-1 font-mono-ui text-[12px] text-[var(--on-surface-variant)]">
            Real-Time Incident Feed
          </p>
        </div>
        <div className="rounded border border-[rgb(76,215,246,0.25)] bg-[rgb(76,215,246,0.08)] px-3 py-2">
          <span className="font-mono-ui text-[12px] tracking-[0.12em] text-[var(--primary)]">
            {alerts.length} ACTIVE
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`glass-panel rounded-2xl border-l-2 p-5 ${alert.highlight}`}
            style={{ borderLeftColor: alert.tone }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <span
                className="rounded px-3 py-1 font-mono-ui text-[10px] uppercase tracking-[0.1em]"
                style={{
                  backgroundColor:
                    alert.level.toLowerCase() === "critical"
                      ? "rgb(255 179 173)"
                      : alert.level.toLowerCase() === "warning" || alert.level.toLowerCase() === "high"
                        ? "rgb(255 129 122)"
                        : "rgb(76 215 246 / 0.2)",
                  color:
                    alert.level.toLowerCase() === "info"
                      ? "var(--primary)"
                      : "var(--on-surface)",
                }}
              >
                {alert.level}
              </span>
              <span className="font-mono-ui text-[10px] text-[var(--on-surface-variant)]">
                {alert.time}
              </span>
            </div>

            <p className="text-[20px] font-semibold leading-tight text-[var(--on-surface)]">
              {alert.title}
            </p>

            <p className="mt-4 text-sm leading-7 text-[var(--on-surface-variant)]">
              {alert.body}
            </p>

            {alert.meta ? (
              <p className="mt-3 text-[12px] text-[var(--secondary)]">{alert.meta}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="border-t border-[rgb(61,73,76,0.28)] bg-[var(--surface-container)] p-6">
        <button className="w-full rounded bg-[var(--primary)] px-5 py-5 font-semibold uppercase tracking-[0.08em] text-[var(--on-primary,#003640)] shadow-[0_0_20px_rgba(76,215,246,0.24)] transition hover:brightness-110">
          Execute Countermeasures
        </button>
      </div>
    </aside>
  );
}

export default function DashboardPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/standard");
  const [selectedState, setSelectedState] = useState(nigeriaStates[0].state);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedStreet, setSelectedStreet] = useState("");
  const [zoom, setZoom] = useState(3);
  const [exactPin, setExactPin] = useState<ExactPin | null>(null);
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [watchZones, setWatchZones] = useState<WatchZoneRecord[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [loadingIntel, setLoadingIntel] = useState(true);

  useEffect(() => {
    setAuthToken(window.localStorage.getItem("geopulse.token"));
  }, []);

  useEffect(() => {
    if (!authToken) {
      setLoadingIntel(false);
      return;
    }

    let active = true;
    const headers = {
      Authorization: `Token ${authToken}`,
    };

    async function loadIntel() {
      setLoadingIntel(true);
      try {
        const [incidentsResponse, watchZonesResponse, alertsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/incidents/`, { headers }),
          fetch(`${API_BASE_URL}/watch-zones/`, { headers }),
          fetch(`${API_BASE_URL}/alerts/`, { headers }),
        ]);

        if (!active) {
          return;
        }

        const [incidentsData, watchZonesData, alertsData] = await Promise.all([
          incidentsResponse.json(),
          watchZonesResponse.json(),
          alertsResponse.json(),
        ]);

        if (incidentsResponse.ok) {
          setIncidents(getList(incidentsData as ApiListResponse<IncidentRecord>));
        }
        if (watchZonesResponse.ok) {
          setWatchZones(getList(watchZonesData as ApiListResponse<WatchZoneRecord>));
        }
        if (alertsResponse.ok) {
          const mapped = getList(alertsData as ApiListResponse<Record<string, unknown>>).map((alert, index) => {
            const severity = String(alert.severity ?? "info").toLowerCase();
            const status = String(alert.status ?? "active").toUpperCase();
            return {
              id: Number(alert.id ?? index + 1),
              level: severity === "critical" ? "Critical" : severity === "high" ? "Warning" : "Info",
              time: relativeTime(String(alert.triggered_at ?? "")),
              title: String(alert.title ?? "Operational alert"),
              body: String(alert.message ?? "No message provided."),
              meta: status,
              tone: levelTone(severity),
              highlight: levelHighlight(severity),
            };
          });
          setAlerts(mapped);
        }
      } catch {
        if (!active) {
          return;
        }
      } finally {
        if (active) {
          setLoadingIntel(false);
        }
      }
    }

    void loadIntel();

    return () => {
      active = false;
    };
  }, [authToken]);

  const incidentPoints = useMemo(
    () =>
      incidents
        .map((incident) => {
          const latitude = toNumber(incident.latitude);
          const longitude = toNumber(incident.longitude);
          if (latitude === null || longitude === null) {
            return null;
          }
          return {
            id: incident.id,
            title: incident.title,
            severity: incident.severity,
            confidence: incident.confidence,
            latitude,
            longitude,
            locationName: incident.location_name,
          };
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [incidents],
  );

  const watchZonePoints = useMemo(
    () =>
      watchZones
        .map((zone) => {
          const latitude = toNumber(zone.centroid_latitude);
          const longitude = toNumber(zone.centroid_longitude);
          const riskScore = toNumber(zone.current_risk_score);
          if (latitude === null || longitude === null) {
            return null;
          }
          return {
            id: zone.id,
            name: zone.name,
            riskLevel: zone.current_risk_level,
            riskScore: riskScore ?? 0,
            latitude,
            longitude,
          };
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    [watchZones],
  );

  const locationLabel = useMemo(() => {
    const parts = [selectedState, selectedCity, selectedStreet].filter(Boolean);
    if (exactPin) {
      return `${parts.join(" / ") || exactPin.label} • ${exactPin.latitude.toFixed(5)}, ${exactPin.longitude.toFixed(5)}`;
    }
    if (parts.length > 0) {
      return parts.join(" / ");
    }
    if (mapFocus) {
      return `Viewport • ${mapFocus.latitude.toFixed(4)}, ${mapFocus.longitude.toFixed(4)}`;
    }
    return selectedState;
  }, [exactPin, mapFocus, selectedCity, selectedState, selectedStreet]);

  const metricCards = useMemo(
    () => [
      {
        label: "Active Incidents",
        title: `${incidentPoints.length}`,
        body: loadingIntel
          ? "Pulling live incident markers from the intelligence API."
          : `${incidentPoints.filter((incident) => incident.severity === "high" || incident.severity === "critical").length} high-severity incidents mapped.`,
        tone: "var(--tertiary-container)",
      },
      {
        label: "Watch Zones",
        title: `${watchZonePoints.length}`,
        body: loadingIntel
          ? "Resolving watch zone centroids and risk states."
          : `${watchZonePoints.filter((zone) => zone.riskLevel === "high" || zone.riskLevel === "critical").length} elevated zones currently active.`,
        tone: "var(--primary)",
      },
      {
        label: "Exact Pin",
        title: exactPin ? "Pinned" : "Standby",
        body: exactPin
          ? `${exactPin.latitude.toFixed(5)}, ${exactPin.longitude.toFixed(5)}`
          : "Use search, your location, or click the map to capture precise coordinates.",
        tone: "var(--secondary)",
      },
      {
        label: "Alerts Feed",
        title: `${alerts.length}`,
        body: loadingIntel
          ? "Syncing live operational alerts."
          : `${alerts.filter((alert) => alert.level !== "Info").length} action-oriented alerts require attention.`,
        tone: "var(--on-surface-variant)",
      },
    ],
    [alerts, exactPin, incidentPoints, loadingIntel, watchZonePoints],
  );

  function handleStateChange(nextState: string) {
    const stateData = nigeriaStates.find((entry) => entry.state === nextState) ?? nigeriaStates[0];
    setSelectedState(stateData.state);
    setSelectedCity("");
    setSelectedStreet("");
    setExactPin(null);
  }

  function handleCityChange(nextCity: string) {
    setSelectedCity(nextCity);
    setSelectedStreet("");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--on-surface)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(76,215,246,0.03),transparent_70%)]" />

      <div className="min-h-screen">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        {notificationsOpen ? (
          <>
            <button
              aria-label="Close notifications overlay"
              className="fixed inset-0 z-40 bg-black/55 lg:hidden"
              onClick={() => setNotificationsOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm lg:hidden">
              <div className="flex h-16 items-center justify-between border-b border-[rgb(61,73,76,0.28)] bg-[rgb(26,31,47,0.96)] px-5 backdrop-blur-xl">
                <p className="font-display text-xl font-semibold text-[var(--on-surface)]">
                  Notifications
                </p>
                <button
                  aria-label="Close notifications"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(61,73,76,0.3)] bg-[rgb(22,27,43,0.7)] text-white"
                  onClick={() => setNotificationsOpen(false)}
                >
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>
              <div className="h-[calc(100vh-64px)]">
                <LiveIntelligencePanel alerts={alerts} mobile />
              </div>
            </div>
          </>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col lg:ml-[280px]">
          <TopBar
            onMenuOpen={() => setMobileOpen(true)}
            onNotificationsOpen={() => setNotificationsOpen(true)}
            locationLabel={locationLabel}
          />

          <div className="grid min-h-0 flex-1 lg:grid-cols-12">
            <section className="relative min-h-[70vh] overflow-hidden border-r border-[rgb(61,73,76,0.2)] lg:col-span-9">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,14,28,1),rgba(14,19,34,1))]" />
              <div className="absolute inset-0 opacity-20 hud-grid" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(76,215,246,0.05),transparent_26%),radial-gradient(circle_at_76%_66%,rgba(78,222,163,0.04),transparent_18%)]" />
              <DashboardMap
                selectedState={selectedState}
                selectedCity={selectedCity}
                selectedStreet={selectedStreet}
                zoom={zoom}
                mapStyle={mapStyle}
                exactPin={exactPin}
                incidents={incidentPoints}
                watchZones={watchZonePoints}
                onMapStyleChange={setMapStyle}
                onStateChange={handleStateChange}
                onCityChange={handleCityChange}
                onStreetChange={setSelectedStreet}
                onZoomChange={setZoom}
                onExactPinChange={setExactPin}
                onFocusChange={setMapFocus}
              />

              <div className="absolute bottom-6 left-6 right-6 z-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metricCards.map((card) => (
                  <MetricCard key={card.label} {...card} />
                ))}
              </div>
            </section>

            <div className="hidden lg:col-span-3 lg:block">
              <LiveIntelligencePanel alerts={alerts} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
