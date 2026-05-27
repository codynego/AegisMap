"use client";

/**
 * DashboardMap — GeoPulse Nigeria
 *
 * Self-contained Mapbox map component with mobile-first Google Maps-style layout:
 * - Map fills the full screen (absolute inset-0)
 * - Controls panel slides up from bottom on mobile (like Google Maps)
 * - Sidebar drawer on desktop (≥768px)
 * - Incidents/watchzones rendered via markers
 * - Pinpoint mode, geolocation, style switching
 *
 * SETUP:
 *   Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your .env.local
 *   npm install mapbox-gl
 *   npm install --save-dev @types/mapbox-gl
 *
 * Add to globals.css (or layout):
 *   @import "mapbox-gl/dist/mapbox-gl.css";
 */

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";
import { normalizeReportType, reportTypeColor } from "@/lib/report-types";
import { reverseGeocodeLocation, searchLocations, type LocationSearchResult } from "@/lib/location-search";
import type { WeatherOverlayPoint, WeatherRouteSegment } from "@/lib/weather-intelligence";

// ─── Nigeria states ───────────────────────────────────────────────────────────

const NIGERIA_STATES: { state: string; center: [number, number] }[] = [
  { state: "Abia", center: [7.3667, 5.4167] },
  { state: "Adamawa", center: [12.3984, 9.3265] },
  { state: "Akwa Ibom", center: [7.8497, 4.9057] },
  { state: "Anambra", center: [6.9926, 6.2209] },
  { state: "Bauchi", center: [9.7492, 10.3158] },
  { state: "Bayelsa", center: [6.0671, 4.7719] },
  { state: "Benue", center: [8.7955, 7.1906] },
  { state: "Borno", center: [13.0781, 11.8333] },
  { state: "Cross River", center: [8.3267, 5.9631] },
  { state: "Delta", center: [6.1167, 5.4839] },
  { state: "Ebonyi", center: [8.0832, 6.3249] },
  { state: "Edo", center: [5.6037, 6.3350] },
  { state: "Ekiti", center: [5.2210, 7.6222] },
  { state: "Enugu", center: [7.4850, 6.4584] },
  { state: "FCT Abuja", center: [7.4898, 9.0579] },
  { state: "Gombe", center: [11.1667, 10.2791] },
  { state: "Imo", center: [7.0498, 5.4966] },
  { state: "Jigawa", center: [9.5582, 12.2280] },
  { state: "Kaduna", center: [7.4440, 10.5222] },
  { state: "Kano", center: [8.5169, 12.0022] },
  { state: "Katsina", center: [7.6013, 12.9908] },
  { state: "Kebbi", center: [4.1975, 12.4539] },
  { state: "Kogi", center: [6.7387, 7.7337] },
  { state: "Kwara", center: [4.5539, 8.9669] },
  { state: "Lagos", center: [3.3792, 6.5244] },
  { state: "Nasarawa", center: [8.5259, 8.4966] },
  { state: "Niger", center: [5.5983, 9.9309] },
  { state: "Ogun", center: [3.3500, 7.1600] },
  { state: "Ondo", center: [4.8331, 6.9149] },
  { state: "Osun", center: [4.5584, 7.5629] },
  { state: "Oyo", center: [3.9470, 7.8504] },
  { state: "Plateau", center: [8.8921, 9.2182] },
  { state: "Rivers", center: [6.9980, 4.8156] },
  { state: "Sokoto", center: [5.2474, 13.0059] },
  { state: "Taraba", center: [11.4581, 7.8737] },
  { state: "Yobe", center: [11.5883, 12.2938] },
  { state: "Zamfara", center: [6.2370, 12.1700] },
];

const NIGERIA_DEFAULT_CENTER: [number, number] = [8.6753, 9.0820];
const NIGERIA_DEFAULT_ZOOM = 6.2;

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchOption = {
  id: string;
  label: string;
  coordinates: [number, number];
  state?: string;
};

type ExactPin = {
  latitude: number;
  longitude: number;
  label: string;
};

type IncidentPoint = {
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
  visibilityScore?: number;
};

type WatchZonePoint = {
  id: number;
  name: string;
  riskLevel: string;
  riskScore: number;
  latitude: number;
  longitude: number;
};

type GeofencePoint = {
  id: number;
  name: string;
  geofenceType: string;
  status: string;
  description: string;
  radiusMeters: number;
  latitude: number;
  longitude: number;
};

type RouteStop = {
  label: string;
  latitude: number;
  longitude: number;
  kind?: "origin" | "waypoint" | "destination";
};

type TrackedPosition = {
  latitude: number;
  longitude: number;
  label?: string;
};

type DroppedPinPoint = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  action: PinAction;
  note?: string;
  radiusMeters?: number;
  createdAt: string;
  color: string;
};

type PinAction =
  | "report_incident"
  | "watch_area"
  | "watch_zone"
  | "mark_hazard"
  | "save_location"
  | "request_help"
  | "add_observation";

type PinActionOption = {
  id: PinAction;
  label: string;
  description: string;
  accent: string;
};

type PinActionPayload = {
  hazardType?: string;
  observationText?: string;
  helpType?: string;
};

type DashboardMapProps = {
  centerLatitude?: number;
  centerLongitude?: number;
  fitBoundsTrigger?: number;
  fitBoundsPath?: Array<[number, number]>;
  selectedState?: string;
  selectedCity?: string;
  selectedStreet?: string;
  zoom?: number;
  mapStyle?: string;
  exactPin?: ExactPin | null;
  incidents?: IncidentPoint[];
  watchZones?: WatchZonePoint[];
  geofences?: GeofencePoint[];
  showIncidents?: boolean;
  showHeatmap?: boolean;
  showRiskZones?: boolean;
  showGeofencing?: boolean;
  showWeatherLayer?: boolean;
  emphasizeRecentIncidents?: boolean;
  allowDirectPinDrop?: boolean;
  dropPinMode?: boolean;
  showControlsUi?: boolean;
  showDropPinTool?: boolean;
  routePath?: Array<[number, number]>;
  routeStops?: RouteStop[];
  trackedPosition?: TrackedPosition | null;
  followTrackedPosition?: boolean;
  droppedPins?: DroppedPinPoint[];
  myPins?: DroppedPinPoint[];
  weatherOverlay?: WeatherOverlayPoint[];
  routeWeatherSegments?: WeatherRouteSegment[];
  onIncidentSelect?: (incident: IncidentPoint) => void;
  onMapStyleChange?: (value: string) => void;
  onStateChange?: (value: string) => void;
  onCityChange?: (value: string) => void;
  onStreetChange?: (value: string) => void;
  onZoomChange?: (value: number) => void;
  onExactPinChange?: (value: ExactPin | null) => void;
  onFocusChange?: (value: { latitude: number; longitude: number } | null) => void;
  onMapClick?: (coords: { latitude: number; longitude: number }) => void;
  onMapHoverChange?: (value: { latitude: number; longitude: number; clientX: number; clientY: number } | null) => void;
  onPinActionSelect?: (action: PinAction, pin: ExactPin, payload?: PinActionPayload) => void;
  onDroppedPinSelect?: (pin: DroppedPinPoint) => void;
  controlsTargetId?: string;
  mode?: "controls" | "incident" | "filter" | "my_pins" | "pin_detail" | "pin_action";
  onRequestModeChange?: (mode: "controls" | "incident" | "filter" | "my_pins" | "pin_detail" | "pin_action") => void;
  selectedIncident?: IncidentPoint | null;
  onClearSelectedIncident?: () => void;
  filterPanel?: ReactNode;
  mobileFeedPanel?: ReactNode;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_STYLES = [
  { label: "Dark", value: "mapbox://styles/mapbox/dark-v11" },
  { label: "Standard", value: "mapbox://styles/mapbox/standard" },
  { label: "Satellite", value: "mapbox://styles/mapbox/standard-satellite" },
  { label: "Streets", value: "mapbox://styles/mapbox/satellite-streets-v12" },
] as const;

const PIN_ACTION_OPTIONS: PinActionOption[] = [
  {
    id: "report_incident",
    label: "Report incident",
    description: "Open the incident workflow with this location attached.",
    accent: "#ff5f6d",
  },
  {
    id: "watch_zone",
    label: "Watch this area",
    description: "Turn this into a geofence or temporary monitoring area.",
    accent: "#4edea3",
  },
  {
    id: "mark_hazard",
    label: "Mark hazard",
    description: "Flag road damage, blockage, or route risk here.",
    accent: "#f8c15b",
  },
  {
    id: "save_location",
    label: "Save location",
    description: "Bookmark this point for later use.",
    accent: "#4cd7f6",
  },
  {
    id: "request_help",
    label: "Request help",
    description: "Prepare this point for emergency support or rescue.",
    accent: "#ff9c5a",
  },
  {
    id: "add_observation",
    label: "Add observation",
    description: "Capture a low-confidence note or situational clue.",
    accent: "#8f7dff",
  },
];

const HAZARD_TYPE_OPTIONS = [
  { value: "road_obstruction", label: "Road obstruction" },
  { value: "flooding", label: "Flooding" },
  { value: "fire_outbreak", label: "Fire outbreak" },
  { value: "road_accident", label: "Road accident" },
] as const;

const HELP_TYPE_OPTIONS = [
  { value: "medical_emergency", label: "Medical emergency" },
  { value: "rescue", label: "Rescue support" },
  { value: "security", label: "Security assistance" },
  { value: "evacuation", label: "Evacuation support" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMapZoom(level: number) {
  return 7.6 + level * 1.15;
}

function fmtCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function severityColor(s: string) {
  if (s === "critical" || s === "high") return "#ff5f6d";
  if (s === "medium") return "#f8c15b";
  return "#4cd7f6";
}

function incidentColor(type: string, severity: string) {
  const color = reportTypeColor(normalizeReportType(type));
  return color || severityColor(severity);
}

function riskColor(level: string) {
  if (level === "critical" || level === "high") return "#ff5f6d";
  if (level === "medium") return "#f8c15b";
  return "#4edea3";
}

function weatherColor(severity: string) {
  if (severity === "extreme") return "#ff5f6d";
  if (severity === "high") return "#f8c15b";
  if (severity === "moderate") return "#4cd7f6";
  return "#4edea3";
}

function geofenceColor(type: string) {
  const palette: Record<string, string> = {
    school: "#4cd7f6",
    village: "#4edea3",
    highway: "#f8c15b",
    pipeline: "#ff9c5a",
    facility: "#8f7dff",
    custom: "#ff817a",
  };
  return palette[type] ?? "#4cd7f6";
}

function isFresh(incident: IncidentPoint) {
  const age = (Date.now() - new Date(incident.detectedAt).getTime()) / 60000;
  return age <= 180 && (incident.severity === "high" || incident.severity === "critical");
}

function getIncidentRecencyVisuals(
  incident: IncidentPoint,
  emphasizeRecentIncidents: boolean,
) {
  const visibilityScore =
    typeof incident.visibilityScore === "number" && Number.isFinite(incident.visibilityScore)
      ? Math.max(0, Math.min(1, incident.visibilityScore))
      : null;

  const detectedAtMs = new Date(incident.detectedAt).getTime();
  if (Number.isNaN(detectedAtMs)) {
    return {
      opacity: visibilityScore ?? (emphasizeRecentIncidents ? 0.72 : 0.88),
      size: emphasizeRecentIncidents ? 11 : 12,
      glowAlpha: emphasizeRecentIncidents ? "66" : "88",
      ringOpacity: emphasizeRecentIncidents ? 0.82 : 0.9,
      heatmapWeight: visibilityScore ?? 1,
    };
  }

  const ageHours = Math.max(0, (Date.now() - detectedAtMs) / (1000 * 60 * 60));

  if (!emphasizeRecentIncidents) {
    const fallback = {
      opacity: ageHours > 24 * 30 ? 0.76 : 0.88,
      size: ageHours > 24 * 30 ? 11 : 12,
      glowAlpha: ageHours > 24 * 30 ? "5c" : "82",
      ringOpacity: 0.86,
      heatmapWeight: ageHours > 24 * 30 ? 0.85 : 1,
    };
    if (visibilityScore === null) return fallback;
    return {
      ...fallback,
      opacity: Math.max(0.12, visibilityScore),
      heatmapWeight: Math.max(0.1, visibilityScore),
      glowAlpha: visibilityScore >= 0.75 ? "82" : visibilityScore >= 0.4 ? "5c" : "36",
    };
  }

  if (ageHours <= 6) {
    return { opacity: 1, size: 14, glowAlpha: "aa", ringOpacity: 0.96, heatmapWeight: 1.2 };
  }
  if (ageHours <= 24) {
    return { opacity: 0.95, size: 13, glowAlpha: "96", ringOpacity: 0.93, heatmapWeight: 1.05 };
  }
  if (ageHours <= 72) {
    return { opacity: 0.84, size: 12, glowAlpha: "80", ringOpacity: 0.9, heatmapWeight: 0.9 };
  }
  if (ageHours <= 24 * 7) {
    return { opacity: 0.68, size: 11, glowAlpha: "64", ringOpacity: 0.82, heatmapWeight: 0.72 };
  }
  if (ageHours <= 24 * 30) {
    return { opacity: 0.5, size: 10, glowAlpha: "4d", ringOpacity: 0.72, heatmapWeight: 0.5 };
  }
  const fallback = { opacity: 0.34, size: 9, glowAlpha: "36", ringOpacity: 0.62, heatmapWeight: 0.32 };
  if (visibilityScore === null) return fallback;
  return {
    ...fallback,
    opacity: Math.max(0.08, visibilityScore),
    heatmapWeight: Math.max(0.05, visibilityScore),
    glowAlpha: visibilityScore >= 0.75 ? "96" : visibilityScore >= 0.4 ? "5c" : "24",
  };
}

function makeCircle(color: string, size: number, active: boolean): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", "Map marker");
  Object.assign(el.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    background: color,
    border: active ? "2.5px solid rgba(255,255,255,0.95)" : "1.5px solid rgba(9,14,28,0.6)",
    boxShadow: active
      ? `0 0 0 6px ${color}22, 0 2px 12px ${color}55`
      : `0 1px 6px rgba(0,0,0,0.4)`,
    cursor: "pointer",
    transition: "transform 0.15s",
  });
  el.onmouseenter = () => (el.style.transform = "scale(1.2)");
  el.onmouseleave = () => (el.style.transform = "scale(1)");
  return el;
}

function makeIncidentDot(
  color: string,
  blink: boolean,
  options: {
    opacity: number;
    size: number;
    glowAlpha: string;
    ringOpacity: number;
  },
): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", "Incident");
  Object.assign(el.style, {
    width: `${options.size}px`,
    height: `${options.size}px`,
    borderRadius: "50%",
    background: color,
    opacity: String(options.opacity),
    border: `2px solid rgba(255,255,255,${options.ringOpacity})`,
    boxShadow: `0 0 ${Math.max(8, options.size)}px ${color}${options.glowAlpha}`,
    cursor: "pointer",
    transformOrigin: "center center",
    transition: "opacity 0.15s, box-shadow 0.15s",
  });
  if (blink) {
    el.style.animation = "gp-blink 1.6s ease-in-out infinite";
  }
  el.onmouseenter = () => {
    el.style.opacity = "1";
    el.style.boxShadow = `0 0 ${Math.max(10, options.size + 2)}px ${color}${options.glowAlpha}`;
  };
  el.onmouseleave = () => {
    el.style.opacity = String(options.opacity);
    el.style.boxShadow = `0 0 ${Math.max(8, options.size)}px ${color}${options.glowAlpha}`;
  };
  return el;
}

function makePinpoint(): HTMLElement {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "relative",
    width: "28px",
    height: "28px",
    pointerEvents: "none",
  });
  const ring = document.createElement("div");
  Object.assign(ring.style, {
    position: "absolute",
    inset: "0",
    borderRadius: "50%",
    background: "rgba(76,215,246,0.15)",
    animation: "gp-pulse 2s infinite",
  });
  const dot = document.createElement("div");
  Object.assign(dot.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "13px",
    height: "13px",
    transform: "translate(-50%,-50%)",
    borderRadius: "50%",
    background: "#4cd7f6",
    border: "2.5px solid white",
  });
  wrap.append(ring, dot);
  return wrap;
}

function makeRouteStopMarker(kind: RouteStop["kind"] = "waypoint"): HTMLElement {
  const color =
    kind === "origin" ? "#4edea3" : kind === "destination" ? "#ff5f6d" : "#f8c15b";
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    background: color,
    border: "2px solid rgba(255,255,255,0.95)",
    boxShadow: `0 0 0 6px ${color}22, 0 4px 18px ${color}66`,
  });
  return el;
}

function makeTrackedPositionMarker(): HTMLElement {
  const wrap = document.createElement("div");
  Object.assign(wrap.style, {
    position: "relative",
    width: "26px",
    height: "26px",
  });
  const ring = document.createElement("div");
  Object.assign(ring.style, {
    position: "absolute",
    inset: "0",
    borderRadius: "50%",
    background: "rgba(76, 215, 246, 0.18)",
    animation: "gp-pulse 1.8s infinite",
  });
  const dot = document.createElement("div");
  Object.assign(dot.style, {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "12px",
    height: "12px",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    background: "#4cd7f6",
    border: "3px solid white",
    boxShadow: "0 0 18px rgba(76,215,246,0.7)",
  });
  wrap.append(ring, dot);
  return wrap;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardMap({
  centerLatitude,
  centerLongitude,
  fitBoundsTrigger,
  fitBoundsPath,
  selectedState: initialState = "",
  selectedCity: initialCity = "",
  selectedStreet: initialStreet = "",
  zoom: initialZoom = 2,
  mapStyle: initialMapStyle = MAP_STYLES[0].value,
  exactPin: initialExactPin = null,
  incidents = [],
  watchZones = [],
  geofences = [],
  showIncidents = true,
  showHeatmap = true,
  showRiskZones = true,
  showGeofencing = true,
  showWeatherLayer = false,
  emphasizeRecentIncidents = true,
  allowDirectPinDrop = false,
  dropPinMode = false,
  showControlsUi = true,
  showDropPinTool = true,
  routePath = [],
  routeStops = [],
  trackedPosition = null,
  followTrackedPosition = false,
  droppedPins = [],
  myPins = [],
  onIncidentSelect,
  onMapStyleChange,
  onStateChange,
  onCityChange,
  onStreetChange,
  onZoomChange,
  onExactPinChange,
  onFocusChange,
  onMapClick,
  onMapHoverChange,
  onPinActionSelect,
  onDroppedPinSelect,
  controlsTargetId,
  mode = "controls",
  onRequestModeChange,
  selectedIncident,
  onClearSelectedIncident,
  filterPanel,
  weatherOverlay = [],
  routeWeatherSegments = [],
}: DashboardMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  // Map refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const pinpointModeRef = useRef(false);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const incidentMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const routeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const pinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const droppedPinMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const trackedMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const styleRef = useRef<string>(MAP_STYLES[0].value);
  const focusKeyRef = useRef<string | null>(null);

  // UI state
  const [loaded, setLoaded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedState, setSelectedState] = useState(initialState);
  const [pinpointMode, setPinpointMode] = useState(false);
  const [pinActionPin, setPinActionPin] = useState<ExactPin | null>(null);
  const [pinActionSheetOpen, setPinActionSheetOpen] = useState(false);
  const [pendingPinAction, setPendingPinAction] = useState<PinAction | null>(null);
  const [hazardType, setHazardType] = useState<string>(HAZARD_TYPE_OPTIONS[0].value);
  const [helpType, setHelpType] = useState<string>(HELP_TYPE_OPTIONS[0].value);
  const [observationText, setObservationText] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Search state
  const [addressQuery, setAddressQuery] = useState(initialStreet || initialCity || initialState);
  const [addressOptions, setAddressOptions] = useState<SearchOption[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<SearchOption | null>(null);
  const [isAddressSuggestionOpen, setIsAddressSuggestionOpen] = useState(false);
  const [isLoadingAddressOptions, setIsLoadingAddressOptions] = useState(false);
  const addressSearchRequestRef = useRef(0);
  const selectedStateRef = useRef(initialState);

  const stateData = useMemo(
    () => NIGERIA_STATES.find((s) => s.state === selectedState) ?? null,
    [selectedState],
  );
  const stateZoom = 8.5;
  const mapStyle = initialMapStyle;
  const zoomLevel = initialZoom;
  const exactPin = initialExactPin;
  const overrideCenter =
    typeof centerLatitude === "number" && typeof centerLongitude === "number"
      ? ([centerLongitude, centerLatitude] as [number, number])
      : null;

  const focusCenter: [number, number] =
    overrideCenter ?? selectedAddress?.coordinates ?? stateData?.center ?? NIGERIA_DEFAULT_CENTER;

  // ── Keep pinpointModeRef in sync ──
  useEffect(() => {
    pinpointModeRef.current = pinpointMode;
  }, [pinpointMode]);

  useEffect(() => {
    selectedStateRef.current = selectedState;
  }, [selectedState]);

  useEffect(() => {
    if (!exactPin) {
      setPinActionPin(null);
      setPinActionSheetOpen(false);
      return;
    }

    if (!pinActionPin) {
      return;
    }

    const matchesDroppedPin =
      pinActionPin.latitude === exactPin.latitude && pinActionPin.longitude === exactPin.longitude;

    if (!matchesDroppedPin) {
      setPinActionPin(null);
      setPinActionSheetOpen(false);
    }
  }, [exactPin, pinActionPin]);

  useEffect(() => {
    setSelectedState(initialState);
    selectedStateRef.current = initialState;
  }, [initialState]);

  // ── Inject keyframe animations once ──
  useEffect(() => {
    const id = "geopulse-keyframes";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes gp-pulse { 0%,100%{transform:scale(1);opacity:0.8} 50%{transform:scale(1.6);opacity:0} }
      @keyframes gp-blink { 0%,100%{opacity:1} 50%{opacity:0.35} }
      .mapboxgl-ctrl-bottom-left { bottom: env(safe-area-inset-bottom, 0px) !important; }
      .mapboxgl-popup-content { background: #0d1426 !important; border: 1px solid rgba(76,215,246,0.25) !important; border-radius: 12px !important; padding: 10px 14px !important; color: #dee1f7 !important; font-family: ui-monospace, monospace !important; font-size: 13px !important; }
      .mapboxgl-popup-tip { border-top-color: #0d1426 !important; border-bottom-color: #0d1426 !important; }
    `;
    document.head.appendChild(style);
  }, []);

  // ── Address geocode ──
  useEffect(() => {
    const query = addressQuery.trim();
    if (query.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setAddressOptions([]);
        setIsLoadingAddressOptions(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    if (!isAddressSuggestionOpen) {
      return;
    }
    const requestId = addressSearchRequestRef.current + 1;
    addressSearchRequestRef.current = requestId;
    searchLocations(addressQuery, 8, { state: selectedStateRef.current })
      .then((results) => {
        if (addressSearchRequestRef.current !== requestId) return;
        setAddressOptions(
          results.map((result: LocationSearchResult) => ({
            id: result.id,
            label: result.label,
            coordinates: [result.longitude, result.latitude],
            state: result.state,
          })),
        );
      })
      .catch(() => {
        if (addressSearchRequestRef.current !== requestId) return;
        setAddressOptions([]);
      })
      .finally(() => {
        if (addressSearchRequestRef.current === requestId) {
          setIsLoadingAddressOptions(false);
        }
      });
  }, [addressQuery, isAddressSuggestionOpen, token]);

  // ── Init map ──
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleRef.current,
      center: focusCenter,
      zoom: selectedAddress || exactPin ? toMapZoom(zoomLevel) : stateData ? stateZoom : NIGERIA_DEFAULT_ZOOM,
      pitch: 38,
      bearing: -12,
      antialias: true,
      projection: "mercator",
    });

    mapRef.current = map;
    if (window.innerWidth >= 768) {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-left");
      map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-right");
    }

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current!);

    const onLoad = () => {
      if (map.getTerrain()) map.setTerrain(null);
      map.resize();
      loadedRef.current = true;
      setLoaded(true);
    };

    const onZoomEnd = () => {
      const lvl = Math.min(5, Math.max(1, Math.round((map.getZoom() - 7.6) / 1.15)));
      onZoomChange?.(lvl);
    };

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      if (dropPinMode) {
        onMapClick?.({ latitude: lat, longitude: lng });
        setStatusMsg("Map location captured. Choose what to do next.");
        return;
      }
      if (!pinpointModeRef.current && !allowDirectPinDrop) return;
      const nextPin = { latitude: lat, longitude: lng, label: `Pinned • ${fmtCoords(lat, lng)}` };
      setPinActionPin(nextPin);
      setPinActionSheetOpen(true);
      onExactPinChange?.(nextPin);
      onFocusChange?.({ latitude: lat, longitude: lng });
      setStatusMsg("Pin dropped. Choose the next action for this location.");
    };

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      onMapHoverChange?.({
        latitude: e.lngLat.lat,
        longitude: e.lngLat.lng,
        clientX: e.originalEvent?.clientX ?? 0,
        clientY: e.originalEvent?.clientY ?? 0,
      });
    };

    const onMouseLeave = () => {
      onMapHoverChange?.(null);
    };

    map.on("load", onLoad);
    map.on("style.load", onLoad);
    map.on("zoomend", onZoomEnd);
    map.on("click", onClick);
    map.on("mousemove", onMouseMove);
    map.on("mouseleave", onMouseLeave);
    map.on("error", (e) => setStatusMsg(e.error?.message ?? "Map error."));

    return () => {
      markersRef.current.forEach((m) => m.remove());
      incidentMarkersRef.current.forEach((m) => m.remove());
      routeMarkersRef.current.forEach((m) => m.remove());
      pinMarkerRef.current?.remove();
      trackedMarkerRef.current?.remove();
      loadedRef.current = false;
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Style change ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleRef.current === mapStyle) return;
    styleRef.current = mapStyle;
    setLoaded(false);
    loadedRef.current = false;
    map.setStyle(mapStyle);
  }, [mapStyle]);

  // ── Fly to center ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const nextFocusKey = `${focusCenter[0].toFixed(6)}:${focusCenter[1].toFixed(6)}`;
    if (focusKeyRef.current === nextFocusKey) return;

    focusKeyRef.current = nextFocusKey;
    map.flyTo({
      center: focusCenter,
      zoom: selectedAddress ? toMapZoom(zoomLevel) : stateData ? stateZoom : NIGERIA_DEFAULT_ZOOM,
      speed: 0.85,
      curve: 1.2,
      essential: true,
    });
    onFocusChange?.({ latitude: focusCenter[1], longitude: focusCenter[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, focusCenter, zoomLevel, selectedAddress]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !selectedIncident) return;

    map.flyTo({
      center: [selectedIncident.longitude, selectedIncident.latitude],
      zoom: Math.max(map.getZoom(), 12),
      speed: 0.8,
      curve: 1.15,
      essential: true,
    });
    onFocusChange?.({
      latitude: selectedIncident.latitude,
      longitude: selectedIncident.longitude,
    });
  }, [loaded, onFocusChange, selectedIncident]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || routePath.length < 2) return;

    const SRC = "gp-route-path";
    const LINE_LAYER = "gp-route-path-line";
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: routePath,
          },
          properties: {},
        },
      ],
    };

    const src = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(collection);
    } else {
      map.addSource(SRC, { type: "geojson", data: collection });
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SRC,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#4cd7f6",
          "line-width": 4,
          "line-opacity": 0.95,
          "line-dasharray": [1, 1.25],
        },
      });
    }

    routeMarkersRef.current.forEach((marker) => marker.remove());
    routeMarkersRef.current = [];
    routeStops.forEach((stop) => {
      const popup = new mapboxgl.Popup({ offset: 14 }).setHTML(
        `<div><strong>${stop.label}</strong><br/><span style="font-size:11px;opacity:0.65">${fmtCoords(stop.latitude, stop.longitude)}</span></div>`,
      );
      const marker = new mapboxgl.Marker({
        element: makeRouteStopMarker(stop.kind),
        anchor: "center",
      })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(popup)
        .addTo(map);
      routeMarkersRef.current.push(marker);
    });

    const bounds = routePath.reduce(
      (acc, coordinate) => acc.extend(coordinate as [number, number]),
      new mapboxgl.LngLatBounds(routePath[0], routePath[0]),
    );
    map.fitBounds(bounds, { padding: 72, duration: 900, maxZoom: 9 });

    return () => {
      routeMarkersRef.current.forEach((marker) => marker.remove());
      routeMarkersRef.current = [];
    };
  }, [loaded, routePath, routeStops]);

  useEffect(() => {
    const map = mapRef.current;
    const nextPath = fitBoundsPath ?? routePath;
    if (!map || !loaded || nextPath.length < 2) return;

    const bounds = nextPath.reduce(
      (acc, coordinate) => acc.extend(coordinate as [number, number]),
      new mapboxgl.LngLatBounds(nextPath[0], nextPath[0]),
    );
    map.fitBounds(bounds, { padding: 72, duration: 900, maxZoom: 9 });
  }, [fitBoundsPath, fitBoundsTrigger, loaded, routePath]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const SRC = "gp-route-weather-segments";
    const LAYER = "gp-route-weather-segments-line";
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: routeWeatherSegments.map((segment) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [segment.start, segment.end],
        },
        properties: {
          color: weatherColor(segment.severity),
          summary: segment.summary,
          severity: segment.severity,
        },
      })),
    };

    const src = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(collection);
    } else {
      map.addSource(SRC, { type: "geojson", data: collection });
      map.addLayer({
        id: LAYER,
        type: "line",
        source: SRC,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 7,
          "line-opacity": 0.78,
        },
      });
      map.on("click", LAYER, (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "LineString") return;
        const coords = feature.geometry.coordinates as [number, number][];
        const mid = coords[Math.max(0, Math.floor(coords.length / 2) - 1)] ?? coords[0];
        new mapboxgl.Popup({ offset: 18, maxWidth: "230px" })
          .setLngLat(mid)
          .setHTML(
            `<div>
              <strong style="display:block;margin-bottom:4px">${String(feature.properties?.severity ?? "weather").toUpperCase()} weather segment</strong>
              <span style="display:block;font-size:11px;opacity:0.72">${feature.properties?.summary ?? ""}</span>
            </div>`,
          )
          .addTo(map);
      });
    }

    if (map.getLayer(LAYER)) {
      map.setLayoutProperty(LAYER, "visibility", routeWeatherSegments.length > 0 ? "visible" : "none");
    }
  }, [loaded, routeWeatherSegments]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    trackedMarkerRef.current?.remove();
    trackedMarkerRef.current = null;

    if (!trackedPosition) return;

    trackedMarkerRef.current = new mapboxgl.Marker({
      element: makeTrackedPositionMarker(),
      anchor: "center",
    })
      .setLngLat([trackedPosition.longitude, trackedPosition.latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 16 }).setHTML(
          `<div><strong>${trackedPosition.label ?? "Current position"}</strong><br/><span style="font-size:11px;opacity:0.6">${fmtCoords(trackedPosition.latitude, trackedPosition.longitude)}</span></div>`,
        ),
      )
      .addTo(map);

    if (followTrackedPosition) {
      map.easeTo({
        center: [trackedPosition.longitude, trackedPosition.latitude],
        duration: 900,
        essential: true,
      });
    }
  }, [followTrackedPosition, loaded, trackedPosition]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    droppedPinMarkersRef.current.forEach((marker) => marker.remove());
    droppedPinMarkersRef.current = [];

    if (droppedPins.length === 0) return;

    droppedPins.forEach((pin) => {
      const marker = new mapboxgl.Marker({
        element: makeCircle(
          pin.color || "#4cd7f6",
          pin.action === "watch_area" || pin.action === "watch_zone" ? 18 : 14,
          true,
        ),
        anchor: "center",
      })
        .setLngLat([pin.longitude, pin.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 14 }).setHTML(
            `<div><strong>${escapeHtml(pin.label)}</strong><br/><span style="font-size:11px;opacity:0.65">${fmtCoords(pin.latitude, pin.longitude)}</span></div>`,
          ),
        )
        .addTo(map);

      marker.getElement().addEventListener("click", (event) => {
        event.stopPropagation();
        marker.togglePopup();
        onDroppedPinSelect?.(pin);
      });

      droppedPinMarkersRef.current.push(marker);
    });

    return () => {
      droppedPinMarkersRef.current.forEach((marker) => marker.remove());
      droppedPinMarkersRef.current = [];
    };
  }, [droppedPins, loaded, onDroppedPinSelect]);

  // ── Watch zone circles (GeoJSON layer) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const SRC = "gp-watch-zones";
    const LAYER = "gp-wz-circles";
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: watchZones.map((wz) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [wz.longitude, wz.latitude] },
        properties: { name: wz.name, risk: wz.riskLevel, score: wz.riskScore, color: riskColor(wz.riskLevel) },
      })),
    };
    const src = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(collection);
    } else {
      map.addSource(SRC, { type: "geojson", data: collection });
      map.addLayer({
        id: LAYER,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": 28,
          "circle-color": ["get", "color"],
          "circle-opacity": 0.10,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-opacity": 0.55,
        },
      });
      map.on("click", LAYER, (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        new mapboxgl.Popup({ offset: 20, maxWidth: "220px" })
          .setLngLat(f.geometry.coordinates as [number, number])
          .setHTML(
            `<div>
              <strong style="display:block;margin-bottom:4px">${f.properties?.name}</strong>
              <span style="font-size:11px;opacity:0.7">${f.properties?.risk?.toUpperCase()} RISK · Score ${Math.round(f.properties?.score)}</span>
            </div>`,
          )
          .addTo(map);
      });
      map.on("mouseenter", LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", LAYER, () => { map.getCanvas().style.cursor = ""; });
    }
    if (map.getLayer(LAYER)) {
      map.setLayoutProperty(LAYER, "visibility", showRiskZones ? "visible" : "none");
    }
  }, [loaded, showRiskZones, watchZones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const SRC = "gp-incident-heatmap-src";
    const LAYER = "gp-incident-heatmap";
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: incidents.map((incident) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [incident.longitude, incident.latitude] },
        properties: {
          severityWeight:
            (incident.severity === "critical"
              ? 1
              : incident.severity === "high"
                ? 0.8
                : incident.severity === "medium"
                  ? 0.55
                  : 0.3) *
            getIncidentRecencyVisuals(incident, emphasizeRecentIncidents).heatmapWeight,
        },
      })),
    };

    const src = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(collection);
    } else {
      map.addSource(SRC, { type: "geojson", data: collection });
      map.addLayer({
        id: LAYER,
        type: "heatmap",
        source: SRC,
        maxzoom: 15,
        paint: {
          "heatmap-weight": ["get", "severityWeight"],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 6, 0.55, 12, 1.1],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 18, 12, 34],
          "heatmap-opacity": 0.55,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(76,215,246,0)",
            0.2,
            "rgba(76,215,246,0.28)",
            0.4,
            "rgba(127,208,255,0.45)",
            0.6,
            "rgba(248,193,91,0.6)",
            0.8,
            "rgba(255,95,109,0.72)",
            1,
            "rgba(255,63,90,0.85)",
          ],
        },
      });
    }

    if (map.getLayer(LAYER)) {
      map.setLayoutProperty(LAYER, "visibility", showHeatmap ? "visible" : "none");
    }
  }, [emphasizeRecentIncidents, incidents, loaded, showHeatmap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const SRC = "gp-geofences";
    const FILL_LAYER = "gp-geofence-circles";
    const STROKE_LAYER = "gp-geofence-strokes";
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: geofences.map((geofence) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [geofence.longitude, geofence.latitude] },
        properties: {
          name: geofence.name,
          type: geofence.geofenceType,
          status: geofence.status,
          description: geofence.description,
          radiusMeters: geofence.radiusMeters,
          color: geofenceColor(geofence.geofenceType),
        },
      })),
    };

    const src = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(collection);
    } else {
      map.addSource(SRC, { type: "geojson", data: collection });
      map.addLayer({
        id: FILL_LAYER,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            ["max", 12, ["/", ["get", "radiusMeters"], 450]],
            12,
            ["max", 26, ["/", ["get", "radiusMeters"], 180]],
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.08,
          "circle-stroke-width": 0,
        },
      });
      map.addLayer({
        id: STROKE_LAYER,
        type: "circle",
        source: SRC,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            ["max", 12, ["/", ["get", "radiusMeters"], 450]],
            12,
            ["max", 26, ["/", ["get", "radiusMeters"], 180]],
          ],
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-opacity": 0.55,
          "circle-stroke-width": 1.5,
        },
      });
      map.on("click", FILL_LAYER, (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== "Point") return;
        new mapboxgl.Popup({ offset: 20, maxWidth: "240px" })
          .setLngLat(f.geometry.coordinates as [number, number])
          .setHTML(
            `<div>
              <strong style="display:block;margin-bottom:4px">${f.properties?.name}</strong>
              <span style="display:block;font-size:11px;opacity:0.78">${String(f.properties?.type ?? "custom").replace(/_/g, " ").toUpperCase()} GEOFENCE</span>
              <span style="display:block;font-size:11px;opacity:0.65;margin-top:4px">Radius ${Math.round(Number(f.properties?.radiusMeters ?? 0))}m</span>
              ${
                f.properties?.description
                  ? `<span style="display:block;font-size:11px;opacity:0.65;margin-top:6px">${f.properties.description}</span>`
                  : ""
              }
            </div>`,
          )
          .addTo(map);
      });
      map.on("mouseenter", FILL_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", FILL_LAYER, () => { map.getCanvas().style.cursor = ""; });
    }

    for (const layerId of [FILL_LAYER, STROKE_LAYER]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", showGeofencing ? "visible" : "none");
      }
    }
  }, [geofences, loaded, showGeofencing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const SRC = "gp-weather-overlay";
    const LAYER = "gp-weather-overlay-heatmap";
    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: weatherOverlay.map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        properties: {
          intensity: point.intensity,
          severity: point.severity,
          color: weatherColor(point.severity),
          title: point.title,
          summary: point.summary,
        },
      })),
    };

    const src = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(collection);
    } else {
      map.addSource(SRC, { type: "geojson", data: collection });
      map.addLayer({
        id: LAYER,
        type: "heatmap",
        source: SRC,
        maxzoom: 15,
        paint: {
          "heatmap-weight": ["coalesce", ["get", "intensity"], 0.5],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 11, 0.9, 15, 1.15],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 5, 20, 11, 34, 15, 48],
          "heatmap-opacity": 0.5,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(76,215,246,0)",
            0.2,
            "rgba(76,215,246,0.22)",
            0.45,
            "rgba(78,222,163,0.3)",
            0.65,
            "rgba(248,193,91,0.48)",
            0.85,
            "rgba(255,95,109,0.66)",
            1,
            "rgba(255,95,109,0.82)",
          ],
        },
      });
    }

    if (map.getLayer(LAYER)) {
      map.setLayoutProperty(LAYER, "visibility", showWeatherLayer ? "visible" : "none");
    }
  }, [loaded, showWeatherLayer, weatherOverlay]);

  // ── Incident markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    incidentMarkersRef.current.forEach((m) => m.remove());
    incidentMarkersRef.current = [];

    if (!showIncidents) {
      return () => {
        incidentMarkersRef.current.forEach((m) => m.remove());
        incidentMarkersRef.current = [];
      };
    }

    incidents.forEach((inc) => {
      const visuals = getIncidentRecencyVisuals(inc, emphasizeRecentIncidents);
      const el = makeIncidentDot(
        incidentColor(inc.incidentType, inc.severity),
        emphasizeRecentIncidents && isFresh(inc),
        visuals,
      );
      const popup = new mapboxgl.Popup({
        offset: 14,
        closeButton: false,
        closeOnClick: true,
        maxWidth: "220px",
      }).setHTML(
        `<div style="font-size:12px;line-height:1.35;padding:2px 0">
          <strong style="display:block;color:#ffffff">${escapeHtml(inc.title)}</strong>
        </div>`,
      );
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([inc.longitude, inc.latitude])
        .setPopup(popup)
        .addTo(map);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        marker.togglePopup();
        onIncidentSelect?.(inc);
        map.flyTo({ center: [inc.longitude, inc.latitude], zoom: Math.max(map.getZoom(), 12), speed: 0.8 });
      });
      incidentMarkersRef.current.push(marker);
    });

    return () => {
      incidentMarkersRef.current.forEach((m) => m.remove());
      incidentMarkersRef.current = [];
    };
  }, [emphasizeRecentIncidents, loaded, incidents, onIncidentSelect, showIncidents]);

  // ── Location markers (state / selected address) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const sm = new mapboxgl.Marker({ element: makeCircle("#4cd7f6", !selectedAddress ? 22 : 16, !selectedAddress), anchor: "center" })
      .setLngLat(stateData?.center ?? NIGERIA_DEFAULT_CENTER)
      .addTo(map);
    markersRef.current.push(sm);

    if (selectedAddress) {
      const rm = new mapboxgl.Marker({ element: makeCircle("#ff817a", 22, true), anchor: "center" })
        .setLngLat(selectedAddress.coordinates)
        .addTo(map);
      markersRef.current.push(rm);
    }
  }, [loaded, selectedAddress, stateData]);

  // ── Pinpoint marker ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    pinMarkerRef.current?.remove();
    pinMarkerRef.current = null;
    if (!exactPin) return;
    pinMarkerRef.current = new mapboxgl.Marker({ element: makePinpoint(), anchor: "center" })
      .setLngLat([exactPin.longitude, exactPin.latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 16 }).setHTML(
          `<div><strong>${exactPin.label}</strong><br/><span style="font-size:11px;opacity:0.6">${fmtCoords(exactPin.latitude, exactPin.longitude)}</span></div>`,
        ),
      )
      .addTo(map);
  }, [loaded, exactPin]);

  // ── Geolocation ──
  function locateMe() {
    if (!token || !navigator.geolocation) {
      setStatusMsg("Geolocation unavailable.");
      return;
    }
    setIsLocating(true);
    setStatusMsg("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const reverse = await reverseGeocodeLocation(latitude, longitude);
          setSelectedState(reverse.state);
          const addressOpt: SearchOption = {
            id: "geo-address",
            label: reverse.label,
            coordinates: [longitude, latitude],
            state: reverse.state,
          };
          setSelectedAddress(addressOpt);
          setAddressQuery(reverse.label);
          setIsAddressSuggestionOpen(false);
          const nextPin = { latitude, longitude, label: reverse.label };
          onStateChange?.(reverse.state);
          onCityChange?.(reverse.label);
          onStreetChange?.(reverse.label);
          onExactPinChange?.(nextPin);
          onFocusChange?.({ latitude, longitude });
          setStatusMsg("Centered on your location.");
        } catch {
          setStatusMsg("Could not resolve location.");
        } finally {
          setIsLocating(false);
        }
      },
      () => { setIsLocating(false); setStatusMsg("Location access denied."); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // ── Handlers ──
  function syncMapStyle(nextStyle: string) {
    onMapStyleChange?.(nextStyle);
  }

  function syncZoom(nextZoom: number) {
    const map = mapRef.current;
    if (map && loadedRef.current) {
      map.easeTo({
        zoom: toMapZoom(nextZoom),
        duration: 260,
        essential: true,
      });
    }
    onZoomChange?.(nextZoom);
  }

  function syncState(nextState: string) {
    setSelectedState(nextState);
    selectedStateRef.current = nextState;
    setSelectedAddress(null);
    setAddressQuery(nextState || "Nigeria");
    setAddressOptions([]);
    setIsAddressSuggestionOpen(false);
    onStateChange?.(nextState);
  }

  function syncAddressQuery(nextQuery: string) {
    setAddressQuery(nextQuery);
    const trimmed = nextQuery.trim();
    if (trimmed.length < 2 || !token) {
      setAddressOptions([]);
      setIsLoadingAddressOptions(false);
      return;
    }
    setIsLoadingAddressOptions(true);
  }

  function pickAddress(opt: SearchOption) {
    setSelectedAddress(opt);
    setAddressQuery(opt.label);
    setIsAddressSuggestionOpen(false);
    if (opt.state) {
      setSelectedState(opt.state);
      onStateChange?.(opt.state);
    }
    const nextPin = { latitude: opt.coordinates[1], longitude: opt.coordinates[0], label: opt.label };
    onCityChange?.(opt.label);
    onStreetChange?.(opt.label);
    onExactPinChange?.(nextPin);
    onFocusChange?.({ latitude: nextPin.latitude, longitude: nextPin.longitude });
  }

  function clearPin() {
    onExactPinChange?.(null);
    setPinActionPin(null);
    setPinActionSheetOpen(false);
    setPendingPinAction(null);
    setStatusMsg("Pin cleared.");
  }

  function closePinActionSheet() {
    setPinActionSheetOpen(false);
    setPendingPinAction(null);
    setObservationText("");
    setHazardType(HAZARD_TYPE_OPTIONS[0].value);
    setHelpType(HELP_TYPE_OPTIONS[0].value);
  }

  function handlePinActionSelect(action: PinAction) {
    if (action === "mark_hazard" || action === "request_help" || action === "add_observation") {
      setPendingPinAction(action);
      return;
    }
    submitPinAction(action);
  }

  function submitPinAction(action: PinAction) {
    const pin = pinActionPin ?? exactPin;
    if (!pin) return;

    const payload: PinActionPayload | undefined =
      action === "mark_hazard"
        ? { hazardType }
        : action === "request_help"
          ? { helpType }
          : action === "add_observation"
            ? { observationText: observationText.trim() }
            : undefined;

    closePinActionSheet();

    if (onPinActionSelect) {
      onPinActionSelect(action, pin, payload);
      return;
    }

    const actionLabel = PIN_ACTION_OPTIONS.find((item) => item.id === action)?.label ?? "Action selected";
    setStatusMsg(`${actionLabel} is selected for this pin.`);
  }

  function togglePinpoint() {
    const next = !pinpointMode;
    setPinpointMode(next);
    setStatusMsg(next ? "Tap anywhere on the map to drop a pin." : "Pinpoint mode cancelled.");
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = next ? "crosshair" : "";
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const noToken = !token;
  const controlsTargetElement =
    controlsTargetId && typeof document !== "undefined"
      ? document.getElementById(controlsTargetId)
      : null;

  // Shared props passed to both render sites of ControlsContent
  const sharedControlsProps = {
    mapStyle,
    zoomLevel,
    selectedState,
    addressQuery,
    addressOptions,
    isAddressSuggestionOpen,
    isLoadingAddressOptions,
    exactPin,
    pinpointMode,
    isLocating,
    statusMsg,
    onMapStyleChange: syncMapStyle,
    onZoomChange: syncZoom,
    onStateChange: syncState,
    onAddressQueryChange: syncAddressQuery,
    onAddressSuggestionOpenChange: setIsAddressSuggestionOpen,
    onPickAddress: pickAddress,
    onLocate: locateMe,
    onTogglePinpoint: togglePinpoint,
    onClearPin: clearPin,
    mode,
    onModeChange: (m: ControlsProps["mode"]) => onRequestModeChange?.(m!),
    incidents,
    droppedPins,
    myPins,
    selectedIncident,
    onIncidentClick: (inc: IncidentPoint) => {
      onIncidentSelect?.(inc);
      onRequestModeChange?.("incident");
    },
    onDroppedPinClick: (pin: DroppedPinPoint) => {
      onDroppedPinSelect?.(pin);
      onRequestModeChange?.("pin_detail");
    },
    onClearSelectedIncident: () => {
      onRequestModeChange?.("controls");
      onClearSelectedIncident?.();
    },
    filterPanel,
  };

  const controlsContent = <ControlsContent {...sharedControlsProps} />;

  const portalControls =
    showControlsUi && controlsTargetElement ? createPortal(controlsContent, controlsTargetElement) : null;

  return (
    <div className="relative w-full h-full min-h-screen bg-[#090e1c] overflow-hidden">
      {portalControls}

      {/* Map canvas fills everything */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* No token overlay */}
      {noToken && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#090e1c]/90 p-6 text-center">
          <div className="max-w-sm rounded-2xl border border-[rgba(76,215,246,0.2)] bg-[rgba(13,20,38,0.96)] p-8 shadow-2xl">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(76,215,246,0.1)] text-[#4cd7f6]">
              <MapIcon />
            </div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#4cd7f6]">
              Mapbox Token Required
            </p>
            <p className="mt-3 text-sm leading-6 text-[rgba(222,225,247,0.65)]">
              Add <code className="rounded bg-[rgba(76,215,246,0.12)] px-1.5 py-0.5 text-[#4cd7f6]">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to your environment variables to enable the interactive map.
            </p>
          </div>
        </div>
      )}

      {/* ── Top bar (always visible) ── */}
      {showControlsUi ? (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1.5 px-3 pt-safe-top pt-2.5 pointer-events-none md:gap-2 md:px-4 md:pt-3">
          {/* Logo chip */}
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[rgba(76,215,246,0.3)] bg-[rgba(9,14,28,0.85)] px-3 py-1.5 backdrop-blur-md shadow-lg md:gap-2 md:px-4 md:py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4edea3] shadow-[0_0_6px_#4edea3] md:h-2 md:w-2" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#dee1f7] md:text-[11px] md:tracking-[0.14em]">
              GeoPulse
            </span>
          </div>

          {/* Active scan badge */}
          <div className="pointer-events-auto rounded-full border border-[rgba(78,222,163,0.3)] bg-[rgba(9,14,28,0.85)] px-2.5 py-1.5 backdrop-blur-md shadow-lg md:px-3 md:py-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#4edea3] md:text-[10px] md:tracking-[0.12em]">
              Scan · ON
            </span>
          </div>

          <div className="flex-1" />

          {/* Stats chips */}
          {incidents.length > 0 && (
            <div className="pointer-events-auto rounded-full border border-[rgba(255,95,109,0.3)] bg-[rgba(9,14,28,0.85)] px-2.5 py-1.5 backdrop-blur-md shadow-lg md:px-3 md:py-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#ff5f6d] md:text-[10px] md:tracking-[0.12em]">
                {incidents.length} incident{incidents.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Open panel button (mobile only) */}
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="pointer-events-auto flex md:hidden h-9 w-9 items-center justify-center rounded-full border border-[rgba(76,215,246,0.3)] bg-[rgba(9,14,28,0.85)] text-[#dee1f7] backdrop-blur-md shadow-lg"
            aria-label="Open controls"
          >
            <MenuIcon />
          </button>
        </div>
      ) : null}

      {/* ── Exact pin banner ── */}
      {showControlsUi && exactPin && (
        <div className="absolute left-1/2 top-20 z-20 -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-2 rounded-full border border-[rgba(255,129,122,0.35)] bg-[rgba(9,14,28,0.9)] px-4 py-2 backdrop-blur-md shadow-lg">
            <span className="h-2 w-2 rounded-full bg-[#ff817a] shadow-[0_0_6px_#ff817a]" />
            <span className="font-mono text-[10px] text-[rgba(255,129,122,0.9)]">
              {fmtCoords(exactPin.latitude, exactPin.longitude)}
            </span>
            <button type="button" onClick={clearPin} className="ml-1 text-[rgba(188,201,205,0.6)] hover:text-white" aria-label="Clear pin">
              <CloseIcon size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating pin tool ── */}
      {showControlsUi && showDropPinTool && (
        <button
          type="button"
          onClick={togglePinpoint}
          className={`absolute right-4 z-30 flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-medium shadow-[0_18px_40px_rgba(4,10,24,0.24)] backdrop-blur-md transition active:scale-95 md:right-6 ${
            pinpointMode
              ? "bottom-40 border-[rgba(255,95,109,0.28)] bg-[rgba(255,255,255,0.96)] text-[#d63b4b]"
              : "bottom-40 border-[rgba(76,215,246,0.26)] bg-[rgba(255,255,255,0.92)] text-slate-900 hover:bg-white"
          }`}
          aria-label={pinpointMode ? "Cancel pin drop" : "Drop a pin"}
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              pinpointMode ? "bg-[rgba(255,95,109,0.12)] text-[#ff5f6d]" : "bg-[rgba(76,215,246,0.12)] text-[#0ea5c6]"
            }`}
          >
            <PinIcon />
          </span>
          <span className="hidden sm:inline">{pinpointMode ? "Cancel pin" : "Drop pin"}</span>
        </button>
      )}

      {/* ── Post-drop pin action sheet ── */}
      {showControlsUi && showDropPinTool && pinActionSheetOpen && (pinActionPin ?? exactPin) && (
        <div className="absolute inset-x-4 bottom-24 z-40 flex justify-center pointer-events-none md:inset-x-auto md:right-6 md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:justify-end">
          <div className="pointer-events-auto w-full max-w-[320px] rounded-[24px] border border-white/60 bg-white/92 p-3 text-slate-900 shadow-[0_20px_48px_rgba(3,8,20,0.28)] backdrop-blur-xl md:max-w-[360px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Pin actions</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-950">Choose an action</h3>
                <p className="mt-1 text-[11px] leading-4 text-slate-600">
                  {fmtCoords((pinActionPin ?? exactPin)!.latitude, (pinActionPin ?? exactPin)!.longitude)}
                </p>
              </div>
              <button
                type="button"
                onClick={closePinActionSheet}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900"
                aria-label="Close pin actions"
              >
                <CloseIcon size={12} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {pendingPinAction ? (
                <div className="col-span-2 grid gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-950">
                      {pendingPinAction === "mark_hazard"
                        ? "Select hazard type"
                        : pendingPinAction === "request_help"
                          ? "Select help type"
                          : "Describe the observation"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPendingPinAction(null)}
                      className="text-[11px] font-medium text-slate-500 transition hover:text-slate-900"
                    >
                      Back
                    </button>
                  </div>

                  {pendingPinAction === "mark_hazard" ? (
                    <select
                      value={hazardType}
                      onChange={(event) => setHazardType(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    >
                      {HAZARD_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {pendingPinAction === "request_help" ? (
                    <select
                      value={helpType}
                      onChange={(event) => setHelpType(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    >
                      {HELP_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  {pendingPinAction === "add_observation" ? (
                    <textarea
                      value={observationText}
                      onChange={(event) => setObservationText(event.target.value)}
                      placeholder="Type what you observed"
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-400"
                    />
                  ) : null}

                  <button
                    type="button"
                    onClick={() => submitPinAction(pendingPinAction)}
                    disabled={pendingPinAction === "add_observation" && observationText.trim().length === 0}
                    className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Continue
                  </button>
                </div>
              ) : (
                PIN_ACTION_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handlePinActionSelect(option.id)}
                    className="group rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_4px_rgba(0,0,0,0.04)]"
                        style={{ backgroundColor: option.accent }}
                      />
                      <span className="min-w-0 block text-xs font-semibold leading-4 text-slate-950">{option.label}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Pinpoint mode overlay ── */}
      {showControlsUi && showDropPinTool && pinpointMode && (
        <div className="absolute inset-0 z-10 pointer-events-none" style={{ cursor: "crosshair" }}>
          <div className="absolute left-1/2 bottom-48 md:bottom-8 -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center gap-2 rounded-full border border-[rgba(78,222,163,0.4)] bg-[rgba(9,14,28,0.92)] px-5 py-3 backdrop-blur-md animate-pulse">
              <span className="text-sm text-[#4edea3]">Tap map to drop pin</span>
              <button type="button" onClick={togglePinpoint} className="ml-1 text-[rgba(188,201,205,0.6)] hover:text-white">
                <CloseIcon size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile bottom sheet ── */}
      {showControlsUi ? (
        <div
          className={`md:hidden absolute inset-x-0 bottom-0 z-30 transition-transform duration-300 ease-out ${
            panelOpen ? "translate-y-0" : "translate-y-[calc(100%-72px)]"
          }`}
        >
          {/* Drag handle / summary row */}
          <button
            type="button"
            className="relative w-full rounded-t-3xl border-t border-x border-[rgba(61,73,76,0.4)] bg-[rgba(13,20,38,0.97)] pt-3 pb-4 px-5 backdrop-blur-xl flex flex-col items-center gap-2"
            onClick={() => setPanelOpen((o) => !o)}
            aria-label={panelOpen ? "Collapse controls" : "Expand controls"}
          >
            <div className="w-10 h-1 rounded-full bg-[rgba(188,201,205,0.25)]" />
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#4cd7f6]">
                  {selectedState}
                </span>
                {incidents.length > 0 && (
                  <span className="rounded-full bg-[rgba(255,95,109,0.15)] px-2 py-0.5 font-mono text-[10px] text-[#ff5f6d]">
                    {incidents.length}
                  </span>
                )}
              </div>
              <ChevronIcon up={panelOpen} />
            </div>
          </button>

          {/* Scrollable controls */}
          <div
            className="max-h-[85vh] overflow-y-scroll border-x border-b border-[rgba(61,73,76,0.4)] bg-[rgba(13,20,38,0.97)] pb-safe-bottom pb-20 px-4 backdrop-blur-xl"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <ControlsContent {...sharedControlsProps} />
          </div>
        </div>
      ) : null}

      {/* ── Zoom buttons (mobile) ── */}
      {showControlsUi ? (
        <div className="md:hidden absolute right-4 bottom-24 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => syncZoom(Math.min(5, zoomLevel + 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(61,73,76,0.5)] bg-[rgba(13,20,38,0.9)] text-[#dee1f7] text-xl backdrop-blur-md shadow-lg active:scale-95"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => syncZoom(Math.max(1, zoomLevel - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(61,73,76,0.5)] bg-[rgba(13,20,38,0.9)] text-[#dee1f7] text-xl backdrop-blur-md shadow-lg active:scale-95"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={locateMe}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(76,215,246,0.35)] bg-[rgba(13,20,38,0.9)] text-[#4cd7f6] backdrop-blur-md shadow-lg active:scale-95"
            aria-label="My location"
          >
            {isLocating ? <SpinIcon /> : <LocateIcon />}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Controls content (shared between desktop sidebar & mobile sheet) ─────────

type ControlsProps = {
  mapStyle: string;
  zoomLevel: number;
  selectedState: string;
  addressQuery: string;
  addressOptions: SearchOption[];
  isAddressSuggestionOpen: boolean;
  isLoadingAddressOptions: boolean;
  exactPin: ExactPin | null;
  pinpointMode: boolean;
  isLocating: boolean;
  statusMsg: string;
  onMapStyleChange: (v: string) => void;
  onZoomChange: (v: number) => void;
  onStateChange: (v: string) => void;
  onAddressQueryChange: (v: string) => void;
  onAddressSuggestionOpenChange: (value: boolean) => void;
  onPickAddress: (opt: SearchOption) => void;
  onLocate: () => void;
  onTogglePinpoint: () => void;
  onClearPin: () => void;
  mode?: "controls" | "incident" | "filter" | "my_pins" | "pin_detail" | "pin_action";
  onModeChange?: (mode: "controls" | "incident" | "filter" | "my_pins" | "pin_detail" | "pin_action") => void;
  incidents?: IncidentPoint[];
  droppedPins?: DroppedPinPoint[];
  myPins?: DroppedPinPoint[];
  selectedIncident?: IncidentPoint | null;
  onIncidentClick?: (inc: IncidentPoint) => void;
  onClearSelectedIncident?: () => void;
  onDroppedPinClick?: (pin: DroppedPinPoint) => void;
  filterPanel?: ReactNode;
  mobileFeedPanel?: ReactNode;
};

function ControlsContent({
  mapStyle,
  zoomLevel,
  selectedState,
  addressQuery,
  addressOptions,
  isAddressSuggestionOpen,
  isLoadingAddressOptions,
  exactPin,
  pinpointMode,
  isLocating,
  statusMsg,
  onMapStyleChange,
  onZoomChange,
  onStateChange,
  onAddressQueryChange,
  onAddressSuggestionOpenChange,
  onPickAddress,
  onLocate,
  onTogglePinpoint,
  onClearPin,
  mode = "controls",
  onModeChange,
  incidents,
  droppedPins,
  myPins,
  selectedIncident,
  onIncidentClick,
  onClearSelectedIncident,
  onDroppedPinClick,
  filterPanel,
  mobileFeedPanel,
}: ControlsProps) {
  const inputCls =
    "w-full rounded-xl border border-[rgba(61,73,76,0.5)] bg-[rgba(22,27,43,0.8)] px-3 py-2.5 text-sm text-[#dee1f7] outline-none placeholder:text-[rgba(188,201,205,0.35)] focus:border-[rgba(76,215,246,0.6)] transition-colors";
  const labelCls =
    "block font-mono text-[10px] uppercase tracking-[0.16em] text-[rgba(188,201,205,0.55)] mb-1.5";
  const sectionCls = "grid gap-3";
  const incidentList: IncidentPoint[] = incidents ?? [];

  // Prefer myPins when available, otherwise fall back to droppedPins
  const droppedPinList: DroppedPinPoint[] =
    (myPins && myPins.length > 0 ? myPins : droppedPins) ?? [];

  const selectedIncidentIndex =
    selectedIncident ? incidentList.findIndex((incident) => incident.id === selectedIncident.id) : -1;
  const hasPrevIncident = selectedIncidentIndex > 0;
  const hasNextIncident =
    selectedIncidentIndex >= 0 && selectedIncidentIndex < incidentList.length - 1;

  return (
    <div className="grid gap-4 py-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#4cd7f6]">Controls</p>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-[rgba(76,215,246,0.1)] px-2.5 py-1 font-mono text-[10px] text-[#4cd7f6]">
            Zoom {zoomLevel}×
          </div>
          <div className="rounded-md border border-[rgba(61,73,76,0.35)] bg-[rgba(9,14,28,0.6)] p-1 flex items-center">
            <button
              type="button"
              onClick={() => onModeChange?.("controls")}
              className={`px-2 py-1 rounded-md text-xs ${mode === "controls" ? "bg-[rgba(76,215,246,0.12)] text-[#4cd7f6]" : "text-[rgba(188,201,205,0.7)]"}`}
            >
              Controls
            </button>
            <button
              type="button"
              onClick={() => onModeChange?.("incident")}
              className={`px-2 py-1 rounded-md text-xs ${mode === "incident" ? "bg-[rgba(255,95,109,0.08)] text-[#ff5f6d]" : "text-[rgba(188,201,205,0.7)]"}`}
            >
              Incidents
            </button>
            {filterPanel ? (
              <button
                type="button"
                onClick={() => onModeChange?.("filter")}
                className={`px-2 py-1 rounded-md text-xs ${mode === "filter" ? "bg-[rgba(248,193,91,0.12)] text-[#f8c15b]" : "text-[rgba(188,201,205,0.7)]"}`}
              >
                Filter
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onModeChange?.("my_pins")}
              className={`px-2 py-1 rounded-md text-xs ${mode === "my_pins" ? "bg-[rgba(143,125,255,0.12)] text-[#8f7dff]" : "text-[rgba(188,201,205,0.7)]"}`}
            >
              My Pins
            </button>
          </div>
        </div>
      </div>

      {mode === "incident" ? (
        <div className="grid gap-3">
          {selectedIncident ? (
            <div className="rounded-xl border border-[rgba(61,73,76,0.45)] bg-[rgba(13,20,38,0.85)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm text-[#ff5f6d]">{selectedIncident.title}</div>
                  <div className="text-xs text-[rgba(188,201,205,0.6)]">{selectedIncident.locationName} · {new Date(selectedIncident.detectedAt).toLocaleString()}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => { onModeChange?.("controls"); onClearSelectedIncident?.(); }}
                    className="text-xs rounded-md bg-[rgba(76,215,246,0.08)] px-2 py-1 text-[#4cd7f6]"
                  >
                    Back to controls
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm text-[rgba(188,201,205,0.8)]">{selectedIncident.summary}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!hasPrevIncident) return;
                    onIncidentClick?.(incidentList[selectedIncidentIndex - 1]);
                  }}
                  disabled={!hasPrevIncident}
                  className="rounded-lg border border-[rgba(61,73,76,0.45)] px-3 py-2 text-xs font-medium text-[#dee1f7] transition hover:border-[rgba(76,215,246,0.45)] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!hasNextIncident) return;
                    onIncidentClick?.(incidentList[selectedIncidentIndex + 1]);
                  }}
                  disabled={!hasNextIncident}
                  className="rounded-lg border border-[rgba(61,73,76,0.45)] px-3 py-2 text-xs font-medium text-[#dee1f7] transition hover:border-[rgba(76,215,246,0.45)] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Next
                </button>
              </div>
              <div className="mt-2 text-[11px] text-[rgba(188,201,205,0.55)]">
                {selectedIncidentIndex >= 0
                  ? `${selectedIncidentIndex + 1} of ${incidentList.length} incidents in current view`
                  : "No incident selected"}
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {incidentList.length > 0 ? (
                incidentList.map((inc) => (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => onIncidentClick?.(inc)}
                    className="text-left rounded-xl border border-[rgba(61,73,76,0.45)] bg-[rgba(13,20,38,0.85)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono text-sm text-[#ff5f6d]">{inc.title}</div>
                        <div className="text-xs text-[rgba(188,201,205,0.6)]">{inc.locationName}</div>
                      </div>
                      <div className="text-xs text-[rgba(188,201,205,0.55)]">{inc.severity}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-[rgba(188,201,205,0.55)]">No incidents available.</div>
              )}
            </div>
          )}
        </div>
      ) : mode === "my_pins" ? (
        <div className="grid gap-2">
          {droppedPinList.length > 0 ? (
            droppedPinList.map((pin: DroppedPinPoint) => (
              <button
                key={pin.id}
                type="button"
                onClick={() => onDroppedPinClick?.(pin)}
                className="text-left rounded-xl border border-[rgba(61,73,76,0.45)] bg-[rgba(13,20,38,0.85)] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm text-[#8f7dff]">{pin.label}</div>
                    <div className="text-xs text-[rgba(188,201,205,0.6)]">
                      {pin.action.replace(/_/g, " ")} · {new Date(pin.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: pin.color }}
                  />
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[rgba(61,73,76,0.45)] bg-[rgba(13,20,38,0.6)] px-3 py-4 text-xs text-[rgba(188,201,205,0.55)]">
              No pins yet. Drop a pin on the map to see it here.
            </div>
          )}
        </div>
      ) : (
        <>
          {mode === "filter" ? (
            <div className="grid gap-3 rounded-2xl border border-[rgba(248,193,91,0.22)] bg-[rgba(248,193,91,0.06)] p-4">
              {filterPanel ?? (
                <div className="rounded-xl border border-[rgba(61,73,76,0.45)] bg-[rgba(13,20,38,0.85)] p-4 text-sm text-[rgba(188,201,205,0.65)]">
                  No filter controls available.
                </div>
              )}
            </div>
          ) : null}

          {/* Map style */}
          <div className={sectionCls}>
            <label>
              <span className={labelCls}>Map Style</span>
              <select
                value={mapStyle}
                onChange={(e) => onMapStyleChange(e.target.value)}
                onFocus={() => onAddressSuggestionOpenChange(true)}
                className={inputCls}
              >
                {MAP_STYLES.map((s) => (
                  <option key={s.value} value={s.value} className="bg-[#0d1426]">
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* State */}
          <div className={sectionCls}>
            <label>
              <span className={labelCls}>State</span>
              <select
                value={selectedState}
                onChange={(e) => onStateChange(e.target.value)}
                className={inputCls}
              >
                <option value="" className="bg-[#0d1426]">
                  All states
                </option>
                {NIGERIA_STATES.map((state) => (
                  <option key={state.state} value={state.state} className="bg-[#0d1426]">
                    {state.state}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Address */}
          <div className={sectionCls}>
            <label>
              <span className={labelCls}>Address</span>
              <div
                className="relative"
                onBlur={() => {
                  window.setTimeout(() => onAddressSuggestionOpenChange(false), 120);
                }}
              >
                <input
                  value={addressQuery}
                  onChange={(e) => {
                    onAddressQueryChange(e.target.value);
                    onAddressSuggestionOpenChange(true);
                  }}
                  placeholder="Search address, street, city, or place…"
                  className={inputCls}
                />
                <datalist id="gp-address-list">
                  {addressOptions.map((o) => <option key={o.id} value={o.label} />)}
                </datalist>
                {isAddressSuggestionOpen ? (
                  isLoadingAddressOptions || addressOptions.length > 0 || addressQuery.trim().length >= 2 ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08101f] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                      {isLoadingAddressOptions ? (
                        <div className="flex items-center gap-2 px-3 py-3 text-xs text-white/45">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                          Searching locations…
                        </div>
                      ) : addressOptions.length > 0 ? (
                        addressOptions.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => onPickAddress(option)}
                            className="flex w-full flex-col items-start gap-1 border-b border-white/[0.06] px-3 py-3 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                          >
                            <span className="text-sm font-medium text-white">{option.label}</span>
                            <span className="text-xs text-white/40">
                              {option.state ? `${option.state} • Suggested location` : "Suggested location"}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-xs text-white/45">
                          No matches found. Try a town, street, or full address.
                        </div>
                      )}
                    </div>
                  ) : null
                ) : null}
              </div>
            </label>
            <p className="text-xs leading-5 text-[rgba(188,201,205,0.5)]">
              Typing one place is enough. The map will resolve and center it automatically.
            </p>
          </div>

          {/* Zoom slider */}
          <div>
            <span className={labelCls}>Zoom Level</span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={zoomLevel}
              onChange={(e) => onZoomChange(Number(e.target.value))}
              className="w-full accent-[#4cd7f6]"
            />
            <div className="flex justify-between mt-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className="font-mono text-[9px] text-[rgba(188,201,205,0.4)]">{n}</span>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onLocate}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[rgba(76,215,246,0.1)] border border-[rgba(76,215,246,0.2)] px-3 py-2.5 text-sm font-medium text-[#4cd7f6] transition hover:bg-[rgba(76,215,246,0.18)] active:scale-95"
            >
              {isLocating ? <SpinIcon /> : <LocateIcon />}
              <span className="text-xs">{isLocating ? "Locating…" : "My location"}</span>
            </button>
            <button
              type="button"
              onClick={onTogglePinpoint}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition active:scale-95 ${
                pinpointMode
                  ? "border-[rgba(255,129,122,0.35)] bg-[rgba(255,129,122,0.12)] text-[#ff817a]"
                  : "border-[rgba(78,222,163,0.25)] bg-[rgba(78,222,163,0.08)] text-[#4edea3] hover:bg-[rgba(78,222,163,0.14)]"
              }`}
            >
              <PinIcon />
              {pinpointMode ? "Cancel pin" : "Drop pin"}
            </button>
          </div>

          {exactPin && (
            <button
              type="button"
              onClick={onClearPin}
              className="w-full rounded-xl border border-[rgba(61,73,76,0.45)] bg-[rgba(22,27,43,0.6)] px-3 py-2.5 text-xs text-[rgba(188,201,205,0.65)] transition hover:border-[rgba(76,215,246,0.4)] hover:text-[#dee1f7] active:scale-95"
            >
              Clear pin
            </button>
          )}

          {statusMsg && (
            <p className="text-xs leading-5 text-[rgba(188,201,205,0.55)]">{statusMsg}</p>
          )}

          {mobileFeedPanel ? (
            <div className="md:hidden grid gap-3 border-t border-[rgba(61,73,76,0.35)] pt-4">
              {mobileFeedPanel}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ─── Micro icons ──────────────────────────────────────────────────────────────

function MapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
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

function LocateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ChevronIcon({ up }: { up: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(188,201,205,0.5)"
      strokeWidth="2"
      strokeLinecap="round"
      className={`transition-transform duration-300 ${up ? "rotate-180" : ""}`}
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}