"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardMap } from "@/components/dashboard-map";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole, type NavItem } from "@/lib/access";
import { formatReportType, REPORT_TYPE_DEFINITIONS } from "@/lib/report-types";

type ExactPin = {
  latitude: number;
  longitude: number;
  label: string;
};

type LocationSuggestion = {
  id: string;
  label: string;
  description: string;
  latitude: number;
  longitude: number;
};

type ReportTimeMode = "now" | "custom";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

type DashboardNavItem = NavItem & { icon: string };

const NAV_ITEMS: DashboardNavItem[] = [
  { label: "Home", icon: "⬡", path: "/dashboard" },
  { label: "Map", icon: "◎", path: "/dashboard/live-intelligence" },
  { label: "Report", icon: "◈", path: "/dashboard/incident-reports" },
  { label: "Routes", icon: "◍", path: "/dashboard/route-intelligence" },
  { label: "Alerts", icon: "◈", path: "/dashboard/ai-predictions" },
  { label: "Profile", icon: "◉", path: "/dashboard/profile" },
];

const REPORT_TYPES: Array<{ value: string; label: string }> = REPORT_TYPE_DEFINITIONS.map(({ value, label }) => ({
  value,
  label,
}));

const REPORT_PRESETS: Record<string, { severity: string; confidence: string }> = {
  suspicious_activity: { severity: "medium", confidence: "emerging" },
  road_accident: { severity: "medium", confidence: "raw" },
  armed_robbery: { severity: "high", confidence: "raw" },
  kidnapping: { severity: "critical", confidence: "raw" },
  medical_emergency: { severity: "high", confidence: "raw" },
  road_obstruction: { severity: "medium", confidence: "raw" },
  unsafe_route: { severity: "high", confidence: "emerging" },
  fire_outbreak: { severity: "critical", confidence: "raw" },
  flooding: { severity: "high", confidence: "raw" },
  gunshots_heard: { severity: "critical", confidence: "raw" },
};

function mediaTypeFromFile(file: File) {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "other";
}

function coordinateLocationLabel(latitude: number, longitude: number) {
  return `Near ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function toDateTimeLocalValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function resolveOccurredAtIso(reportTimeMode: ReportTimeMode, customOccurredAt: string) {
  if (reportTimeMode === "now") {
    return new Date().toISOString();
  }

  if (!customOccurredAt) {
    return null;
  }

  const parsed = new Date(customOccurredAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

async function fetchLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
  if (!MAPBOX_TOKEN || query.trim().length < 2) {
    return [];
  }

  const searchParams = new URLSearchParams({
    q: query.trim(),
    access_token: MAPBOX_TOKEN,
    autocomplete: "true",
    country: "NG",
    language: "en",
    limit: "5",
    types: "address,street,place,locality,neighborhood",
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error("Unable to load location suggestions right now.");
  }

  const payload = await response.json();
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features.flatMap((feature: Record<string, unknown>) => {
    const properties = feature.properties as Record<string, unknown> | undefined;
    const geometry = feature.geometry as { coordinates?: unknown[] } | undefined;
    const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
    const longitude = typeof coordinates[0] === "number" ? coordinates[0] : null;
    const latitude = typeof coordinates[1] === "number" ? coordinates[1] : null;
    if (latitude === null || longitude === null) {
      return [];
    }

    const label = String(
      feature.full_address ??
        properties?.full_address ??
        feature.name_preferred ??
        properties?.name_preferred ??
        feature.name ??
        properties?.name ??
        feature.place_formatted ??
        properties?.place_formatted ??
        "",
    ).trim();

    const description = String(
      feature.place_formatted ??
        properties?.place_formatted ??
        properties?.context ??
        "",
    ).trim();

    return [
      {
        id: String(feature.mapbox_id ?? properties?.mapbox_id ?? feature.id ?? `${latitude}:${longitude}`),
        label: label || coordinateLocationLabel(latitude, longitude),
        description,
        latitude,
        longitude,
      },
    ];
  });
}

async function reverseGeocodeLocation(latitude: number, longitude: number) {
  if (!MAPBOX_TOKEN) {
    return coordinateLocationLabel(latitude, longitude);
  }

  const searchParams = new URLSearchParams({
    longitude: String(longitude),
    latitude: String(latitude),
    access_token: MAPBOX_TOKEN,
    language: "en",
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${searchParams.toString()}`);
  if (!response.ok) {
    return coordinateLocationLabel(latitude, longitude);
  }

  const payload = await response.json();
  const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
  const properties = feature?.properties as Record<string, unknown> | undefined;
  return (
    String(
      feature?.full_address ??
        properties?.full_address ??
        feature?.name_preferred ??
        properties?.name_preferred ??
        feature?.name ??
        properties?.name ??
        feature?.place_formatted ??
        properties?.place_formatted ??
        "",
    ).trim() ||
    coordinateLocationLabel(latitude, longitude)
  );
}

function Sidebar({
  open,
  onClose,
  activeIndex,
  onNavSelect,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  activeIndex: number;
  onNavSelect: (index: number) => void;
  onLogout: () => void;
}) {
  return (
    <>
      {open ? (
        <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/[0.06] bg-[#070D1A] transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/[0.06] px-6 py-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-lg text-cyan-400">⬡</span>
            <div>
              <h1 className="font-display text-lg font-bold leading-none tracking-tight text-cyan-400">GeoPulse AI</h1>
              <p className="mt-0.5 font-mono-ui text-[9px] uppercase tracking-[0.22em] text-white/35">Tactical Command</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-2 px-3 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-white/25">Navigation</p>
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item.label}
              onClick={() => {
                onNavSelect(index);
                onClose();
              }}
              className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                activeIndex === index
                  ? "bg-cyan-500/12 text-white ring-1 ring-cyan-500/20"
                  : "text-white/45 hover:bg-white/[0.04] hover:text-white/75"
              }`}
            >
              <span className={`text-base leading-none transition-colors ${activeIndex === index ? "text-cyan-400" : "text-white/25 group-hover:text-white/50"}`}>
                {item.icon}
              </span>
              <span className="text-[13px] font-medium">{item.label}</span>
              {activeIndex === index ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#4cd7f6]" /> : null}
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

void Sidebar;

function MenuIconButton() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="3" y1="7" x2="21" y2="7" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </svg>
  );
}

function LocationPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s6-5.2 6-11a6 6 0 0 0-12 0c0 5.8 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

export default function IncidentReportsPage() {
  const role = getCurrentRole();

  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(2);
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token"),
  );
  const [mapZoom, setMapZoom] = useState(3);

  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]["value"]>("suspicious_activity");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [reportTimeMode, setReportTimeMode] = useState<ReportTimeMode>("now");
  const [customOccurredAt, setCustomOccurredAt] = useState(() => toDateTimeLocalValue(new Date()));
  const [anonymousMode, setAnonymousMode] = useState(true);
  const [reportMode, setReportMode] = useState<"quick" | "detailed">("quick");
  const [exactPin, setExactPin] = useState<ExactPin | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoadingLocationSuggestions, setIsLoadingLocationSuggestions] = useState(false);
  const [isLocationSuggestionOpen, setIsLocationSuggestionOpen] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isLocationSuggestionOpen || locationName.trim().length < 2) {
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingLocationSuggestions(true);
      try {
        const suggestions = await fetchLocationSuggestions(locationName);
        if (!active) return;
        setLocationSuggestions(suggestions);
      } catch {
        if (!active) return;
        setLocationSuggestions([]);
      } finally {
        if (active) {
          setIsLoadingLocationSuggestions(false);
        }
      }
    }, 260);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [isLocationSuggestionOpen, locationName]);

  useEffect(() => {
    const latValue = searchParams.get("lat");
    const lngValue = searchParams.get("lng");
    if (!latValue || !lngValue) {
      return;
    }

    const latitude = Number(latValue);
    const longitude = Number(lngValue);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const label = searchParams.get("label")?.trim() || coordinateLocationLabel(latitude, longitude);
    setExactPin({ latitude, longitude, label });
    setLocationName((current) => (current.trim() ? current : label));
    setMapZoom(5);
    setStatusMessage(null);
  }, [searchParams]);

  const selectedReportType = useMemo(
    () => REPORT_TYPES.find((item) => item.value === reportType) ?? REPORT_TYPES[0],
    [reportType],
  );

  const selectedPreset = REPORT_PRESETS[reportType] ?? REPORT_PRESETS.suspicious_activity;
  const isQuickMode = reportMode === "quick";

  const attachmentSummary = useMemo(() => {
    if (attachments.length === 0) return "No media attached";
    if (attachments.length === 1) return attachments[0].name;
    return `${attachments.length} files attached`;
  }, [attachments]);

  const occurredAtIso = useMemo(
    () => resolveOccurredAtIso(reportTimeMode, customOccurredAt),
    [customOccurredAt, reportTimeMode],
  );

  const reportTimeLabel = useMemo(() => {
    if (reportTimeMode === "now") {
      return "Happening now";
    }

    if (!occurredAtIso) {
      return "Choose when it happened";
    }

    return new Date(occurredAtIso).toLocaleString();
  }, [occurredAtIso, reportTimeMode]);

  const selectedLocationLabel = exactPin
    ? `${exactPin.latitude.toFixed(5)}, ${exactPin.longitude.toFixed(5)}`
    : "Drop a pin on the map to set the location";

  function handleNavSelect(index: number) {
    setActiveNav(index);
    router.push(NAV_ITEMS[index].path);
  }

  void activeNav;
  void handleNavSelect;

  function handleLogout() {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }

  function handleLocationNameChange(value: string) {
    setLocationName(value);
    setIsLocationSuggestionOpen(true);
    if (value.trim().length < 2) {
      setLocationSuggestions([]);
      setIsLoadingLocationSuggestions(false);
    }
  }

  function handleSelectLocationSuggestion(suggestion: LocationSuggestion) {
    setLocationName(suggestion.label);
    setExactPin({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
      label: suggestion.label,
    });
    setMapZoom(5);
    setLocationSuggestions([]);
    setIsLocationSuggestionOpen(false);
    setStatusMessage(null);
  }

  function handleUseCurrentLocation() {
    setStatusMessage(null);
    if (typeof window === "undefined" || !navigator.geolocation) {
      setStatusMessage({
        type: "error",
        text: "Location access is not available on this device. You can still type a place and drop a pin manually.",
      });
      return;
    }

    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextPin = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: `Current location · ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
        };
        setExactPin(nextPin);
        const reverseLabel = await reverseGeocodeLocation(nextPin.latitude, nextPin.longitude);
        setLocationName((current) => (current.trim() ? current : reverseLabel));
        setMapZoom(5);
        setLocationSuggestions([]);
        setIsLocationSuggestionOpen(false);
        setIsLocatingUser(false);
        setStatusMessage({
          type: "success",
          text: "Current location captured. You can edit the place name if you want to add a landmark or street.",
        });
      },
      () => {
        setIsLocatingUser(false);
        setStatusMessage({
          type: "error",
          text: "Unable to get your current location. Please allow location access or drop a pin manually on the map.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }

  async function uploadAttachments(reportId: string, patrolUploadId?: number) {
    if (!attachments.length || !authToken) return;

    for (const file of attachments) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("media_type", mediaTypeFromFile(file));
      formData.append("original_filename", file.name);
      formData.append("mime_type", file.type || "application/octet-stream");
      formData.append("file_size_bytes", String(file.size));
      if (exactPin) {
        formData.append("latitude", String(exactPin.latitude));
        formData.append("longitude", String(exactPin.longitude));
      }
      formData.append("external_url", "");
      formData.append("metadata", JSON.stringify({ report_id: reportId, anonymous: anonymousMode }));
      if (patrolUploadId) {
        formData.append("patrol_upload", String(patrolUploadId));
      }

      const response = await fetch(`${API_BASE_URL}/media-assets/`, {
        method: "POST",
        headers: { Authorization: `Token ${authToken}` },
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail ?? `Failed to upload ${file.name}`);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);

    if (!authToken) {
      setStatusMessage({ type: "error", text: "You need to sign in before submitting a report." });
      return;
    }

    if (!description.trim()) {
      setStatusMessage({ type: "error", text: "Please add a short description of the incident." });
      return;
    }

    if (!locationName.trim()) {
      setStatusMessage({ type: "error", text: "Please enter a location name." });
      return;
    }

    if (!exactPin) {
      setStatusMessage({ type: "error", text: "Please drop a pin on the map to mark the incident location." });
      return;
    }

    if (reportTimeMode === "custom" && !customOccurredAt) {
      setStatusMessage({ type: "error", text: "Please choose the date and time the incident took place." });
      return;
    }

    if (!occurredAtIso) {
      setStatusMessage({ type: "error", text: "Please enter a valid incident date and time." });
      return;
    }

    if (new Date(occurredAtIso).getTime() > Date.now()) {
      setStatusMessage({ type: "error", text: "Incident time cannot be in the future." });
      return;
    }

    setIsSubmitting(true);
    try {
      const title = `${selectedReportType.label}: ${locationName.trim()}`;
      const signalPayload = {
        title,
        description: description.trim(),
        source_profile: null,
        cluster: null,
        category: reportType,
        status: "raw",
        confidence: selectedPreset.confidence,
        severity: selectedPreset.severity,
        location_name: locationName.trim(),
        latitude: exactPin.latitude,
        longitude: exactPin.longitude,
        coordinate_precision_meters: 25,
        route_hint: anonymousMode ? "Anonymous user report" : "User-submitted report",
        occurred_at: occurredAtIso,
        metadata: {
          anonymous: anonymousMode,
          attachments: attachments.map((file) => ({ name: file.name, type: file.type, size: file.size })),
          report_type_label: selectedReportType.label,
          report_time_mode: reportTimeMode,
        },
      };

      const signalResponse = await fetch(`${API_BASE_URL}/signals/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(signalPayload),
      });

      const signalPayloadResponse = await signalResponse.json().catch(() => null);
      if (!signalResponse.ok) {
        throw new Error(signalPayloadResponse?.detail ?? "Failed to submit report.");
      }

      const signalId = String(signalPayloadResponse?.id ?? "");

      let patrolUploadId: number | undefined;
      const patrolResponse = await fetch(`${API_BASE_URL}/patrol-uploads/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          upload_source: "report",
          summary: description.trim(),
          recorded_at: occurredAtIso,
          metadata: {
            signal_id: signalId,
            anonymous: anonymousMode,
            location_name: locationName.trim(),
            report_time_mode: reportTimeMode,
          },
        }),
      });

      if (patrolResponse.ok) {
        const patrolPayload = await patrolResponse.json().catch(() => null);
        patrolUploadId = Number(patrolPayload?.id);
      }

      await uploadAttachments(signalId, Number.isFinite(patrolUploadId) ? patrolUploadId : undefined);

      setStatusMessage({ type: "success", text: "Your report was submitted to the intelligence queue." });
      setDescription("");
      setLocationName("");
      setAttachments([]);
      setExactPin(null);
      setAnonymousMode(true);
      setReportType("suspicious_activity");
      setReportTimeMode("now");
      setCustomOccurredAt(toDateTimeLocalValue(new Date()));
    } catch (error) {
      setStatusMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unable to submit report.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_45%_at_0%_0%,rgba(6,182,212,0.05),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_40%_30%_at_100%_100%,rgba(76,215,246,0.04),transparent)]" />

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/incident-reports"
        onNavigate={(path) => router.push(path)}
        onLogout={handleLogout}
        role={role}
      />

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#070D1A]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 lg:hidden"
            >
              <MenuIconButton />
            </button>
            <div>
              <p className="font-mono-ui text-[9px] uppercase tracking-[0.22em] text-cyan-400">Report</p>
              <h1 className="text-sm font-semibold text-white/85">Submit an incident report</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/40">
            <span className={`h-1.5 w-1.5 rounded-full ${isSubmitting ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            {isSubmitting ? "Submitting" : "Ready"}
          </div>
        </header>

        <div className="border-b border-white/[0.06] bg-[#08101f]/60 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono-ui text-[9px] uppercase tracking-[0.26em] text-cyan-400">Community Reporting</p>
              <h2 className="mt-1.5 text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">Where users submit incidents</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/40">
                {isQuickMode
                  ? "Quick mode keeps this lightweight: choose a type, add a place, describe what happened, and drop a pin."
                  : "Detailed mode gives you room for media, extra context, and a fuller report preview before you submit."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-300">
                {isQuickMode ? "Quick mode" : "Detailed mode"}
              </span>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/40">
                {formatReportType(reportType)}
              </span>
              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/40">
                {attachmentSummary}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 py-4 sm:px-6 lg:px-8">
          <div className={`grid gap-4 ${isQuickMode ? "xl:grid-cols-[minmax(0,1fr)_360px]" : "xl:grid-cols-[minmax(0,1fr)_420px]"}`}>
            <section className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="rounded-2xl border border-white/[0.06] bg-[#08101f] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">Reporting mode</p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {isQuickMode ? "Fast report flow" : "Full report flow"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/40">
                      {isQuickMode
                        ? "Best for stressed users who just need to send the essentials quickly."
                        : "Best when the user wants to attach evidence and review more details before submitting."}
                    </p>
                  </div>
                  <div className="flex rounded-2xl border border-white/[0.08] bg-[#0A1020]/80 p-1">
                    <button
                      type="button"
                      onClick={() => setReportMode("quick")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                        isQuickMode ? "bg-cyan-500 text-[#07111f]" : "text-white/55 hover:text-white"
                      }`}
                    >
                      Quick
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportMode("detailed")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                        !isQuickMode ? "bg-cyan-500 text-[#07111f]" : "text-white/55 hover:text-white"
                      }`}
                    >
                      Detailed
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Report type</span>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value as typeof reportType)}
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/90 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                  >
                    {REPORT_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Location name</span>
                  <div className="relative">
                    <input
                      value={locationName}
                      onChange={(e) => handleLocationNameChange(e.target.value)}
                      onFocus={() => setIsLocationSuggestionOpen(true)}
                      placeholder="Start typing a street, place, junction, or full address"
                      className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/90 px-3 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-cyan-400/50"
                    />
                    {isLocationSuggestionOpen && (isLoadingLocationSuggestions || locationSuggestions.length > 0) ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08101f] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                        {isLoadingLocationSuggestions ? (
                          <div className="px-3 py-3 text-xs text-white/45">Finding locations...</div>
                        ) : (
                          locationSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => handleSelectLocationSuggestion(suggestion)}
                              className="flex w-full flex-col items-start gap-1 border-b border-white/[0.06] px-3 py-3 text-left transition last:border-b-0 hover:bg-white/[0.04]"
                            >
                              <span className="text-sm font-medium text-white">{suggestion.label}</span>
                              <span className="text-xs text-white/40">
                                {suggestion.description || "Suggested location"}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  <p className="text-xs leading-5 text-white/35">
                    Start typing normally and select a suggested street, city, or full address. Picking one also places the map pin automatically.
                  </p>
                </label>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-[#08101f] p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">Incident time</p>
                    <p className="mt-1 text-sm font-semibold text-white">When did this happen?</p>
                    <p className="mt-1 text-xs leading-5 text-white/40">
                      Choose <strong>Now</strong> if the incident is happening currently, or switch to a custom date and time if you are reporting something that already happened.
                    </p>
                  </div>
                  <div className="flex rounded-2xl border border-white/[0.08] bg-[#0A1020]/80 p-1">
                    <button
                      type="button"
                      onClick={() => setReportTimeMode("now")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                        reportTimeMode === "now" ? "bg-cyan-500 text-[#07111f]" : "text-white/55 hover:text-white"
                      }`}
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportTimeMode("custom")}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                        reportTimeMode === "custom" ? "bg-cyan-500 text-[#07111f]" : "text-white/55 hover:text-white"
                      }`}
                    >
                      Pick date & time
                    </button>
                  </div>
                </div>

                {reportTimeMode === "custom" ? (
                  <label className="mt-4 block space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Date and time</span>
                    <input
                      type="datetime-local"
                      value={customOccurredAt}
                      max={toDateTimeLocalValue(new Date())}
                      onChange={(e) => setCustomOccurredAt(e.target.value)}
                      className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/90 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                    />
                    <p className="text-xs leading-5 text-white/35">
                      Use your local time. We will store the exact timestamp for verification, decay, and incident ordering.
                    </p>
                  </label>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-[#08101f] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">Location help</p>
                  <p className="mt-1 text-sm font-semibold text-white">Need a faster way to set the incident point?</p>
                  <p className="mt-1 text-xs leading-5 text-white/40">
                    If this is happening right in front of you or close by, use your current location and the map pin will be set automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocatingUser}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLocatingUser ? "Getting location..." : "Use my current location"}
                </button>
              </div>

              <label className="block space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={isQuickMode ? 5 : 8}
                  placeholder={
                    isQuickMode
                      ? "What happened? Keep it short and clear."
                      : "Describe what you saw, when it happened, and anything that helps verify the report."
                  }
                  className="w-full rounded-2xl border border-white/[0.08] bg-[#0A1020]/90 px-3 py-3 text-sm leading-6 text-white placeholder:text-white/25 outline-none transition focus:border-cyan-400/50"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                {!isQuickMode ? (
                  <label className="block space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Upload photo / video / audio</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,audio/*"
                      onChange={(e) => setAttachments(Array.from(e.target.files ?? []))}
                      className="block w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/90 px-3 py-2 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-[0.14em] file:text-cyan-300"
                    />
                    <p className="text-xs text-white/35">{attachmentSummary}</p>
                  </label>
                ) : (
                  <div className="rounded-2xl border border-dashed border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Quick mode note</p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                      Media upload is optional. Switch to detailed mode if you want to attach photo, video, or audio evidence.
                    </p>
                  </div>
                )}

                <label className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#0A1020]/90 px-4 py-3">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Anonymous mode</span>
                    <span className="block text-xs text-white/40">Hide your identity from the public report view.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={anonymousMode}
                    onChange={(e) => setAnonymousMode(e.target.checked)}
                    className="h-5 w-5 rounded border-white/[0.12] bg-[#0A1020] accent-cyan-400"
                  />
                </label>
              </div>

              <div className={`grid gap-3 ${isQuickMode ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                <div className="rounded-2xl border border-white/[0.06] bg-[#08101f] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Pin location</p>
                  <p className="mt-2 text-sm text-white/80">{selectedLocationLabel}</p>
                  <p className="mt-1 text-xs leading-5 text-white/35">
                    {exactPin
                      ? "You can keep this pin or move it on the map if the incident happened a little away from you."
                      : "Either drop a pin on the map or use your current location above."}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#08101f] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Suggested severity</p>
                  <p className="mt-2 text-sm text-white/80">{selectedPreset.severity}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-[#08101f] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Incident time</p>
                  <p className="mt-2 text-sm text-white/80">{reportTimeLabel}</p>
                </div>
                {!isQuickMode ? (
                  <div className="rounded-2xl border border-white/[0.06] bg-[#08101f] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">Evidence</p>
                    <p className="mt-2 text-sm text-white/80">{attachments.length} file{attachments.length === 1 ? "" : "s"}</p>
                  </div>
                ) : null}
              </div>

              {statusMessage ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    statusMessage.type === "success"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/25 bg-red-500/10 text-red-300"
                  }`}
                >
                  {statusMessage.text}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-cyan-500 px-5 text-sm font-semibold text-[#07111f] transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Submitting report..." : "Submit incident report"}
              </button>
            </section>

            <aside className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#08101f]">
                <div className="border-b border-white/[0.06] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Location picker</p>
                  <p className="mt-1 text-xs text-white/40">
                    {isQuickMode
                      ? "Drop one pin to finish the essential location step, or use your current location button."
                      : "Use pinpoint mode to drop the exact incident location."}
                  </p>
                </div>
                <div className={isQuickMode ? "h-[420px]" : "h-[520px]"}>
                  <DashboardMap
                    selectedState="Lagos"
                    zoom={mapZoom}
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                    incidents={[]}
                    watchZones={[]}
                    geofences={[]}
                    showControlsUi
                    showIncidents={false}
                    showHeatmap={false}
                    showRiskZones={false}
                    showGeofencing={false}
                    allowDirectPinDrop
                    exactPin={exactPin}
                    onExactPinChange={setExactPin}
                    onZoomChange={setMapZoom}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  {isQuickMode ? "Quick summary" : "Report preview"}
                </p>
                <div className="mt-3 space-y-2 text-sm text-white/75">
                  <p>{selectedReportType.label}</p>
                  <p className="text-white/45">{locationName.trim() || "No location name yet"}</p>
                  <p className="text-white/45">{reportTimeLabel}</p>
                  <p className="text-white/45">{exactPin ? `${exactPin.latitude.toFixed(5)}, ${exactPin.longitude.toFixed(5)}` : "No pin selected"}</p>
                  {isQuickMode ? (
                    <p className="text-white/35">
                      {description.trim() ? `${description.trim().slice(0, 96)}${description.trim().length > 96 ? "..." : ""}` : "No quick description yet"}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setExactPin(null)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/60 transition hover:text-white"
                >
                  <LocationPinIcon />
                  Clear pin
                </button>
              </div>
            </aside>
          </div>
        </form>
      </div>
    </div>
  );
}
