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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import mapboxgl from "mapbox-gl";

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

// ─── Types ────────────────────────────────────────────────────────────────────

type SearchOption = {
  id: string;
  label: string;
  coordinates: [number, number];
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
};

type WatchZonePoint = {
  id: number;
  name: string;
  riskLevel: string;
  riskScore: number;
  latitude: number;
  longitude: number;
};

type DashboardMapProps = {
  selectedState?: string;
  selectedCity?: string;
  selectedStreet?: string;
  zoom?: number;
  mapStyle?: string;
  exactPin?: ExactPin | null;
  incidents?: IncidentPoint[];
  watchZones?: WatchZonePoint[];
  onIncidentSelect?: (incident: IncidentPoint) => void;
  onMapStyleChange?: (value: string) => void;
  onStateChange?: (value: string) => void;
  onCityChange?: (value: string) => void;
  onStreetChange?: (value: string) => void;
  onZoomChange?: (value: number) => void;
  onExactPinChange?: (value: ExactPin | null) => void;
  onFocusChange?: (value: { latitude: number; longitude: number } | null) => void;
  controlsTargetId?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAP_STYLES = [
  { label: "Dark", value: "mapbox://styles/mapbox/dark-v11" },
  { label: "Standard", value: "mapbox://styles/mapbox/standard" },
  { label: "Satellite", value: "mapbox://styles/mapbox/standard-satellite" },
  { label: "Streets", value: "mapbox://styles/mapbox/satellite-streets-v12" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMapZoom(level: number) {
  return 7.6 + level * 1.15;
}

function fmtCoords(lat: number, lng: number) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function severityColor(s: string) {
  if (s === "critical" || s === "high") return "#ff5f6d";
  if (s === "medium") return "#f8c15b";
  return "#4cd7f6";
}

function incidentColor(type: string, severity: string) {
  const palette: Record<string, string> = {
    kidnapping: "#ff5f6d",
    armed_robbery: "#ff3f5a",
    violence: "#f8c15b",
    road_threat: "#ff9c5a",
    suspicious_movement: "#4cd7f6",
    abnormal_sighting: "#7fd0ff",
    camp_indicator: "#8f7dff",
    fire_smoke: "#ff9b52",
    flood: "#46c0ff",
  };
  return palette[type] ?? severityColor(severity);
}

function riskColor(level: string) {
  if (level === "critical" || level === "high") return "#ff5f6d";
  if (level === "medium") return "#f8c15b";
  return "#4edea3";
}

function isFresh(incident: IncidentPoint) {
  const age = (Date.now() - new Date(incident.detectedAt).getTime()) / 60000;
  return age <= 180 && (incident.severity === "high" || incident.severity === "critical");
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

function makeIncidentDot(color: string, blink: boolean): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", "Incident");
  Object.assign(el.style, {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: color,
    border: "2px solid rgba(255,255,255,0.9)",
    boxShadow: `0 0 8px ${color}88`,
    cursor: "pointer",
  });
  if (blink) {
    el.style.animation = "gp-blink 1.6s ease-in-out infinite";
  }
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

// ─── Geocode fetch ────────────────────────────────────────────────────────────

type GeoFeature = {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    full_address?: string;
    place_formatted?: string;
    name_preferred?: string;
    name?: string;
    context?: {
      region?: { name?: string };
      place?: { name?: string };
      locality?: { name?: string };
      street?: { name?: string };
    };
  };
};

function featureLabel(f: GeoFeature) {
  return (
    f.properties?.full_address ??
    f.properties?.place_formatted ??
    f.properties?.name_preferred ??
    f.properties?.name ??
    "Unknown"
  );
}

async function geocode(
  query: string,
  token: string,
  types: string,
  extra: Record<string, string> = {},
): Promise<SearchOption[]> {
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("types", types);
  url.searchParams.set("country", "NG");
  url.searchParams.set("limit", "8");
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const data = await res.json();
  return (data.features ?? [])
    .filter((f: GeoFeature) => f.geometry?.coordinates)
    .map((f: GeoFeature, i: number) => ({
      id: f.id ?? `${featureLabel(f)}-${i}`,
      label: featureLabel(f),
      coordinates: f.geometry!.coordinates!,
    }));
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DashboardMap({
  selectedState: initialState = "Lagos",
  selectedCity: initialCity = "",
  selectedStreet: initialStreet = "",
  zoom: initialZoom = 2,
  mapStyle: initialMapStyle = MAP_STYLES[0].value,
  exactPin: initialExactPin = null,
  incidents = [],
  watchZones = [],
  onIncidentSelect,
  onMapStyleChange,
  onStateChange,
  onCityChange,
  onStreetChange,
  onZoomChange,
  onExactPinChange,
  onFocusChange,
  controlsTargetId,
}: DashboardMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  // Map refs
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const loadedRef = useRef(false);
  const pinpointModeRef = useRef(false);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const incidentMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const pinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const styleRef = useRef<string>(MAP_STYLES[0].value);

  // UI state
  const [loaded, setLoaded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedState, setSelectedState] = useState(initialState);
  const [pinpointMode, setPinpointMode] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Search state
  const [cityQuery, setCityQuery] = useState(initialCity);
  const [cityOptions, setCityOptions] = useState<SearchOption[]>([]);
  const [selectedCity, setSelectedCity] = useState<SearchOption | null>(null);
  const [streetQuery, setStreetQuery] = useState(initialStreet);
  const [streetOptions, setStreetOptions] = useState<SearchOption[]>([]);
  const [selectedStreet, setSelectedStreet] = useState<SearchOption | null>(null);

  const stateData = useMemo(
    () =>
      NIGERIA_STATES.find((s) => s.state === selectedState) ??
      NIGERIA_STATES.find((s) => s.state === "Lagos")!,
    [selectedState],
  );
  const mapStyle = initialMapStyle;
  const zoomLevel = initialZoom;
  const exactPin = initialExactPin;

  const focusCenter: [number, number] =
    selectedStreet?.coordinates ?? selectedCity?.coordinates ?? stateData.center;

  // ── Keep pinpointModeRef in sync ──
  useEffect(() => {
    pinpointModeRef.current = pinpointMode;
  }, [pinpointMode]);

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

  // ── City geocode ──
  useEffect(() => {
    if (!token || cityQuery.trim().length < 2) return;
    const ac = new AbortController();
    geocode(`${cityQuery}, ${selectedState}, Nigeria`, token, "place,locality,district")
      .then(setCityOptions)
      .catch(() => {});
    return () => ac.abort();
  }, [cityQuery, selectedState, token]);

  // ── Street geocode ──
  useEffect(() => {
    if (!token || !selectedCity || streetQuery.trim().length < 2) return;
    const [lng, lat] = selectedCity.coordinates;
    geocode(
      `${streetQuery}, ${selectedCity.label}, ${selectedState}, Nigeria`,
      token,
      "street,address",
      { proximity: `${lng},${lat}` },
    )
      .then(setStreetOptions)
      .catch(() => {});
  }, [streetQuery, selectedCity, selectedState, token]);

  // ── Init map ──
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleRef.current,
      center: focusCenter,
      zoom: toMapZoom(zoomLevel),
      pitch: 38,
      bearing: -12,
      antialias: true,
      projection: "mercator",
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "bottom-left");
    map.addControl(new mapboxgl.ScaleControl({ unit: "metric" }), "bottom-right");

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
      if (!pinpointModeRef.current) return;
      const { lat, lng } = e.lngLat;
      const nextPin = { latitude: lat, longitude: lng, label: `Pinned • ${fmtCoords(lat, lng)}` };
      setPinpointMode(false);
      onExactPinChange?.(nextPin);
      onFocusChange?.({ latitude: lat, longitude: lng });
      setStatusMsg("Exact location captured.");
    };

    map.on("load", onLoad);
    map.on("style.load", onLoad);
    map.on("zoomend", onZoomEnd);
    map.on("click", onClick);
    map.on("error", (e) => setStatusMsg(e.error?.message ?? "Map error."));

    return () => {
      markersRef.current.forEach((m) => m.remove());
      incidentMarkersRef.current.forEach((m) => m.remove());
      pinMarkerRef.current?.remove();
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
    map.flyTo({ center: focusCenter, zoom: toMapZoom(zoomLevel), speed: 0.85, curve: 1.2, essential: true });
    onFocusChange?.({ latitude: focusCenter[1], longitude: focusCenter[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, focusCenter, zoomLevel]);

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
  }, [loaded, watchZones]);

  // ── Incident markers ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    incidentMarkersRef.current.forEach((m) => m.remove());
    incidentMarkersRef.current = [];

    incidents.forEach((inc) => {
      const el = makeIncidentDot(incidentColor(inc.incidentType, inc.severity), isFresh(inc));
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([inc.longitude, inc.latitude])
        .addTo(map);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onIncidentSelect?.(inc);
        map.flyTo({ center: [inc.longitude, inc.latitude], zoom: Math.max(map.getZoom(), 12), speed: 0.8 });
      });
      incidentMarkersRef.current.push(marker);
    });

    return () => {
      incidentMarkersRef.current.forEach((m) => m.remove());
      incidentMarkersRef.current = [];
    };
  }, [loaded, incidents, onIncidentSelect]);

  // ── Location markers (state / city / street) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const sm = new mapboxgl.Marker({ element: makeCircle("#4cd7f6", !selectedCity ? 22 : 16, !selectedCity), anchor: "center" })
      .setLngLat(stateData.center)
      .addTo(map);
    markersRef.current.push(sm);

    if (selectedCity) {
      const cm = new mapboxgl.Marker({ element: makeCircle("#4edea3", !selectedStreet ? 22 : 16, !selectedStreet), anchor: "center" })
        .setLngLat(selectedCity.coordinates)
        .addTo(map);
      markersRef.current.push(cm);
    }

    if (selectedStreet) {
      const rm = new mapboxgl.Marker({ element: makeCircle("#ff817a", 22, true), anchor: "center" })
        .setLngLat(selectedStreet.coordinates)
        .addTo(map);
      markersRef.current.push(rm);
    }
  }, [loaded, stateData, selectedCity, selectedStreet]);

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
          const url = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
          url.searchParams.set("longitude", String(longitude));
          url.searchParams.set("latitude", String(latitude));
          url.searchParams.set("country", "NG");
          url.searchParams.set("access_token", token);
          const res = await fetch(url.toString());
          const data = await res.json();
          const f: GeoFeature = data.features?.[0];
          const regionName = f?.properties?.context?.region?.name ?? "";
          const cityName =
            f?.properties?.context?.place?.name ??
            f?.properties?.context?.locality?.name ??
            "My Location";
          const streetName = f?.properties?.context?.street?.name ?? f?.properties?.name ?? "Current Street";

          const matched =
            NIGERIA_STATES.find((s) =>
              regionName.toLowerCase().includes(s.state.toLowerCase()),
            ) ??
            (regionName.toLowerCase().includes("federal capital")
              ? NIGERIA_STATES.find((s) => s.state === "FCT Abuja")
              : undefined) ??
            NIGERIA_STATES[0];

          setSelectedState(matched.state);
          const cityOpt: SearchOption = { id: "geo-city", label: cityName, coordinates: [longitude, latitude] };
          const streetOpt: SearchOption = { id: "geo-street", label: streetName, coordinates: [longitude, latitude] };
          setSelectedCity(cityOpt);
          setCityQuery(cityName);
          setSelectedStreet(streetOpt);
          setStreetQuery(streetName);
          const nextPin = { latitude, longitude, label: `${streetName}, ${cityName}` };
          onStateChange?.(matched.state);
          onCityChange?.(cityName);
          onStreetChange?.(streetName);
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
  function syncState(nextState: string) {
    setSelectedState(nextState);
    onStateChange?.(nextState);
  }

  function syncMapStyle(nextStyle: string) {
    onMapStyleChange?.(nextStyle);
  }

  function syncZoom(nextZoom: number) {
    onZoomChange?.(nextZoom);
  }

  function pickCity(opt: SearchOption) {
    setSelectedCity(opt);
    setCityQuery(opt.label);
    setSelectedStreet(null);
    setStreetQuery("");
    setStreetOptions([]);
    const nextPin = { latitude: opt.coordinates[1], longitude: opt.coordinates[0], label: opt.label };
    onCityChange?.(opt.label);
    onStreetChange?.("");
    onExactPinChange?.(nextPin);
    onFocusChange?.({ latitude: nextPin.latitude, longitude: nextPin.longitude });
  }

  function pickStreet(opt: SearchOption) {
    setSelectedStreet(opt);
    setStreetQuery(opt.label);
    const nextPin = { latitude: opt.coordinates[1], longitude: opt.coordinates[0], label: opt.label };
    onStreetChange?.(opt.label);
    onExactPinChange?.(nextPin);
    onFocusChange?.({ latitude: nextPin.latitude, longitude: nextPin.longitude });
  }

  function clearPin() {
    onExactPinChange?.(null);
    setStatusMsg("Pin cleared.");
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
  const controlsContent = (
    <ControlsContent
      mapStyle={mapStyle}
      selectedState={selectedState}
      zoomLevel={zoomLevel}
      cityQuery={cityQuery}
      cityOptions={cityOptions}
      streetQuery={streetQuery}
      streetOptions={streetOptions}
      exactPin={exactPin}
      pinpointMode={pinpointMode}
      isLocating={isLocating}
      statusMsg={statusMsg}
      onMapStyleChange={syncMapStyle}
      onStateChange={(s) => {
        syncState(s);
        setSelectedCity(null);
        setCityQuery("");
        setSelectedStreet(null);
        setStreetQuery("");
        onExactPinChange?.(null);
      }}
      onZoomChange={syncZoom}
      onCityQueryChange={setCityQuery}
      onPickCity={pickCity}
      onStreetQueryChange={setStreetQuery}
      onPickStreet={pickStreet}
      onLocate={locateMe}
      onTogglePinpoint={togglePinpoint}
      onClearPin={clearPin}
    />
  );
  const portalControls = controlsTargetElement ? createPortal(controlsContent, controlsTargetElement) : null;

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
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-safe-top pt-3 flex items-center gap-2 pointer-events-none">
        {/* Logo chip */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[rgba(76,215,246,0.3)] bg-[rgba(9,14,28,0.85)] px-4 py-2 backdrop-blur-md shadow-lg">
          <span className="h-2 w-2 rounded-full bg-[#4edea3] shadow-[0_0_6px_#4edea3]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#dee1f7]">
            GeoPulse
          </span>
        </div>

        {/* Active scan badge */}
        <div className="pointer-events-auto rounded-full border border-[rgba(78,222,163,0.3)] bg-[rgba(9,14,28,0.85)] px-3 py-2 backdrop-blur-md shadow-lg">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#4edea3]">
            Scan · ON
          </span>
        </div>

        <div className="flex-1" />

        {/* Stats chips */}
        {incidents.length > 0 && (
          <div className="pointer-events-auto rounded-full border border-[rgba(255,95,109,0.3)] bg-[rgba(9,14,28,0.85)] px-3 py-2 backdrop-blur-md shadow-lg">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#ff5f6d]">
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

      {/* ── Exact pin banner ── */}
      {exactPin && (
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

      {/* ── Pinpoint mode overlay ── */}
      {pinpointMode && (
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

      {/* ── Incident detail card ── */}
      {/* Desktop fallback removed — controls render via portal (`controlsTargetId`) or mobile bottom sheet only. */}

      {/* ── Mobile bottom sheet ── */}
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
        <div className="max-h-[65vh] overflow-y-auto border-x border-b border-[rgba(61,73,76,0.4)] bg-[rgba(13,20,38,0.97)] pb-safe-bottom pb-6 px-4 backdrop-blur-xl">
          {controlsContent}
        </div>
      </div>

      {/* ── Zoom buttons (mobile) ── */}
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
        <button
          type="button"
          onClick={togglePinpoint}
          className={`flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md shadow-lg active:scale-95 ${
            pinpointMode
              ? "border-[rgba(255,129,122,0.4)] bg-[rgba(255,129,122,0.15)] text-[#ff817a]"
              : "border-[rgba(61,73,76,0.5)] bg-[rgba(13,20,38,0.9)] text-[#dee1f7]"
          }`}
          aria-label="Pin location"
        >
          <PinIcon />
        </button>
      </div>
    </div>
  );
}

// ─── Controls content (shared between desktop sidebar & mobile sheet) ─────────

type ControlsProps = {
  mapStyle: string;
  selectedState: string;
  zoomLevel: number;
  cityQuery: string;
  cityOptions: SearchOption[];
  streetQuery: string;
  streetOptions: SearchOption[];
  exactPin: ExactPin | null;
  pinpointMode: boolean;
  isLocating: boolean;
  statusMsg: string;
  onMapStyleChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onZoomChange: (v: number) => void;
  onCityQueryChange: (v: string) => void;
  onPickCity: (opt: SearchOption) => void;
  onStreetQueryChange: (v: string) => void;
  onPickStreet: (opt: SearchOption) => void;
  onLocate: () => void;
  onTogglePinpoint: () => void;
  onClearPin: () => void;
};

function ControlsContent({
  mapStyle,
  selectedState,
  zoomLevel,
  cityQuery,
  cityOptions,
  streetQuery,
  streetOptions,
  exactPin,
  pinpointMode,
  isLocating,
  statusMsg,
  onMapStyleChange,
  onStateChange,
  onZoomChange,
  onCityQueryChange,
  onPickCity,
  onStreetQueryChange,
  onPickStreet,
  onLocate,
  onTogglePinpoint,
  onClearPin,
}: ControlsProps) {
  const inputCls =
    "w-full rounded-xl border border-[rgba(61,73,76,0.5)] bg-[rgba(22,27,43,0.8)] px-3 py-2.5 text-sm text-[#dee1f7] outline-none placeholder:text-[rgba(188,201,205,0.35)] focus:border-[rgba(76,215,246,0.6)] transition-colors";
  const labelCls =
    "block font-mono text-[10px] uppercase tracking-[0.16em] text-[rgba(188,201,205,0.55)] mb-1.5";
  const sectionCls = "grid gap-3";

  return (
    <div className="grid gap-4 py-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#4cd7f6]">Controls</p>
        <span className="rounded-full bg-[rgba(76,215,246,0.1)] px-2.5 py-1 font-mono text-[10px] text-[#4cd7f6]">
          Zoom {zoomLevel}×
        </span>
      </div>

      {/* Map style */}
      <div className={sectionCls}>
        <label>
          <span className={labelCls}>Map Style</span>
          <select
            value={mapStyle}
            onChange={(e) => onMapStyleChange(e.target.value)}
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
            {NIGERIA_STATES.map((s) => (
              <option key={s.state} value={s.state} className="bg-[#0d1426]">
                {s.state}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* City */}
      <div className={sectionCls}>
        <label>
          <span className={labelCls}>City</span>
          <input
            list="gp-city-list"
            value={cityQuery}
            onChange={(e) => {
              onCityQueryChange(e.target.value);
              const found = cityOptions.find((o) => o.label === e.target.value);
              if (found) onPickCity(found);
            }}
            placeholder="Search city…"
            className={inputCls}
          />
          <datalist id="gp-city-list">
            {cityOptions.map((o) => <option key={o.id} value={o.label} />)}
          </datalist>
        </label>
      </div>

      {/* Street */}
      <div className={sectionCls}>
        <label>
          <span className={labelCls}>Street</span>
          <input
            list="gp-street-list"
            value={streetQuery}
            onChange={(e) => {
              onStreetQueryChange(e.target.value);
              const found = streetOptions.find((o) => o.label === e.target.value);
              if (found) onPickStreet(found);
            }}
            placeholder="Search street…"
            className={inputCls}
          />
          <datalist id="gp-street-list">
            {streetOptions.map((o) => <option key={o.id} value={o.label} />)}
          </datalist>
        </label>
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
