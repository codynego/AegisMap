"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatReportType } from "@/lib/report-types";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type ApiListResponse<T> = { results?: T[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "⬡", path: "/internal" },
  { label: "Live Intelligence", icon: "◎", path: "/internal/live-intelligence" },
  { label: "Incident Reports", icon: "◈", path: "/internal/incident-reports" },
  { label: "Route Intelligence", icon: "◍", path: "/internal/route-intelligence" },
  { label: "AI Predictions", icon: "◈", path: "/internal/ai-predictions" },
  { label: "Drone Intelligence", icon: "◉", path: "/internal/drone-intelligence" },
];

const STATUS_OPTIONS = ["all", "raw", "triaged", "clustered", "escalated", "dismissed"] as const;
const SEVERITY_OPTIONS = ["all", "critical", "high", "medium", "low"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === "critical" ? "bg-red-400 shadow-[0_0_8px_#f87171]" :
    severity === "high"     ? "bg-orange-400 shadow-[0_0_8px_#fb923c]" :
    severity === "medium"   ? "bg-amber-400 shadow-[0_0_8px_#fbbf24]" :
                              "bg-cyan-400 shadow-[0_0_8px_#4cd7f6]";
  return <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${color}`} />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "critical" ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/20" :
    severity === "high"     ? "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20" :
    severity === "medium"   ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20" :
                              "bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/20";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${tone}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "escalated"  ? "bg-amber-500/15 text-amber-400" :
    status === "dismissed"  ? "bg-white/10 text-white/35" :
    status === "triaged"    ? "bg-fuchsia-500/15 text-fuchsia-400" :
    status === "clustered"  ? "bg-emerald-500/15 text-emerald-400" :
                              "bg-white/[0.06] text-white/50";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${tone}`}>
      {formatEnum(status)}
    </span>
  );
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
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/[0.06] bg-[#070D1A] transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="border-b border-white/[0.06] px-6 py-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400 text-lg">⬡</span>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-cyan-400 leading-none">GeoPulse AI</h1>
              <p className="mt-0.5 font-mono-ui text-[9px] uppercase tracking-[0.22em] text-white/35">Tactical Command</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <p className="mb-2 px-3 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-white/25">Navigation</p>
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item.label}
              onClick={() => { onNavSelect(index); onClose(); }}
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
              {activeIndex === index && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#4cd7f6]" />
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-white/[0.06] p-3">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/35 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <span className="text-base leading-none">⏻</span>
            <span className="text-[13px] font-medium">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function TopBar({
  onMenuOpen,
  totalReports,
  loading,
}: {
  onMenuOpen: () => void;
  totalReports: number;
  loading: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#070D1A]/90 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label="Open navigation"
          onClick={onMenuOpen}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 transition hover:bg-white/[0.07] hover:text-white lg:hidden"
        >
          <MenuIcon />
        </button>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-2.5 py-1 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-emerald-400 shadow-[0_0_6px_#34d399]"}`} />
            <span className="font-mono-ui text-[9px] uppercase tracking-[0.18em] text-cyan-400">
              {loading ? "Syncing..." : "Live"}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-white/80">Incident Reports</h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
          <span className="font-mono-ui text-[9px] uppercase tracking-[0.14em] text-white/35">Queue</span>
          <span className="text-sm font-bold tabular-nums text-cyan-400">{totalReports}</span>
        </div>
      </div>
    </header>
  );
}

// ─── Signal List Item ─────────────────────────────────────────────────────────

function SignalListItem({
  signal,
  source,
  incident,
  isSelected,
  onClick,
}: {
  signal: SignalRecord;
  source: SourceProfileRecord | undefined;
  incident: IncidentRecord | undefined;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-2xl border p-4 text-left transition-all duration-150 ${
        isSelected
          ? "border-cyan-400/30 bg-cyan-500/8 shadow-[0_0_0_1px_rgba(76,215,246,0.15),inset_0_1px_0_rgba(76,215,246,0.08)]"
          : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0">
          <SeverityDot severity={signal.severity} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold leading-snug transition-colors ${isSelected ? "text-white" : "text-white/80 group-hover:text-white"}`}>
              {signal.title}
            </p>
            <SeverityBadge severity={signal.severity} />
          </div>

          <p className="mt-1 truncate text-xs text-white/35">
            {signal.location_name || "Unknown location"}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge status={signal.status} />
            <span className="text-[11px] text-white/25">{formatReportType(signal.category)}</span>
            <span className="text-[11px] text-white/20">•</span>
            <span className="text-[11px] text-white/25">{relativeTime(signal.received_at)}</span>
          </div>

          {incident && (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/8 px-2 py-1">
              <span className="text-[9px] text-emerald-400">◈</span>
              <span className="truncate text-[10px] font-medium text-emerald-400">{incident.title}</span>
            </div>
          )}

          {source && (
            <p className="mt-1.5 text-[11px] text-white/25">{source.label}</p>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailMetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">{label}</p>
      <p className="mt-1.5 text-sm font-medium leading-snug text-white/80">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  loadingLabel,
  isLoading,
  disabled,
  colorClass,
  onClick,
}: {
  label: string;
  loadingLabel: string;
  isLoading: boolean;
  disabled: boolean;
  colorClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${colorClass}`}
    >
      {isLoading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
      )}
      {isLoading ? loadingLabel : label}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IncidentReportsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(2);
  // Mobile: "list" or "detail"
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
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
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [activeDetailTab, setActiveDetailTab] = useState<"overview" | "evidence" | "actions">("overview");

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
    return () => { active = false; };
  }, [authToken]);

  const sourceMap = useMemo(
    () => new Map(sources.map((s) => [s.id, s])),
    [sources],
  );

  const incidentMap = useMemo(
    () => new Map(incidents.map((i) => [i.primary_signal, i])),
    [incidents],
  );

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (severityFilter !== "all" && s.severity !== severityFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.location_name.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, severityFilter, signals, statusFilter]);

  const selectedSignal =
    (selectedSignalId
      ? filteredSignals.find((s) => s.id === selectedSignalId)
      : null) ??
    filteredSignals[0] ??
    null;

  const duplicateCandidates = useMemo(() => {
    if (!selectedSignal) return [];
    return filteredSignals.filter(
      (s) =>
        s.id !== selectedSignal.id &&
        s.category === selectedSignal.category &&
        s.location_name &&
        s.location_name === selectedSignal.location_name,
    );
  }, [filteredSignals, selectedSignal]);

  // Dismiss action message after 4s
  useEffect(() => {
    if (!actionMessage) return;
    const t = setTimeout(() => setActionMessage(null), 4000);
    return () => clearTimeout(t);
  }, [actionMessage]);

  async function runSignalAction(
    signalId: string,
    action: "verify" | "reject" | "escalate" | "merge_duplicate",
    body?: Record<string, string>,
  ) {
    if (!authToken) return;
    setSubmittingAction(action);
    setActionMessage(null);
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
      if (!response.ok) throw new Error(payload?.detail ?? "Action failed.");

      if (action === "merge_duplicate" && payload?.merged_signal) {
        const m = payload.merged_signal as SignalRecord;
        setSignals((cur) => cur.map((s) => (s.id === m.id ? m : s)));
      } else {
        const u = payload as SignalRecord;
        setSignals((cur) => cur.map((s) => (s.id === u.id ? u : s)));
      }

      setActionMessage({ text: `${formatEnum(action.replace("_", " "))} completed successfully.`, type: "success" });
      if (action === "merge_duplicate") setMergeTargetId("");
    } catch (error) {
      setActionMessage({ text: error instanceof Error ? error.message : "Action failed.", type: "error" });
    } finally {
      setSubmittingAction(null);
    }
  }

  function handleSelectSignal(id: string) {
    setSelectedSignalId(id);
    setActiveDetailTab("overview");
    setActionMessage(null);
    setMergeTargetId("");
    setMobileView("detail");
  }

  function handleLogout() {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }

  function handleNavSelect(index: number) {
    setActiveNav(index);
    const path = NAV_ITEMS[index]?.path;
    if (path) router.push(path);
  }

  const selectedSource = selectedSignal?.source_profile
    ? sourceMap.get(selectedSignal.source_profile)
    : null;
  const linkedIncident = selectedSignal ? incidentMap.get(selectedSignal.id) : null;

  // ── Severity counts ──────────────────────────────────────────────────────────
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const s of filteredSignals) {
      if (s.severity in counts) counts[s.severity as keyof typeof counts]++;
    }
    return counts;
  }, [filteredSignals]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      {/* ambient bg */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_20%_0%,rgba(6,182,212,0.05),transparent)]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_40%_30%_at_80%_100%,rgba(139,92,246,0.04),transparent)]" />

      <NavSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeIndex={activeNav}
        onLogout={handleLogout}
        onNavSelect={handleNavSelect}
      />

      <div className="lg:ml-64">
        <TopBar
          onMenuOpen={() => setSidebarOpen(true)}
          totalReports={filteredSignals.length}
          loading={loading}
        />

        {/* Page Header */}
        <div className="border-b border-white/[0.06] bg-[#08101f]/60 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono-ui text-[9px] uppercase tracking-[0.26em] text-cyan-400">Case Management</p>
              <h2 className="mt-1.5 text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
                Investigate &amp; Manage Reports
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/40">
                Review submissions, inspect evidence, verify credibility, escalate threats, and merge duplicates.
              </p>
            </div>

            {/* Severity summary chips */}
            <div className="flex flex-wrap gap-2">
              {(["critical", "high", "medium", "low"] as const).map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSeverityFilter(sev === severityFilter ? "all" : sev)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                    severityFilter === sev
                      ? sev === "critical" ? "border-red-400/40 bg-red-500/20 text-red-300"
                        : sev === "high"   ? "border-orange-400/40 bg-orange-500/20 text-orange-300"
                        : sev === "medium" ? "border-amber-400/40 bg-amber-500/20 text-amber-300"
                        :                   "border-cyan-400/40 bg-cyan-500/20 text-cyan-300"
                      : "border-white/[0.06] bg-white/[0.03] text-white/40 hover:border-white/[0.12]"
                  }`}
                >
                  <SeverityDot severity={sev} />
                  {sev} <span className="opacity-60">({severityCounts[sev]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Filters row */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 text-sm">⌕</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, description, or location…"
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 pl-9 pr-4 text-sm text-white placeholder-white/25 outline-none transition focus:border-cyan-400/50 focus:bg-[#0A1020]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof STATUS_OPTIONS[number])}
                className="h-10 rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o === "all" ? "All Statuses" : formatEnum(o)}</option>
                ))}
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as typeof SEVERITY_OPTIONS[number])}
                className="h-10 rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
              >
                {SEVERITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o === "all" ? "All Severities" : formatEnum(o)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Main content grid */}
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">

            {/* ── Signal List (hidden on mobile when viewing detail) ── */}
            <section
              className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] ${
                mobileView === "detail" ? "hidden lg:flex lg:flex-col" : "flex flex-col"
              }`}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div>
                  <p className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-cyan-400">Report Queue</p>
                  <p className="mt-0.5 text-xs text-white/35">
                    {loading ? "Loading…" : `${filteredSignals.length} report${filteredSignals.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                {(statusFilter !== "all" || severityFilter !== "all" || searchQuery) && (
                  <button
                    onClick={() => { setStatusFilter("all"); setSeverityFilter("all"); setSearchQuery(""); }}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/40 transition hover:text-white/70"
                  >
                    Clear filters
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-3" style={{ maxHeight: "calc(100dvh - 340px)" }}>
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
                    ))}
                  </div>
                ) : filteredSignals.length > 0 ? (
                  <div className="space-y-2">
                    {filteredSignals.map((signal) => (
                      <SignalListItem
                        key={signal.id}
                        signal={signal}
                        source={signal.source_profile ? sourceMap.get(signal.source_profile) : undefined}
                        incident={incidentMap.get(signal.id)}
                        isSelected={selectedSignal?.id === signal.id}
                        onClick={() => handleSelectSignal(signal.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.06] text-center">
                    <span className="text-2xl opacity-30">◈</span>
                    <p className="text-sm text-white/30">No reports match your filters.</p>
                  </div>
                )}
              </div>
            </section>

            {/* ── Detail Panel ── */}
            <section
              className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] ${
                mobileView === "list" ? "hidden lg:block" : "block"
              }`}
            >
              {selectedSignal ? (
                <div className="flex h-full flex-col">
                  {/* Detail header */}
                  <div className="border-b border-white/[0.06] p-5">
                    {/* Mobile back button */}
                    <button
                      onClick={() => setMobileView("list")}
                      className="mb-3 flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70 lg:hidden"
                    >
                      ← Back to queue
                    </button>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-cyan-400">Case Detail</p>
                          <span className="font-mono-ui text-[9px] text-white/20">#{selectedSignal.id.slice(0, 8)}</span>
                        </div>
                        <h3 className="mt-1.5 text-xl font-bold leading-snug tracking-[-0.02em] text-white sm:text-2xl">
                          {selectedSignal.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-white/45">
                          {selectedSignal.description}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap gap-1.5">
                        <SeverityBadge severity={selectedSignal.severity} />
                        <StatusBadge status={selectedSignal.status} />
                        <span className="rounded-full border border-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/35">
                          {formatEnum(selectedSignal.confidence)}
                        </span>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="mt-4 flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
                      {(["overview", "evidence", "actions"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveDetailTab(tab)}
                          className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all ${
                            activeDetailTab === tab
                              ? "bg-cyan-500/15 text-cyan-300 shadow-sm"
                              : "text-white/35 hover:text-white/60"
                          }`}
                        >
                          {tab}
                          {tab === "evidence" && selectedSignal.evidence_items.length > 0 && (
                            <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px]">
                              {selectedSignal.evidence_items.length}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action message toast */}
                  {actionMessage && (
                    <div className={`mx-5 mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
                      actionMessage.type === "success"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/20 bg-red-500/10 text-red-300"
                    }`}>
                      <span>{actionMessage.type === "success" ? "✓" : "✕"}</span>
                      <span>{actionMessage.text}</span>
                      <button onClick={() => setActionMessage(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
                    </div>
                  )}

                  {/* Tab content */}
                  <div className="flex-1 overflow-y-auto p-5">

                    {/* ── Overview tab ── */}
                    {activeDetailTab === "overview" && (
                      <div className="space-y-5">
                        <div>
                          <p className="mb-3 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-white/30">Report Details</p>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            <DetailMetaCard label="Report Source" value={selectedSource?.label ?? "Anonymous / unlinked"} />
                            <DetailMetaCard label="Submitted" value={new Date(selectedSignal.received_at).toLocaleString()} />
                            <DetailMetaCard label="Occurred" value={selectedSignal.occurred_at ? new Date(selectedSignal.occurred_at).toLocaleString() : "Not provided"} />
                            <DetailMetaCard label="Location" value={selectedSignal.location_name || "Unknown location"} />
                            <DetailMetaCard label="Route Hint" value={selectedSignal.route_hint || "No route hint"} />
                            <DetailMetaCard label="Linked Incident" value={linkedIncident?.title ?? "Not linked yet"} />
                          </div>
                        </div>

                        {/* Source profile */}
                        {selectedSource ? (
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                            <p className="mb-3 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-cyan-400">Source Profile</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {[
                                { label: "Label", value: selectedSource.label },
                                { label: "Type", value: formatEnum(selectedSource.source_type) },
                                { label: "Reliability Band", value: formatEnum(selectedSource.reliability_band) },
                                { label: "Trust Score", value: String(selectedSource.trust_score) },
                              ].map((item) => (
                                <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                                  <span className="text-[11px] text-white/35">{item.label}</span>
                                  <span className="text-[11px] font-medium text-white/75">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/[0.06] p-4 text-sm text-white/25">
                            No source profile linked to this report.
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Evidence tab ── */}
                    {activeDetailTab === "evidence" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-mono-ui text-[9px] uppercase tracking-[0.2em] text-cyan-400">Evidence &amp; Media</p>
                          <span className="rounded-full border border-white/[0.06] px-2 py-0.5 text-[10px] text-white/35">
                            {selectedSignal.evidence_items.length} item{selectedSignal.evidence_items.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {selectedSignal.evidence_items.length > 0 ? (
                          selectedSignal.evidence_items.map((item) => (
                            <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{formatEnum(item.evidence_type)}</p>
                                  <p className="mt-1 text-xs leading-relaxed text-white/40">
                                    {item.caption || "No caption provided."}
                                  </p>
                                </div>
                                <span className="text-[10px] text-white/25">
                                  {item.captured_at ? new Date(item.captured_at).toLocaleString() : "No timestamp"}
                                </span>
                              </div>
                              {item.external_url && (
                                <a
                                  href={item.external_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 transition hover:bg-cyan-500/20"
                                >
                                  Open attachment ↗
                                </a>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.06] text-center">
                            <span className="text-xl opacity-25">◎</span>
                            <p className="text-sm text-white/30">No evidence attached yet.</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Actions tab ── */}
                    {activeDetailTab === "actions" && (
                      <div className="space-y-5">

                        {/* Verification workflow */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                          <p className="mb-1 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-emerald-400">Verification Workflow</p>
                          <p className="mb-4 text-xs text-white/35">Update this report&apos;s disposition to reflect your review decision.</p>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <ActionButton
                              label="✓ Verify"
                              loadingLabel="Verifying…"
                              isLoading={submittingAction === "verify"}
                              disabled={submittingAction !== null}
                              colorClass="border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              onClick={() => runSignalAction(selectedSignal.id, "verify")}
                            />
                            <ActionButton
                              label="✕ Reject"
                              loadingLabel="Rejecting…"
                              isLoading={submittingAction === "reject"}
                              disabled={submittingAction !== null}
                              colorClass="border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                              onClick={() => runSignalAction(selectedSignal.id, "reject")}
                            />
                            <ActionButton
                              label="⬆ Escalate"
                              loadingLabel="Escalating…"
                              isLoading={submittingAction === "escalate"}
                              disabled={submittingAction !== null}
                              colorClass="border border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                              onClick={() => runSignalAction(selectedSignal.id, "escalate")}
                            />
                          </div>
                        </div>

                        {/* Merge duplicates */}
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                          <p className="mb-1 font-mono-ui text-[9px] uppercase tracking-[0.2em] text-fuchsia-400">Merge Duplicates</p>
                          <p className="mb-4 text-xs leading-relaxed text-white/35">
                            Consolidate duplicate reports into a single case to reduce queue noise and analyst fatigue.
                          </p>

                          {duplicateCandidates.length > 0 ? (
                            <div className="space-y-3">
                              <select
                                value={mergeTargetId}
                                onChange={(e) => setMergeTargetId(e.target.value)}
                                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0A1020]/80 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
                              >
                                <option value="">Select a duplicate to merge into…</option>
                                {duplicateCandidates.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.title} · {c.location_name || "Unknown"}
                                  </option>
                                ))}
                              </select>
                              <ActionButton
                                label="Merge Duplicate"
                                loadingLabel="Merging…"
                                isLoading={submittingAction === "merge_duplicate"}
                                disabled={!mergeTargetId || submittingAction !== null}
                                colorClass="border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20"
                                onClick={() =>
                                  runSignalAction(selectedSignal.id, "merge_duplicate", {
                                    target_signal_id: mergeTargetId,
                                  })
                                }
                              />
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-white/[0.06] p-4 text-sm text-white/30">
                              No potential duplicates found for this report.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-96 flex-col items-center justify-center gap-3 p-8 text-center">
                  <span className="text-4xl opacity-20">◈</span>
                  <p className="font-mono-ui text-[9px] uppercase tracking-[0.22em] text-cyan-400">No Report Selected</p>
                  <p className="max-w-xs text-sm text-white/40">
                    Choose a report from the queue on the left to begin investigating.
                  </p>
                </div>
              )}
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
