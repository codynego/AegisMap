"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SignalEvidenceRecord = {
  id: number;
  evidence_type: string;
  external_url: string;
  caption: string;
  captured_at: string | null;
};

type SignalRecord = {
  id: string;
  title: string;
  description: string;
  source_profile: number | null;
  submitted_by: number | null;
  cluster: number | null;
  category: string;
  status: string;
  confidence: string;
  severity: string;
  location_name: string;
  latitude: number | string | null;
  longitude: number | string | null;
  route_hint: string;
  occurred_at: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  evidence_items: SignalEvidenceRecord[];
  duplicate_of?: string | null;
};

type SourceProfileRecord = {
  id: number;
  label: string;
  source_type: string;
  reliability_band: string;
  trust_score: number | string;
  linked_username: string;
};

type IncidentRecord = {
  id: number;
  title: string;
  incident_type: string;
  primary_signal: string | null;
  severity: string;
  status: string;
  confidence: string;
  location_name: string;
};

type ApiListResponse<T> = {
  results?: T[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

const NAV_ITEMS = [
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

const STATUS_OPTIONS = ["all", "raw", "triaged", "clustered", "escalated", "dismissed"] as const;
const SEVERITY_OPTIONS = ["all", "critical", "high", "medium", "low"] as const;

function getList<T>(payload: T[] | ApiListResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function relativeTime(value?: string | null) {
  if (!value) return "Unknown";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "Unknown";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatEnum(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function NavSidebar({
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
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-white/[0.06] bg-[#070D1A]/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-7 py-8">
          <h1 className="font-display text-4xl font-bold tracking-[-0.04em] text-cyan-400">GeoPulse AI</h1>
          <p className="mt-2 font-mono-ui text-[11px] uppercase tracking-[0.28em] text-white/45">
            Tactical Command Center
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item}
              onClick={() => {
                onNavSelect(index);
                onClose();
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
                activeIndex === index
                  ? "bg-emerald-500/12 text-emerald-400 ring-1 ring-emerald-500/20"
                  : "text-white/55 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${activeIndex === index ? "bg-emerald-400" : "bg-white/20"}`} />
              <span className="text-[15px] font-medium">{item}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-white/[0.06] p-4">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-white/50 transition hover:bg-white/[0.04] hover:text-white"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="text-[15px] font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function TopBar({
  onMenuOpen,
  totalReports,
}: {
  onMenuOpen: () => void;
  totalReports: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0A1020]/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={onMenuOpen}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 lg:hidden"
        >
          <MenuIcon />
        </button>

        <div className="hidden items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#4cd7f6]" />
          <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-cyan-400">
            Case Management
          </span>
        </div>

        <div>
          <p className="text-sm text-white/80">Incident Reports</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
        <span className="font-mono-ui text-[10px] uppercase tracking-[0.14em] text-white/45">Open Queue</span>
        <span className="text-sm font-semibold text-cyan-400">{totalReports}</span>
      </div>
    </header>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "critical"
      ? "bg-red-500/15 text-red-400"
      : severity === "high"
        ? "bg-orange-500/15 text-orange-400"
        : severity === "medium"
          ? "bg-amber-500/15 text-amber-400"
          : "bg-cyan-500/15 text-cyan-400";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>
      {severity}
    </span>
  );
}

export default function IncidentReportsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(2);
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token"),
  );
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [sources, setSources] = useState<SourceProfileRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(authToken));
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [severityFilter, setSeverityFilter] = useState<(typeof SEVERITY_OPTIONS)[number]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    const headers = { Authorization: `Token ${authToken}` };

    async function loadData() {
      setLoading(true);
      try {
        const [signalRes, sourceRes, incidentRes] = await Promise.all([
          fetch(`${API_BASE_URL}/signals/`, { headers }),
          fetch(`${API_BASE_URL}/source-profiles/`, { headers }),
          fetch(`${API_BASE_URL}/incidents/`, { headers }),
        ]);

        if (!active) return;

        const [signalData, sourceData, incidentData] = await Promise.all([
          signalRes.json(),
          sourceRes.json(),
          incidentRes.json(),
        ]);

        if (signalRes.ok) setSignals(getList(signalData));
        if (sourceRes.ok) setSources(getList(sourceData));
        if (incidentRes.ok) setIncidents(getList(incidentData));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [authToken]);

  const sourceMap = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );

  const incidentMap = useMemo(
    () => new Map(incidents.map((incident) => [incident.primary_signal, incident])),
    [incidents],
  );

  const filteredSignals = useMemo(() => {
    return signals.filter((signal) => {
      if (statusFilter !== "all" && signal.status !== statusFilter) return false;
      if (severityFilter !== "all" && signal.severity !== severityFilter) return false;
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return (
        signal.title.toLowerCase().includes(query) ||
        signal.description.toLowerCase().includes(query) ||
        signal.location_name.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, severityFilter, signals, statusFilter]);

  const selectedSignal =
    (selectedSignalId
      ? filteredSignals.find((signal) => signal.id === selectedSignalId)
      : null) ??
    filteredSignals[0] ??
    null;

  const duplicateCandidates = useMemo(() => {
    if (!selectedSignal) return [];
    return filteredSignals.filter((signal) => {
      if (signal.id === selectedSignal.id) return false;
      if (signal.category !== selectedSignal.category) return false;
      if (!signal.location_name || !selectedSignal.location_name) return false;
      return signal.location_name === selectedSignal.location_name;
    });
  }, [filteredSignals, selectedSignal]);

  async function runSignalAction(
    signalId: string,
    action: "verify" | "reject" | "escalate" | "merge_duplicate",
    body?: Record<string, string>,
  ) {
    if (!authToken) return;
    setSubmittingAction(action);
    setActionMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/signals/${signalId}/${action}/`, {
        method: "POST",
        headers: {
          Authorization: `Token ${authToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.detail ?? "Action failed.");
      }

      if (action === "merge_duplicate" && payload?.merged_signal) {
        const mergedSignal = payload.merged_signal as SignalRecord;
        setSignals((current) =>
          current.map((signal) => (signal.id === mergedSignal.id ? mergedSignal : signal)),
        );
      } else {
        const updatedSignal = payload as SignalRecord;
        setSignals((current) =>
          current.map((signal) => (signal.id === updatedSignal.id ? updatedSignal : signal)),
        );
      }

      setActionMessage(`${formatEnum(action.replace("_", " "))} completed.`);
      if (action === "merge_duplicate") {
        setMergeTargetId("");
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setSubmittingAction(null);
    }
  }

  function handleLogout() {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(6,182,212,0.04),transparent_50%)]" />

      <NavSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeIndex={activeNav}
        onLogout={handleLogout}
        onNavSelect={(index) => {
          setActiveNav(index);
          if (index === 0) router.push("/dashboard");
          if (index === 1) router.push("/dashboard/live-intelligence");
          if (index === 2) router.push("/dashboard/incident-reports");
        }}
      />

      <div className="lg:ml-72">
        <TopBar onMenuOpen={() => setSidebarOpen(true)} totalReports={filteredSignals.length} />

        <div className="border-b border-white/[0.06] bg-[#08101f]/70 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono-ui text-[10px] uppercase tracking-[0.24em] text-cyan-400">Case Management</p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-white">Investigate and manage incoming reports</h2>
              <p className="mt-1 text-sm text-white/45">
                Review submissions, inspect evidence, verify credibility, escalate threats, and merge duplicates into a clean case queue.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number])}
                className="rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/60"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All statuses" : formatEnum(option)}
                  </option>
                ))}
              </select>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value as (typeof SEVERITY_OPTIONS)[number])}
                className="rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400/60"
              >
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All severities" : formatEnum(option)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title, description, or location"
              className="w-full rounded-2xl border border-white/[0.08] bg-[#0A1020]/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
            />
          </div>
        </div>

        <div className="grid min-h-[calc(100dvh-190px)] grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
          <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03]">
            <div className="border-b border-white/[0.06] px-4 py-4">
              <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-cyan-400">Submitted Reports</p>
              <p className="mt-2 text-sm text-white/45">
                {loading ? "Syncing report queue..." : `${filteredSignals.length} reports in current view`}
              </p>
            </div>

            <div className="max-h-[calc(100dvh-260px)] overflow-y-auto p-3">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, index) => (
                    <div key={index} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
                  ))}
                </div>
              ) : filteredSignals.length > 0 ? (
                <div className="space-y-3">
                  {filteredSignals.map((signal) => {
                    const source = signal.source_profile ? sourceMap.get(signal.source_profile) : null;
                    const linkedIncident = incidentMap.get(signal.id);
                    const isSelected = selectedSignal?.id === signal.id;

                    return (
                      <button
                        key={signal.id}
                        type="button"
                        onClick={() => setSelectedSignalId(signal.id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? "border-cyan-400/40 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(76,215,246,0.18)]"
                            : "border-white/[0.06] bg-[#0A1020]/80 hover:border-white/[0.12]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{signal.title}</p>
                            <p className="mt-1 text-xs text-white/40">{signal.location_name || "Unknown location"}</p>
                          </div>
                          <SeverityBadge severity={signal.severity} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
                          <span>{formatEnum(signal.category)}</span>
                          <span>•</span>
                          <span>{relativeTime(signal.received_at)}</span>
                          <span>•</span>
                          <span>{source?.label ?? "Unknown source"}</span>
                        </div>
                        {linkedIncident ? (
                          <div className="mt-3 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-400">
                            Linked incident: {linkedIncident.title}
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/60 p-6 text-sm text-white/35">
                  No reports match the current filters.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/[0.06] bg-white/[0.03]">
            {selectedSignal ? (
              <div className="grid gap-5 p-5 lg:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
                  <div>
                    <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-cyan-400">Case Detail</p>
                    <h3 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-white">{selectedSignal.title}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">{selectedSignal.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SeverityBadge severity={selectedSignal.severity} />
                    <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/50">
                      {formatEnum(selectedSignal.status)}
                    </span>
                    <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/50">
                      {formatEnum(selectedSignal.confidence)}
                    </span>
                  </div>
                </div>

                {actionMessage ? (
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
                    {actionMessage}
                  </div>
                ) : null}

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {[
                        { label: "Report Source", value: selectedSignal.source_profile ? sourceMap.get(selectedSignal.source_profile)?.label ?? "Unknown source" : "Anonymous / unlinked" },
                        { label: "Submitted", value: new Date(selectedSignal.received_at).toLocaleString() },
                        { label: "Occurred", value: selectedSignal.occurred_at ? new Date(selectedSignal.occurred_at).toLocaleString() : "Not provided" },
                        { label: "Location", value: selectedSignal.location_name || "Unknown location" },
                        { label: "Route Hint", value: selectedSignal.route_hint || "No route hint" },
                        { label: "Linked Incident", value: incidentMap.get(selectedSignal.id)?.title ?? "Not linked yet" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/75 p-4">
                          <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">{item.label}</p>
                          <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/75 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-cyan-400">Evidence & Media</p>
                          <p className="mt-1 text-sm text-white/40">Images, videos, and supporting files attached to the report.</p>
                        </div>
                        <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/50">
                          {selectedSignal.evidence_items.length} items
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {selectedSignal.evidence_items.length > 0 ? (
                          selectedSignal.evidence_items.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{formatEnum(item.evidence_type)}</p>
                                  <p className="mt-1 text-xs text-white/40">{item.caption || "No caption provided."}</p>
                                </div>
                                <span className="text-[11px] text-white/30">
                                  {item.captured_at ? new Date(item.captured_at).toLocaleString() : "Capture time unavailable"}
                                </span>
                              </div>
                              {item.external_url ? (
                                <a
                                  href={item.external_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 transition hover:bg-cyan-500/20"
                                >
                                  Open attachment
                                </a>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.03] p-5 text-sm text-white/35">
                            No media evidence attached to this report yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/75 p-4">
                      <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-emerald-400">Verification Workflow</p>
                      <div className="mt-4 grid gap-2">
                        <button
                          type="button"
                          disabled={submittingAction !== null}
                          onClick={() => runSignalAction(selectedSignal.id, "verify")}
                          className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {submittingAction === "verify" ? "Verifying..." : "Verify"}
                        </button>
                        <button
                          type="button"
                          disabled={submittingAction !== null}
                          onClick={() => runSignalAction(selectedSignal.id, "reject")}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {submittingAction === "reject" ? "Rejecting..." : "Reject"}
                        </button>
                        <button
                          type="button"
                          disabled={submittingAction !== null}
                          onClick={() => runSignalAction(selectedSignal.id, "escalate")}
                          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
                        >
                          {submittingAction === "escalate" ? "Escalating..." : "Escalate"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/75 p-4">
                      <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-fuchsia-400">Merge Duplicates</p>
                      <p className="mt-2 text-sm leading-6 text-white/45">
                        Consolidate duplicate reports into a single case to keep the queue clean and reduce analyst noise.
                      </p>

                      <div className="mt-4 grid gap-3">
                        <select
                          value={mergeTargetId}
                          onChange={(event) => setMergeTargetId(event.target.value)}
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/60"
                        >
                          <option value="">Select a duplicate target</option>
                          {duplicateCandidates.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.title} • {candidate.location_name || "Unknown location"}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={!mergeTargetId || submittingAction !== null}
                          onClick={() =>
                            runSignalAction(selectedSignal.id, "merge_duplicate", {
                              target_signal_id: mergeTargetId,
                            })
                          }
                          className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50"
                        >
                          {submittingAction === "merge_duplicate" ? "Merging..." : "Merge Duplicate"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/75 p-4">
                      <p className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-cyan-400">Source Profile</p>
                      {selectedSignal.source_profile ? (
                        (() => {
                          const source = sourceMap.get(selectedSignal.source_profile);
                          return source ? (
                            <div className="mt-4 space-y-3 text-sm text-white/60">
                              <p><span className="text-white/35">Label:</span> {source.label}</p>
                              <p><span className="text-white/35">Type:</span> {formatEnum(source.source_type)}</p>
                              <p><span className="text-white/35">Reliability:</span> {formatEnum(source.reliability_band)}</p>
                              <p><span className="text-white/35">Trust Score:</span> {source.trust_score}</p>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm text-white/35">Source profile could not be resolved.</p>
                          );
                        })()
                      ) : (
                        <p className="mt-3 text-sm text-white/35">This report has no linked source profile.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center">
                <div>
                  <p className="font-mono-ui text-[10px] uppercase tracking-[0.2em] text-cyan-400">No Report Selected</p>
                  <p className="mt-3 text-lg font-semibold text-white">Pick a report from the queue to start investigating.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
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
