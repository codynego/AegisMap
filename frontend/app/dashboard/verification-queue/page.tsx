"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentRole, getDefaultRouteForRole, getPublicNavItems, isTrustedReporterRole, type NavItem } from "@/lib/access";

type SignalRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: string;
  severity: string;
  location_name: string;
  latitude: number | string | null;
  longitude: number | string | null;
  created_at: string;
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
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function VerificationQueuePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [navItems, setNavItems] = useState<NavItem[]>(() => getPublicNavItems("trusted_verifier"));
  const role = getCurrentRole();
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token"),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isTrustedReporterRole(role)) {
      window.location.replace(getDefaultRouteForRole(role));
      return;
    }
    setNavItems(getPublicNavItems(role));
  }, [mounted, role]);

  useEffect(() => {
    if (!authToken || !isTrustedReporterRole(role)) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/signals/?verification_queue=true`, {
          headers: { Authorization: `Token ${authToken}` },
        });
        if (!response.ok || !active) return;
        const payload = await response.json();
        if (!active) return;
        setSignals(getList(payload));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authToken, role]);

  const handleVote = useCallback(
    async (signalId: string, response: "confirm" | "deny" | "unsure") => {
      if (!authToken) return;
      setSubmittingId(signalId);
      try {
        await fetch(`${API_BASE_URL}/signals/${signalId}/submit_verification/`, {
          method: "POST",
          headers: {
            Authorization: `Token ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ response }),
        });
        setSignals((current) => current.filter((signal) => signal.id !== signalId));
      } finally {
        setSubmittingId(null);
      }
    },
    [authToken],
  );

  const activeIndex = useMemo(
    () => navItems.findIndex((item) => item.path === "/dashboard/verification-queue"),
    [navItems],
  );

  if (!mounted || !isTrustedReporterRole(role)) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden h-screen w-64 flex-col border-r border-white/[0.06] bg-[#070D1A]/98 px-3 py-6 lg:flex">
          <div className="px-3 pb-6">
            <h1 className="text-xl font-bold tracking-tight text-cyan-400">GeoPulse AI</h1>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">Trusted Reporter Network</p>
          </div>
          <nav className="flex-1 space-y-1">
            {navItems.map((item, index) => (
              <button
                key={item.path}
                type="button"
                onClick={() => router.push(item.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  index === activeIndex
                    ? "bg-cyan-500/10 text-cyan-300"
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${index === activeIndex ? "bg-cyan-400" : "bg-white/15"}`} />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-5">
            <div className="rounded-3xl border border-emerald-500/20 bg-[#08101F]/90 p-5">
              <p className="text-[10px] uppercase tracking-widest text-emerald-300">Verification queue</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Help confirm nearby community reports</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                Trusted reporters help strengthen weighted consensus. Your confirmations carry more influence than a standard public vote,
                but they still do not replace analyst review for sensitive incidents.
              </p>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-5 text-sm text-white/45">
                Loading reports needing confirmation...
              </div>
            ) : null}

            {!loading && signals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0A1020]/80 p-5 text-sm text-white/35">
                No nearby unconfirmed reports are waiting in your queue right now.
              </div>
            ) : null}

            <div className="space-y-4">
              {signals.map((signal) => (
                <article key={signal.id} className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/35">
                        {signal.confidence} confidence · {signal.severity} severity
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-white">{signal.title}</h2>
                    </div>
                    <span className="text-xs text-white/40">{relativeTime(signal.created_at)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/75">{signal.description}</p>
                  <p className="mt-2 text-xs text-white/45">{signal.location_name || "Mapped location pending label"}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={submittingId === signal.id}
                      onClick={() => void handleVote(signal.id, "confirm")}
                      className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-emerald-200"
                    >
                      Yes, true
                    </button>
                    <button
                      type="button"
                      disabled={submittingId === signal.id}
                      onClick={() => void handleVote(signal.id, "deny")}
                      className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-red-200"
                    >
                      No, false
                    </button>
                    <button
                      type="button"
                      disabled={submittingId === signal.id}
                      onClick={() => void handleVote(signal.id, "unsure")}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white/70"
                    >
                      Not sure
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
