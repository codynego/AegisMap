"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole, getPublicNavItems, isTrustedReporterRole, type NavItem } from "@/lib/access";

type AlertRecord = {
  id: number;
  severity: string;
  status: string;
  title: string;
  message: string;
  triggered_at: string;
};

type ApiListResponse<T> = {
  results?: T[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

function getList<T>(payload: T[] | ApiListResponse<T>) {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function relativeTime(value?: string | null) {
  if (!value) return "Now";
  const then = new Date(value).getTime();
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function severityTone(severity: string) {
  if (severity === "critical") return "border-red-500/25 bg-red-500/10 text-red-200";
  if (severity === "high") return "border-orange-500/25 bg-orange-500/10 text-orange-200";
  return "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";
}

function Sidebar({
  navItems,
  activeIndex,
  onNav,
  onLogout,
}: {
  navItems: NavItem[];
  activeIndex: number;
  onNav: (index: number) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="hidden h-screen w-64 flex-col border-r border-white/[0.06] bg-[#070D1A]/98 px-3 py-6 lg:flex">
      <div className="px-3 pb-6">
        <h1 className="text-xl font-bold tracking-tight text-cyan-400">GeoPulse AI</h1>
        <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">Community Safety</p>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map((item, index) => (
          <button
            key={item.path}
            type="button"
            onClick={() => onNav(index)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
              activeIndex === index
                ? "bg-cyan-500/10 text-cyan-300"
                : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${activeIndex === index ? "bg-cyan-400" : "bg-white/15"}`} />
            {item.label}
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={onLogout}
        className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/40 transition hover:bg-white/[0.04] hover:text-white/70"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
        Sign out
      </button>
    </aside>
  );
}

export default function AlertsPage() {
  const role = getCurrentRole();

  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [navItems, setNavItems] = useState<NavItem[]>(() => getPublicNavItems(getCurrentRole()));
  const [activeIndex, setActiveIndex] = useState(4);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token"),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setNavItems(getPublicNavItems(role));
  }, [role]);

  useEffect(() => {
    if (!authToken) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/alerts/`, {
          headers: { Authorization: `Token ${authToken}` },
        });
        if (!response.ok || !active) return;
        const payload = await response.json();
        if (!active) return;
        setAlerts(getList(payload));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authToken]);

  const openAlerts = useMemo(
    () => alerts.filter((alert) => alert.status === "open" || alert.status === "acknowledged"),
    [alerts],
  );

  const handleNav = useCallback(
    (index: number) => {
      setActiveIndex(index);
      const next = navItems[index];
      if (next) {
        router.push(next.path);
      }
    },
    [navItems, router],
  );

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
    window.location.assign("/login");
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(6,182,212,0.05),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(255,82,82,0.04),transparent)]" />

      <DashboardSidebar
        open={false}
        onClose={() => {}}
        activePath="/dashboard/ai-predictions"
        onNavigate={(path) => router.push(path)}
        onLogout={handleLogout}
        role={role}
      />

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#070D1A]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-300">AI Predictions</span>
            </div>
            <span className="truncate text-sm text-white/45">Incident forecasting and verified alerts</span>
          </div>
          {isTrustedReporterRole(role) ? (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
              Trusted reporter
            </span>
          ) : null}
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full space-y-5">
            <div className="rounded-3xl border border-cyan-500/15 bg-[#08101F]/90 p-5">
              <p className="text-[10px] uppercase tracking-widest text-cyan-300">Verified alerts</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Safety alerts near active communities</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                This feed shows verified or operationally approved alerts for community users. It does not expose low-confidence
                intelligence, raw reports, or internal forecasting tools.
              </p>
              {isTrustedReporterRole(role) ? (
                <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4 text-sm text-emerald-100">
                  Trusted reporter tools are active. Use the Verification Queue tab when you want to help confirm nearby reports.
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/35">Open alerts</p>
                <p className="mt-2 text-3xl font-bold text-white">{openAlerts.length}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/35">Critical alerts</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {alerts.filter((alert) => alert.severity === "critical").length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                <p className="text-[10px] uppercase tracking-widest text-white/35">Resolved today</p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {alerts.filter((alert) => alert.status === "resolved").length}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-5 text-sm text-white/45">
                  Loading verified alerts...
                </div>
              ) : null}

              {!loading && alerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/80 p-5 text-sm text-white/35">
                  No verified alerts are active right now.
                </div>
              ) : null}

              {alerts.map((alert) => (
                <article
                  key={alert.id}
                  className={`rounded-2xl border p-4 ${severityTone(alert.severity)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest opacity-75">
                        {alert.severity} · {alert.status}
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-white">{alert.title}</h2>
                    </div>
                    <span className="text-xs text-white/60">{relativeTime(alert.triggered_at)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/80">{alert.message}</p>
                </article>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
