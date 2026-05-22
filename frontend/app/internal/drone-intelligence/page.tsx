"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/internal" },
  { label: "Live Intelligence", path: "/internal/live-intelligence" },
  { label: "Incident Reports", path: "/internal/incident-reports" },
  { label: "Route Intelligence", path: "/internal/route-intelligence" },
  { label: "AI Predictions", path: "/internal/ai-predictions" },
  { label: "Drone Intelligence", path: "/internal/drone-intelligence" },
];

const STORAGE_KEY = "geopulse.drone-interest-subscribers";

type SubscriberRecord = {
  id: string;
  label: string;
  subscribedAt: string;
};

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
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">Aerial Layer Roadmap</p>
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

function readSubscribers() {
  if (typeof window === "undefined") return [] as SubscriberRecord[];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SubscriberRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSubscribers(subscribers: SubscriberRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribers));
}

function getCurrentOperator() {
  if (typeof window === "undefined") {
    return { id: "unknown-operator", label: "Current operator" };
  }

  try {
    const raw = window.localStorage.getItem("geopulse.user");
    if (!raw) return { id: "current-operator", label: "Current operator" };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const id =
      String(parsed.id ?? parsed.username ?? parsed.email ?? "current-operator");
    const label =
      String(parsed.display_name ?? parsed.username ?? parsed.email ?? "Current operator");
    return { id, label };
  } catch {
    return { id: "current-operator", label: "Current operator" };
  }
}

export default function DroneIntelligencePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNav, setActiveNav] = useState(5);
  const [subscribers, setSubscribers] = useState<SubscriberRecord[]>([]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
      setSubscribers(readSubscribers());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const currentOperator = useMemo(() => getCurrentOperator(), []);
  const hasSubscribed = subscribers.some((subscriber) => subscriber.id === currentOperator.id);

  const handleSubscribe = useCallback(() => {
    if (hasSubscribed) return;
    const nextSubscribers = [
      {
        id: currentOperator.id,
        label: currentOperator.label,
        subscribedAt: new Date().toISOString(),
      },
      ...subscribers,
    ];
    writeSubscribers(nextSubscribers);
    setSubscribers(nextSubscribers);
  }, [currentOperator.id, currentOperator.label, hasSubscribed, subscribers]);

  const handleLogout = useCallback(() => {
    window.localStorage.removeItem("geopulse.token");
    window.localStorage.removeItem("geopulse.user");
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

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_0%_0%,rgba(6,182,212,0.05),transparent)]" />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeIdx={activeNav}
        onNav={handleNav}
        onLogout={handleLogout}
      />

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#060B16]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/70 lg:hidden"
            >
              <MenuIcon />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-400">Drone Intelligence</span>
            </div>
          </div>
          <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/45">
            {subscribers.length} interested operator{subscribers.length === 1 ? "" : "s"}
          </div>
        </header>

        <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
          <section className="rounded-3xl border border-cyan-500/15 bg-[linear-gradient(135deg,rgba(8,15,31,0.92),rgba(8,22,36,0.82))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">Coming Soon</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Drone Intelligence is on the roadmap
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
                  This layer will bring aerial reconnaissance, live drone feeds, route overwatch, and anomaly-assisted
                  observation into the same operating picture. For now, operators can register interest so we can gauge
                  rollout priority and demand.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:min-w-[260px]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Interest Signal</p>
                <p className="mt-2 text-3xl font-bold text-cyan-300">{subscribers.length}</p>
                <p className="mt-1 text-sm text-white/45">operator{subscribers.length === 1 ? "" : "s"} subscribed</p>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={hasSubscribed}
                  className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    hasSubscribed
                      ? "cursor-default border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                      : "bg-cyan-400 text-[#04111f] hover:bg-cyan-300"
                  }`}
                >
                  {hasSubscribed ? "You subscribed to this feature" : "Subscribe to show interest"}
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {[
              {
                title: "Aerial Recon",
                body: "Fast overhead visibility for choke points, forest edges, and route approaches where ground reporting is weak.",
              },
              {
                title: "Live Feed Fusion",
                body: "Drone observations will plug into the same incident, route, and prediction layers instead of living in a separate tool.",
              },
              {
                title: "Tasking Workflow",
                body: "Operators will be able to request coverage, assign patrol support, and escalate suspicious aerial findings into the reporting pipeline.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-5">
                <p className="text-lg font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.body}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">Planned Capabilities</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  "Live drone feed tiles",
                  "Drone patrol activity overlay",
                  "Auto-flagged aerial anomalies",
                  "Route overwatch snapshots",
                  "Safe corridor verification passes",
                  "Mission queue and launch status",
                ].map((item) => (
                  <div key={item} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white/65">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Recent Subscribers</p>
              <div className="mt-4 space-y-3">
                {subscribers.length > 0 ? (
                  subscribers.slice(0, 6).map((subscriber) => (
                    <div key={subscriber.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                      <p className="text-sm font-semibold text-white">{subscriber.label}</p>
                      <p className="mt-1 text-[11px] text-white/40">
                        Subscribed {new Date(subscriber.subscribedAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center text-sm text-white/35">
                    No interest signals yet. Be the first operator to subscribe.
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
