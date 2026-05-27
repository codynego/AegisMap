"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole } from "@/lib/access";

export default function DashboardDroneRedirectPage() {
  const role = getCurrentRole();

  const FEATURE_KEY = "feature_feedback";
  const FEATURE_ID = "drone_intelligence";
  const [votes, setVotes] = useState<number>(0);
  const [voted, setVoted] = useState<boolean>(false);
  const [featurePk, setFeaturePk] = useState<number | null>(null);
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(FEATURE_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : {};
      const currentVotes = parsed.votes?.[FEATURE_ID] ?? 0;
      const hasVoted = parsed.voted?.[FEATURE_ID] ?? false;
      setVotes(Number(currentVotes || 0));
      setVoted(Boolean(hasVoted));
    } catch (e) {
      setVotes(0);
      setVoted(false);
    }
  }, []);

  // Ensure feature request exists on the backend and load server-side vote count
  useEffect(() => {
    let mounted = true;
    async function ensureFeature() {
      try {
        const resp = await fetch(`${API_BASE_URL}/feature-requests/`);
        if (!resp.ok) throw new Error("Failed to fetch features");
        const items = await resp.json();
        const found = Array.isArray(items) ? items.find((it: any) => it.feature_id === FEATURE_ID) : null;
        if (found) {
          if (!mounted) return;
          setFeaturePk(found.id);
          setVotes(Number(found.votes ?? 0));
        } else {
          // create
          const createResp = await fetch(`${API_BASE_URL}/feature-requests/`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ feature_id: FEATURE_ID, title: "Drone Intelligence", description: "Live drone feeds and overlays" }),
          });
          if (!createResp.ok) throw new Error("Failed to create feature request");
          const created = await createResp.json();
          if (!mounted) return;
          setFeaturePk(created.id);
          setVotes(Number(created.votes ?? 0));
        }
      } catch (e) {
        // ignore — fallback to client-side only
      }
    }
    ensureFeature();
    return () => {
      mounted = false;
    };
  }, [API_BASE_URL]);

  function handleVote() {
    if (voted) return;
    const nextVotes = votes + 1;
    setVotes(nextVotes);
    setVoted(true);
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(FEATURE_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : { votes: {}, voted: {} };
      parsed.votes = parsed.votes || {};
      parsed.voted = parsed.voted || {};
      parsed.votes[FEATURE_ID] = nextVotes;
      parsed.voted[FEATURE_ID] = true;
      if (typeof window !== "undefined") window.localStorage.setItem(FEATURE_KEY, JSON.stringify(parsed));
    } catch (e) {
      // ignore
    }

    // Persist to backend if feature exists
    (async () => {
      try {
        if (!featurePk) return;
        const token = typeof window !== "undefined" ? window.localStorage.getItem("geopulse.token") : null;
        const resp = await fetch(`${API_BASE_URL}/feature-requests/${featurePk}/vote/`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { Authorization: `Token ${token}` } : {}),
          },
        });
        if (!resp.ok) throw new Error("Vote failed");
        const body = await resp.json();
        setVotes(Number(body.votes ?? nextVotes));
      } catch (e) {
        // ignore server error — vote already updated locally
      }
    })();
  }

  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (role !== "analyst" && role !== "admin") {
      window.location.replace("/dashboard/profile");
    }
  }, [role]);

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("geopulse.token");
      window.localStorage.removeItem("geopulse.user");
      window.location.assign("/login");
    }
  }

  if (role === "analyst" || role === "admin") {
    return (
      <>
        <DashboardSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activePath="/dashboard/drone-intelligence"
          onNavigate={(path) => router.push(path)}
          onLogout={handleLogout}
          role={role}
        />

        <div className="relative z-10 lg:ml-64">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#070D1A]/95 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white transition"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold">Drone Intelligence</h1>
                <p className="text-[11px] text-white/40">Operational drone feeds and overlays for analysts.</p>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/50 transition hover:text-cyan-300 hover:border-cyan-500/20"
              >
                ← Back
              </button>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 lg:px-8 flex items-center justify-center min-h-[calc(100vh-56px)]">
            <div className="rounded-2xl border border-white/[0.06] bg-[#07121C]/80 p-6 max-w-4xl w-full mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Live Drone Feeds</p>
                  <p className="mt-1 text-xs text-white/50">Feature coming soon — real-time drone overlays and analyst controls.</p>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={handleVote}
                    disabled={voted}
                    className={`rounded-md px-3 py-1.5 font-semibold transition ${voted ? "bg-white/[0.06] text-white/40 border border-white/[0.04]" : "bg-cyan-500 text-black"}`}
                  >
                    {voted ? "Voted ✓" : "Vote for this feature"}
                  </button>
                  <div className="mt-2 text-[12px] text-white/50">Votes: <span className="font-semibold text-white">{votes}</span></div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </>
    );
  }

  return null;
}
