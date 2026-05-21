"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

import { nigeriaStates } from "@/components/dashboard-map-data";

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
  severity: string;
  confidence: string;
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
  selectedState: string;
  selectedCity: string;
  selectedStreet: string;
  zoom: number;
  mapStyle: string;
  exactPin: ExactPin | null;
  incidents: IncidentPoint[];
  watchZones: WatchZonePoint[];
  onMapStyleChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onStreetChange: (value: string) => void;
  onZoomChange: (value: number) => void;
  onExactPinChange: (value: ExactPin | null) => void;
  onFocusChange: (value: { latitude: number; longitude: number }) => void;
};

const mapStyleOptions = [
  { label: "Standard", value: "mapbox://styles/mapbox/standard" },
  { label: "Standard Satellite", value: "mapbox://styles/mapbox/standard-satellite" },
  { label: "Dark", value: "mapbox://styles/mapbox/dark-v11" },
  { label: "Satellite Streets", value: "mapbox://styles/mapbox/satellite-streets-v12" },
];

function derivedMapZoom(zoom: number) {
  return 7.6 + zoom * 1.15;
}

function createMarkerElement(color: string, active: boolean) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Location marker");
  button.style.width = active ? "24px" : "18px";
  button.style.height = active ? "24px" : "18px";
  button.style.borderRadius = "9999px";
  button.style.border = active ? "2px solid rgba(255,255,255,0.9)" : "1px solid rgba(9,14,28,0.85)";
  button.style.background = color;
  button.style.boxShadow = active
    ? "0 0 0 8px rgba(76,215,246,0.10), 0 0 18px rgba(76,215,246,0.30)"
    : "0 0 12px rgba(76,215,246,0.14)";
  button.style.cursor = "pointer";
  return button;
}

function createPinpointMarkerElement() {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "26px";
  wrapper.style.height = "26px";

  const pulse = document.createElement("span");
  pulse.style.position = "absolute";
  pulse.style.inset = "0";
  pulse.style.borderRadius = "9999px";
  pulse.style.background = "rgba(76,215,246,0.16)";
  pulse.style.boxShadow = "0 0 18px rgba(76,215,246,0.38)";
  pulse.style.animation = "pulse-cyan 2.4s infinite";

  const core = document.createElement("span");
  core.style.position = "absolute";
  core.style.left = "50%";
  core.style.top = "50%";
  core.style.width = "14px";
  core.style.height = "14px";
  core.style.transform = "translate(-50%, -50%)";
  core.style.borderRadius = "9999px";
  core.style.border = "2px solid rgba(255,255,255,0.92)";
  core.style.background = "#4cd7f6";

  wrapper.append(pulse, core);
  return wrapper;
}

function normalizeFeatureName(feature: MapboxFeatureLike) {
  return (
    feature.properties?.full_address ||
    feature.properties?.place_formatted ||
    feature.properties?.name_preferred ||
    feature.properties?.name ||
    feature.properties?.place ||
    "Unknown"
  );
}

type MapboxFeatureLike = {
  id?: string;
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    full_address?: string;
    place_formatted?: string;
    name_preferred?: string;
    name?: string;
    place?: string;
    context?: {
      region?: {
        name?: string;
      };
      place?: {
        name?: string;
      };
      locality?: {
        name?: string;
      };
      street?: {
        name?: string;
      };
    };
  };
};

type GeocodeResponse = {
  features?: MapboxFeatureLike[];
};

type MapFeature = GeoJSON.Feature<GeoJSON.Point, { kind: string; title: string; subtitle?: string; tone?: string }>;

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function severityColor(severity: string) {
  if (severity === "critical" || severity === "high") {
    return "#ff817a";
  }
  if (severity === "medium") {
    return "#f8c15b";
  }
  return "#4cd7f6";
}

function riskColor(riskLevel: string) {
  if (riskLevel === "critical" || riskLevel === "high") {
    return "#ff817a";
  }
  if (riskLevel === "medium") {
    return "#f8c15b";
  }
  return "#4edea3";
}

export function DashboardMap({
  selectedState,
  selectedCity,
  selectedStreet,
  zoom,
  mapStyle,
  exactPin,
  incidents,
  watchZones,
  onMapStyleChange,
  onStateChange,
  onCityChange,
  onStreetChange,
  onZoomChange,
  onExactPinChange,
  onFocusChange,
}: DashboardMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const pinpointMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const styleRef = useRef(mapStyle);
  const [loaded, setLoaded] = useState(false);
  const [cityOptions, setCityOptions] = useState<SearchOption[]>([]);
  const [streetOptions, setStreetOptions] = useState<SearchOption[]>([]);
  const [selectedCityOption, setSelectedCityOption] = useState<SearchOption | null>(null);
  const [selectedStreetOption, setSelectedStreetOption] = useState<SearchOption | null>(null);
  const [cityQuery, setCityQuery] = useState(selectedCity);
  const [streetQuery, setStreetQuery] = useState(selectedStreet);
  const [statusMessage, setStatusMessage] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [pinpointMode, setPinpointMode] = useState(false);

  const stateData = useMemo(
    () => nigeriaStates.find((entry) => entry.state === selectedState) ?? nigeriaStates[0],
    [selectedState],
  );

  const activeCenter = selectedStreetOption?.coordinates ?? selectedCityOption?.coordinates ?? stateData.center;

  useEffect(() => {
    setCityQuery(selectedCity);
  }, [selectedCity]);

  useEffect(() => {
    setStreetQuery(selectedStreet);
  }, [selectedStreet]);

  useEffect(() => {
    if (!token || cityQuery.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", `${cityQuery}, ${selectedState}, Nigeria`);
    url.searchParams.set("types", "place,locality,district");
    url.searchParams.set("country", "NG");
    url.searchParams.set("limit", "8");
    url.searchParams.set("access_token", token);

    fetch(url.toString(), { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as GeocodeResponse;
        return data.features ?? [];
      })
      .then((features) => {
        const options = features
          .filter((feature) => feature.geometry?.coordinates)
          .map((feature, index) => ({
            id: feature.id ?? `${normalizeFeatureName(feature)}-${index}`,
            label: normalizeFeatureName(feature),
            coordinates: feature.geometry!.coordinates!,
          }));
        setCityOptions(options);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setCityOptions([]);
      });

    return () => controller.abort();
  }, [cityQuery, selectedState, token]);

  useEffect(() => {
    if (!token || !selectedCityOption || streetQuery.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", `${streetQuery}, ${selectedCity}, ${selectedState}, Nigeria`);
    url.searchParams.set("types", "street,address");
    url.searchParams.set("country", "NG");
    url.searchParams.set("limit", "8");
    url.searchParams.set(
      "proximity",
      `${selectedCityOption.coordinates[0]},${selectedCityOption.coordinates[1]}`,
    );
    url.searchParams.set("access_token", token);

    fetch(url.toString(), { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as GeocodeResponse;
        return data.features ?? [];
      })
      .then((features) => {
        const options = features
          .filter((feature) => feature.geometry?.coordinates)
          .map((feature, index) => ({
            id: feature.id ?? `${normalizeFeatureName(feature)}-${index}`,
            label: normalizeFeatureName(feature),
            coordinates: feature.geometry!.coordinates!,
          }));
        setStreetOptions(options);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setStreetOptions([]);
      });

    return () => controller.abort();
  }, [selectedCity, selectedCityOption, selectedState, streetQuery, token]);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: activeCenter,
      zoom: derivedMapZoom(zoom),
      pitch: 42,
      bearing: -18,
      antialias: true,
    });

    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-left");

    const handleStyleLoad = () => {
      setLoaded(true);
    };

    const handleZoomEnd = () => {
      const nextZoom = Math.min(5, Math.max(1, Math.round((map.getZoom() - 7.6) / 1.15)));
      onZoomChange(nextZoom);
    };

    const handleMoveEnd = () => {
      const center = map.getCenter();
      onFocusChange({ latitude: center.lat, longitude: center.lng });
    };

    const handleMapClick = (event: mapboxgl.MapMouseEvent) => {
      if (!pinpointMode) {
        return;
      }

      const pin = {
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
        label: `Pinned Point • ${formatCoordinates(event.lngLat.lat, event.lngLat.lng)}`,
      };
      onExactPinChange(pin);
      setPinpointMode(false);
      setStatusMessage("Exact location pinned on the map.");
    };

    map.on("load", handleStyleLoad);
    map.on("style.load", handleStyleLoad);
    map.on("zoomend", handleZoomEnd);
    map.on("moveend", handleMoveEnd);
    map.on("click", handleMapClick);

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      pinpointMarkerRef.current?.remove();
      pinpointMarkerRef.current = null;
      setLoaded(false);
      map.off("load", handleStyleLoad);
      map.off("style.load", handleStyleLoad);
      map.off("zoomend", handleZoomEnd);
      map.off("moveend", handleMoveEnd);
      map.off("click", handleMapClick);
      map.remove();
      mapRef.current = null;
    };
  }, [activeCenter, mapStyle, onExactPinChange, onFocusChange, onZoomChange, pinpointMode, token, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleRef.current === mapStyle) {
      return;
    }

    styleRef.current = mapStyle;
    setLoaded(false);
    map.setStyle(mapStyle);
  }, [mapStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    map.flyTo({
      center: activeCenter,
      zoom: derivedMapZoom(zoom),
      speed: 0.8,
      curve: 1.2,
      essential: true,
    });
  }, [activeCenter, loaded, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    const sourceId = "geopulse-overlays";
    const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;

    const features: MapFeature[] = [
      ...watchZones.map((zone) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [zone.longitude, zone.latitude],
        },
        properties: {
          kind: "watchZone",
          title: zone.name,
          subtitle: `${zone.riskLevel.toUpperCase()} • Score ${zone.riskScore.toFixed(0)}`,
          tone: riskColor(zone.riskLevel),
        },
      })),
      ...incidents.map((incident) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [incident.longitude, incident.latitude],
        },
        properties: {
          kind: "incident",
          title: incident.title,
          subtitle: `${incident.severity.toUpperCase()} • ${incident.confidence.toUpperCase()}`,
          tone: severityColor(incident.severity),
        },
      })),
    ];

    const collection: GeoJSON.FeatureCollection<GeoJSON.Point, MapFeature["properties"]> = {
      type: "FeatureCollection",
      features,
    };

    if (source) {
      source.setData(collection);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: collection,
      });

      map.addLayer({
        id: "geopulse-watch-zones",
        type: "circle",
        source: sourceId,
        filter: ["==", ["get", "kind"], "watchZone"],
        paint: {
          "circle-radius": 20,
          "circle-color": ["coalesce", ["get", "tone"], "#4edea3"],
          "circle-opacity": 0.12,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": ["coalesce", ["get", "tone"], "#4edea3"],
        },
      });

      map.addLayer({
        id: "geopulse-incidents",
        type: "circle",
        source: sourceId,
        filter: ["==", ["get", "kind"], "incident"],
        paint: {
          "circle-radius": 7,
          "circle-color": ["coalesce", ["get", "tone"], "#ff817a"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-blur": 0.05,
        },
      });

      map.addLayer({
        id: "geopulse-incident-glow",
        type: "circle",
        source: sourceId,
        filter: ["==", ["get", "kind"], "incident"],
        paint: {
          "circle-radius": 18,
          "circle-color": ["coalesce", ["get", "tone"], "#ff817a"],
          "circle-opacity": 0.14,
          "circle-blur": 0.8,
        },
      });

      map.on("click", "geopulse-incidents", (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") {
          return;
        }
        const coordinates = [...feature.geometry.coordinates] as [number, number];
        const title = feature.properties?.title ?? "Incident";
        const subtitle = feature.properties?.subtitle ?? "";

        new mapboxgl.Popup({ offset: 18 })
          .setLngLat(coordinates)
          .setHTML(
            `<div style="font-family: Inter, Segoe UI, sans-serif; color:#dee1f7;">
              <strong style="display:block; margin-bottom:4px;">${title}</strong>
              <span style="font-size:12px; color:#bcc9cd;">${subtitle}</span>
            </div>`,
          )
          .addTo(map);
      });

      map.on("click", "geopulse-watch-zones", (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") {
          return;
        }
        const coordinates = [...feature.geometry.coordinates] as [number, number];
        const title = feature.properties?.title ?? "Watch Zone";
        const subtitle = feature.properties?.subtitle ?? "";

        new mapboxgl.Popup({ offset: 18 })
          .setLngLat(coordinates)
          .setHTML(
            `<div style="font-family: Inter, Segoe UI, sans-serif; color:#dee1f7;">
              <strong style="display:block; margin-bottom:4px;">${title}</strong>
              <span style="font-size:12px; color:#bcc9cd;">${subtitle}</span>
            </div>`,
          )
          .addTo(map);
      });
    }
  }, [incidents, loaded, watchZones]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const stateMarker = new mapboxgl.Marker({
      element: createMarkerElement("#4cd7f6", !selectedCityOption && !selectedStreetOption),
      anchor: "center",
    })
      .setLngLat(stateData.center)
      .addTo(map);

    markersRef.current.push(stateMarker);

    if (selectedCityOption) {
      const cityMarker = new mapboxgl.Marker({
        element: createMarkerElement("#4edea3", !selectedStreetOption),
        anchor: "center",
      })
        .setLngLat(selectedCityOption.coordinates)
        .addTo(map);
      markersRef.current.push(cityMarker);
    }

    if (selectedStreetOption) {
      const streetMarker = new mapboxgl.Marker({
        element: createMarkerElement("#ff817a", true),
        anchor: "center",
      })
        .setLngLat(selectedStreetOption.coordinates)
        .addTo(map);
      markersRef.current.push(streetMarker);
    }

    streetOptions.forEach((option) => {
      if (selectedStreetOption && option.label === selectedStreetOption.label) {
        return;
      }
      const marker = new mapboxgl.Marker({
        element: createMarkerElement("#ff817a", false),
        anchor: "center",
      })
        .setLngLat(option.coordinates)
        .addTo(map);
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 16 }).setText(option.label);
      marker.setPopup(popup);
      marker.getElement().addEventListener("click", () => {
        setSelectedStreetOption(option);
        setStreetQuery(option.label);
        onStreetChange(option.label);
        onExactPinChange({
          latitude: option.coordinates[1],
          longitude: option.coordinates[0],
          label: option.label,
        });
      });
      markersRef.current.push(marker);
    });
  }, [
    loaded,
    onExactPinChange,
    onStreetChange,
    selectedCityOption,
    selectedStreetOption,
    stateData.center,
    streetOptions,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) {
      return;
    }

    pinpointMarkerRef.current?.remove();
    pinpointMarkerRef.current = null;

    if (!exactPin) {
      return;
    }

    pinpointMarkerRef.current = new mapboxgl.Marker({
      element: createPinpointMarkerElement(),
      anchor: "center",
    })
      .setLngLat([exactPin.longitude, exactPin.latitude])
      .setPopup(
        new mapboxgl.Popup({ offset: 18 }).setHTML(
          `<div style="font-family: Inter, Segoe UI, sans-serif; color:#dee1f7;">
            <strong style="display:block; margin-bottom:4px;">${exactPin.label}</strong>
            <span style="font-size:12px; color:#bcc9cd;">${formatCoordinates(exactPin.latitude, exactPin.longitude)}</span>
          </div>`,
        ),
      )
      .addTo(map);
  }, [exactPin, loaded]);

  function chooseCity(option: SearchOption) {
    setSelectedCityOption(option);
    setSelectedStreetOption(null);
    setStreetOptions([]);
    setStreetQuery("");
    setCityQuery(option.label);
    onCityChange(option.label);
    onStreetChange("");
    onExactPinChange({
      latitude: option.coordinates[1],
      longitude: option.coordinates[0],
      label: option.label,
    });
  }

  function chooseStreet(option: SearchOption) {
    setSelectedStreetOption(option);
    setStreetQuery(option.label);
    onStreetChange(option.label);
    onExactPinChange({
      latitude: option.coordinates[1],
      longitude: option.coordinates[0],
      label: option.label,
    });
  }

  async function useMyLocation() {
    if (!token || !navigator.geolocation) {
      setStatusMessage("Geolocation is not available in this browser.");
      return;
    }

    setIsLocating(true);
    setStatusMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { longitude, latitude } = position.coords;
          const reverseUrl = new URL("https://api.mapbox.com/search/geocode/v6/reverse");
          reverseUrl.searchParams.set("longitude", String(longitude));
          reverseUrl.searchParams.set("latitude", String(latitude));
          reverseUrl.searchParams.set("country", "NG");
          reverseUrl.searchParams.set("access_token", token);

          const response = await fetch(reverseUrl.toString());
          const data = (await response.json()) as GeocodeResponse;
          const feature = data.features?.[0];

          const regionName =
            feature?.properties?.context?.region?.name || selectedState;
          const cityName =
            feature?.properties?.context?.place?.name ||
            feature?.properties?.context?.locality?.name ||
            selectedCity ||
            "Current City";
          const streetName =
            feature?.properties?.context?.street?.name ||
            feature?.properties?.name ||
            feature?.properties?.full_address ||
            "Current Street";

          const matchedState =
            nigeriaStates.find((entry) =>
              regionName.toLowerCase().includes(entry.state.toLowerCase()),
            ) ??
            (regionName.toLowerCase().includes("federal capital")
              ? nigeriaStates.find((entry) => entry.state === "FCT Abuja")
              : undefined) ??
            nigeriaStates[0];

          onStateChange(matchedState.state);

          const cityOption: SearchOption = {
            id: `geo-city-${cityName}`,
            label: cityName,
            coordinates: [longitude, latitude],
          };
          const streetOption: SearchOption = {
            id: `geo-street-${streetName}`,
            label: streetName,
            coordinates: [longitude, latitude],
          };

          setCityOptions((current) => {
            const next = current.filter((entry) => entry.label !== cityOption.label);
            return [cityOption, ...next].slice(0, 8);
          });
          setStreetOptions((current) => {
            const next = current.filter((entry) => entry.label !== streetOption.label);
            return [streetOption, ...next].slice(0, 8);
          });
          setSelectedCityOption(cityOption);
          setSelectedStreetOption(streetOption);
          setCityQuery(cityName);
          setStreetQuery(streetName);
          onCityChange(cityName);
          onStreetChange(streetName);
          onExactPinChange({
            latitude,
            longitude,
            label: `${streetName}, ${cityName}`,
          });
          setStatusMessage("Centered on your current location.");
        } catch {
          setStatusMessage("Could not resolve your current location.");
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        setStatusMessage("Location access was denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />

      {!token ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgb(9,14,28,0.88)] px-6 text-center">
          <div className="glass-panel max-w-md rounded-2xl p-6">
            <p className="font-mono-ui text-[11px] uppercase tracking-[0.16em] text-[var(--tertiary-container)]">
              Mapbox Token Required
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--on-surface-variant)]">
              Add `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` to your frontend environment so the
              interactive map can render.
            </p>
          </div>
        </div>
      ) : null}

      <div className="absolute left-6 top-6 z-10 flex max-w-[calc(100%-3rem)] flex-wrap gap-3">
        <div className="glass-panel rounded-full border border-[rgb(76,215,246,0.25)] px-5 py-3">
          <span className="font-mono-ui text-[12px] tracking-[0.08em] text-[var(--on-surface)]">
            Topographical Intelligence
          </span>
        </div>
        <div className="glass-panel rounded-full border border-[rgb(78,222,163,0.28)] bg-[rgb(78,222,163,0.08)] px-5 py-3">
          <span className="font-mono-ui text-[12px] tracking-[0.08em] text-[var(--on-surface)]">
            Active Scan: ON
          </span>
        </div>
        {exactPin ? (
          <div className="glass-panel rounded-full border border-[rgb(255,129,122,0.24)] bg-[rgb(255,129,122,0.08)] px-5 py-3">
            <span className="font-mono-ui text-[12px] tracking-[0.08em] text-[var(--tertiary-container)]">
              Exact Pin: {formatCoordinates(exactPin.latitude, exactPin.longitude)}
            </span>
          </div>
        ) : null}
      </div>

      <div className="absolute left-6 top-24 z-10 w-[340px] max-w-[calc(100%-3rem)] glass-panel rounded-2xl border border-[rgb(61,73,76,0.3)] p-4 lg:left-auto lg:right-6 lg:top-6 lg:w-[320px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono-ui text-[11px] uppercase tracking-[0.16em] text-[var(--primary)]">
              Map Controls
            </p>
            <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
              Search any city or street, use your location, or pin an exact point.
            </p>
          </div>
          <span className="rounded-full bg-[rgb(76,215,246,0.08)] px-3 py-1 font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--primary)]">
            Zoom {zoom}x
          </span>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-2">
            <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              Map Style
            </span>
            <select
              value={mapStyle}
              onChange={(event) => onMapStyleChange(event.target.value)}
              className="rounded-xl border border-[rgb(61,73,76,0.45)] bg-[rgb(22,27,43,0.84)] px-3 py-2.5 text-sm text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)]"
            >
              {mapStyleOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[var(--surface-container-low)]">
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              State
            </span>
            <select
              value={selectedState}
              onChange={(event) => {
                setSelectedCityOption(null);
                setSelectedStreetOption(null);
                setCityOptions([]);
                setStreetOptions([]);
                setCityQuery("");
                setStreetQuery("");
                setStatusMessage("");
                onExactPinChange(null);
                onStateChange(event.target.value);
              }}
              className="rounded-xl border border-[rgb(61,73,76,0.45)] bg-[rgb(22,27,43,0.84)] px-3 py-2.5 text-sm text-[var(--on-surface)] outline-none transition focus:border-[var(--primary)]"
            >
              {nigeriaStates.map((entry) => (
                <option key={entry.state} value={entry.state} className="bg-[var(--surface-container-low)]">
                  {entry.state}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              City
            </span>
            <input
              list="city-options"
              value={cityQuery}
              onChange={(event) => {
                const nextValue = event.target.value;
                setCityQuery(nextValue);
                if (nextValue.trim().length < 2) {
                  setCityOptions([]);
                }
                const selected = cityOptions.find((option) => option.label === nextValue);
                if (selected) {
                  chooseCity(selected);
                }
              }}
              placeholder="Search any city in the selected state"
              className="rounded-xl border border-[rgb(61,73,76,0.45)] bg-[rgb(22,27,43,0.84)] px-3 py-2.5 text-sm text-[var(--on-surface)] outline-none transition placeholder:text-[rgb(188,201,205,0.45)] focus:border-[var(--primary)]"
            />
            <datalist id="city-options">
              {cityOptions.map((option) => (
                <option key={option.id} value={option.label} />
              ))}
            </datalist>
          </label>

          <label className="grid gap-2">
            <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
              Street
            </span>
            <input
              list="street-options"
              value={streetQuery}
              onChange={(event) => {
                const nextValue = event.target.value;
                setStreetQuery(nextValue);
                if (nextValue.trim().length < 2) {
                  setStreetOptions([]);
                }
                const selected = streetOptions.find((option) => option.label === nextValue);
                if (selected) {
                  chooseStreet(selected);
                }
              }}
              placeholder="Search any street or address"
              className="rounded-xl border border-[rgb(61,73,76,0.45)] bg-[rgb(22,27,43,0.84)] px-3 py-2.5 text-sm text-[var(--on-surface)] outline-none transition placeholder:text-[rgb(188,201,205,0.45)] focus:border-[var(--primary)]"
            />
            <datalist id="street-options">
              {streetOptions.map((option) => (
                <option key={option.id} value={option.label} />
              ))}
            </datalist>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={useMyLocation}
              className="rounded-xl bg-[rgb(76,215,246,0.12)] px-3 py-2.5 text-sm font-semibold text-[var(--primary)] transition hover:bg-[rgb(76,215,246,0.18)]"
            >
              {isLocating ? "Locating..." : "Use my location"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPinpointMode((current) => !current);
                setStatusMessage(
                  pinpointMode
                    ? "Exact pin mode cancelled."
                    : "Click anywhere on the map to capture an exact location.",
                );
              }}
              className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                pinpointMode
                  ? "bg-[rgb(255,129,122,0.16)] text-[var(--tertiary-container)]"
                  : "bg-[rgb(78,222,163,0.12)] text-[var(--secondary)] hover:bg-[rgb(78,222,163,0.18)]"
              }`}
            >
              {pinpointMode ? "Cancel pinpoint" : "Pin exact location"}
            </button>
          </div>

          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onZoomChange(Math.max(1, zoom - 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgb(61,73,76,0.4)] bg-[rgb(22,27,43,0.84)] text-[var(--on-surface)]"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => onZoomChange(Math.min(5, zoom + 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[rgb(61,73,76,0.4)] bg-[rgb(22,27,43,0.84)] text-[var(--on-surface)]"
              >
                +
              </button>
            </div>
            {exactPin ? (
              <button
                type="button"
                onClick={() => {
                  onExactPinChange(null);
                  setStatusMessage("Exact pin cleared.");
                }}
                className="flex-1 rounded-xl border border-[rgb(61,73,76,0.45)] bg-[rgb(22,27,43,0.84)] px-3 py-2.5 text-sm font-semibold text-[var(--on-surface)] transition hover:border-[var(--primary)]"
              >
                Clear pin
              </button>
            ) : null}
          </div>

          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={zoom}
            onChange={(event) => onZoomChange(Number(event.target.value))}
            className="accent-[var(--primary)]"
          />

          {statusMessage ? (
            <p className="text-xs leading-6 text-[var(--on-surface-variant)]">{statusMessage}</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
