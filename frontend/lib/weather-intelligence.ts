export type WeatherSeverity = "low" | "moderate" | "high" | "extreme";

export type WeatherOverlayPoint = {
  sourceId?: string;
  kind?: string;
  latitude: number;
  longitude: number;
  intensity: number;
  severity: WeatherSeverity;
  title: string;
  summary: string;
  precipitationMm?: number;
  visibilityKm?: number | null;
  weatherCode?: number | null;
  label?: string;
};

export type WeatherContext = {
  sourceId?: string;
  label: string;
  severity: WeatherSeverity;
  rainfallIntensity: string;
  visibility: string;
  summary: string;
  alerts: string[];
  precipitationMm?: number;
  visibilityKm?: number | null;
  weatherCode?: number | null;
};

export type WeatherRouteSegment = {
  sourceId?: string;
  start: [number, number];
  end: [number, number];
  severity: WeatherSeverity;
  summary: string;
  precipitationMm?: number;
  visibilityKm?: number | null;
};

export type WeatherRiskZoneAdjustment = {
  watchZoneId: string;
  weatherSeverity: WeatherSeverity;
  weatherAdjustedRiskScore: number;
  weatherAdjustedRiskLevel: string;
  summary: string;
};

export type WeatherAlert = {
  id: string;
  severity: WeatherSeverity;
  title: string;
  summary: string;
  latitude: number;
  longitude: number;
  sourceId: string;
};

export type WeatherIntelligenceResponse = {
  provider: string;
  fetchedAt: string;
  overlay: WeatherOverlayPoint[];
  incidentContexts: WeatherContext[];
  alerts: WeatherAlert[];
  riskZoneAdjustments: WeatherRiskZoneAdjustment[];
  route: {
    advisories: string[];
    segments: WeatherRouteSegment[];
    maxSeverity: WeatherSeverity;
  };
};

export type WeatherPointRequest = {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
  kind?: string;
  incidentType?: string;
  severity?: string;
  summary?: string;
  locationName?: string;
};

export type WeatherRiskZoneRequest = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  riskLevel: string;
  riskScore: number;
};

function fallbackId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSeverity(value?: string | null): WeatherSeverity {
  if (value === "extreme" || value === "high" || value === "moderate") return value;
  return "low";
}

export function weatherSeverityLabel(severity: WeatherSeverity) {
  if (severity === "extreme") return "Extreme";
  if (severity === "high") return "High";
  if (severity === "moderate") return "Moderate";
  return "Low";
}

export function toWeatherIntelligenceResponse(payload: unknown): WeatherIntelligenceResponse {
  const source = (payload ?? {}) as Record<string, unknown>;

  return {
    provider: String(source.provider ?? "Unknown provider"),
    fetchedAt: String(source.fetched_at ?? new Date().toISOString()),
    overlay: Array.isArray(source.overlay)
      ? source.overlay.map((item) => {
          const entry = item as Record<string, unknown>;
          return {
            sourceId: entry.source_id ? String(entry.source_id) : undefined,
            kind: entry.kind ? String(entry.kind) : undefined,
            latitude: Number(entry.latitude ?? 0),
            longitude: Number(entry.longitude ?? 0),
            intensity: Number(entry.intensity ?? 0),
            severity: normalizeSeverity(String(entry.severity ?? "low")),
            title: String(entry.title ?? "Weather signal"),
            summary: String(entry.summary ?? ""),
            precipitationMm:
              typeof entry.precipitation_mm === "number"
                ? entry.precipitation_mm
                : Number(entry.precipitation_mm ?? 0),
            visibilityKm:
              entry.visibility_km === null || entry.visibility_km === undefined
                ? null
                : Number(entry.visibility_km),
            weatherCode:
              entry.weather_code === null || entry.weather_code === undefined
                ? null
                : Number(entry.weather_code),
            label: entry.label ? String(entry.label) : undefined,
          };
        })
      : [],
    incidentContexts: Array.isArray(source.incident_contexts)
      ? source.incident_contexts.map((item) => {
          const entry = item as Record<string, unknown>;
          return {
            sourceId: entry.source_id ? String(entry.source_id) : undefined,
            label: String(entry.label ?? "Weather context"),
            severity: normalizeSeverity(String(entry.severity ?? "low")),
            rainfallIntensity: String(entry.rainfall_intensity ?? "Unknown"),
            visibility: String(entry.visibility ?? "Unknown"),
            summary: String(entry.summary ?? ""),
            alerts: Array.isArray(entry.alerts) ? entry.alerts.map((alert) => String(alert)) : [],
            precipitationMm:
              typeof entry.precipitation_mm === "number"
                ? entry.precipitation_mm
                : Number(entry.precipitation_mm ?? 0),
            visibilityKm:
              entry.visibility_km === null || entry.visibility_km === undefined
                ? null
                : Number(entry.visibility_km),
            weatherCode:
              entry.weather_code === null || entry.weather_code === undefined
                ? null
                : Number(entry.weather_code),
          };
        })
      : [],
    alerts: Array.isArray(source.alerts)
      ? source.alerts.map((item) => {
        const entry = item as Record<string, unknown>;
        return {
            id: String(entry.id ?? fallbackId("weather-alert")),
            severity: normalizeSeverity(String(entry.severity ?? "low")),
            title: String(entry.title ?? "Weather alert"),
            summary: String(entry.summary ?? ""),
            latitude: Number(entry.latitude ?? 0),
            longitude: Number(entry.longitude ?? 0),
            sourceId: String(entry.source_id ?? ""),
          };
        })
      : [],
    riskZoneAdjustments: Array.isArray(source.risk_zone_adjustments)
      ? source.risk_zone_adjustments.map((item) => {
          const entry = item as Record<string, unknown>;
          return {
            watchZoneId: String(entry.watch_zone_id ?? ""),
            weatherSeverity: normalizeSeverity(String(entry.weather_severity ?? "low")),
            weatherAdjustedRiskScore: Number(entry.weather_adjusted_risk_score ?? 0),
            weatherAdjustedRiskLevel: String(entry.weather_adjusted_risk_level ?? "baseline"),
            summary: String(entry.summary ?? ""),
          };
        })
      : [],
    route: {
      advisories:
        source.route && typeof source.route === "object" && Array.isArray((source.route as Record<string, unknown>).advisories)
          ? ((source.route as Record<string, unknown>).advisories as unknown[]).map((advisory) => String(advisory))
          : [],
      segments:
        source.route && typeof source.route === "object" && Array.isArray((source.route as Record<string, unknown>).segments)
          ? ((source.route as Record<string, unknown>).segments as unknown[]).map((item) => {
              const entry = item as Record<string, unknown>;
              return {
                sourceId: entry.source_id ? String(entry.source_id) : undefined,
                start: [Number((entry.start as [number, number])?.[0] ?? 0), Number((entry.start as [number, number])?.[1] ?? 0)] as [number, number],
                end: [Number((entry.end as [number, number])?.[0] ?? 0), Number((entry.end as [number, number])?.[1] ?? 0)] as [number, number],
                severity: normalizeSeverity(String(entry.severity ?? "low")),
                summary: String(entry.summary ?? ""),
                precipitationMm:
                  entry.precipitation_mm === undefined ? undefined : Number(entry.precipitation_mm),
                visibilityKm:
                  entry.visibility_km === null || entry.visibility_km === undefined
                    ? null
                    : Number(entry.visibility_km),
              };
            })
          : [],
      maxSeverity:
        source.route && typeof source.route === "object"
          ? normalizeSeverity(String((source.route as Record<string, unknown>).max_severity ?? "low"))
          : "low",
    },
  };
}

export function mapIncidentWeatherContexts(items: WeatherContext[]) {
  return new Map(items.map((item) => [item.sourceId ?? "", item]));
}

export function mapRiskZoneAdjustments(items: WeatherRiskZoneAdjustment[]) {
  return new Map(items.map((item) => [item.watchZoneId, item]));
}
