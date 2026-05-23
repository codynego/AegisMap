"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole, getPublicNavItems, type NavItem } from "@/lib/access";

type DemoInsight = {
  title: string;
  value: string;
  tone: string;
  note: string;
};

const DEMO_INSIGHTS: DemoInsight[] = [
  {
    title: "Hotspot confidence",
    value: "78%",
    tone: "bg-cyan-500/10 text-cyan-200 border-cyan-500/20",
    note: "Signals are trending upward around the current area.",
  },
  {
    title: "Route risk",
    value: "High",
    tone: "bg-orange-500/10 text-orange-200 border-orange-500/20",
    note: "Nearby travel corridors need extra review before dispatch.",
  },
  {
    title: "Alert readiness",
    value: "Demo",
    tone: "bg-emerald-500/10 text-emerald-200 border-emerald-500/20",
    note: "This page is a lightweight preview for your explanation later.",
  },
];

const DEMO_TIPS = [
  "Show how prediction cards could summarize local signal patterns.",
  "Use this space later for real AI model outputs or scoring rules.",
  "Keep the layout simple so the demo is easy to narrate live.",
];

export default function AiPredictionsDemoPage() {
  const router = useRouter();
  const role = getCurrentRole();
  const [mounted, setMounted] = useState(false);
  const [navItems, setNavItems] = useState<NavItem[]>(() => getPublicNavItems(getCurrentRole()));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setNavItems(getPublicNavItems(role));
  }, [role]);

  const handleNav = useCallback(
    (index: number) => {
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
              <span className="text-[10px] uppercase tracking-widest text-cyan-300">AI Predictions Demo</span>
            </div>
            <span className="truncate text-sm text-white/45">Placeholder page for the presentation flow</span>
          </div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/60 transition hover:text-cyan-300"
          >
            Back to dashboard
          </button>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            <section className="rounded-3xl border border-cyan-500/15 bg-[#08101F]/90 p-6 sm:p-8">
              <p className="text-[10px] uppercase tracking-widest text-cyan-300">Demo preview</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                AI Prediction Page
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">
                This is a lightweight demo screen for the AI Predictions section. It is intentionally simple so you can
                explain the idea first, then we can wire the real prediction workflow later.
              </p>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {DEMO_INSIGHTS.map((insight) => (
                <article key={insight.title} className={`rounded-2xl border p-5 ${insight.tone}`}>
                  <p className="text-[10px] uppercase tracking-widest opacity-75">{insight.title}</p>
                  <p className="mt-3 text-3xl font-bold text-white">{insight.value}</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">{insight.note}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
              <article className="rounded-3xl border border-white/[0.06] bg-[#0A1020]/80 p-5 sm:p-6">
                <p className="text-[10px] uppercase tracking-widest text-white/35">What this page can become</p>
                <div className="mt-4 space-y-3">
                  {DEMO_TIPS.map((tip) => (
                    <div key={tip} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white/75">
                      {tip}
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-white/[0.06] bg-[#0A1020]/80 p-5 sm:p-6">
                <p className="text-[10px] uppercase tracking-widest text-white/35">Demo state</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Ready for your explanation</h2>
                <p className="mt-3 text-sm leading-6 text-white/60">
                  The real AI rules, charts, and alert scoring can be added after you describe the exact flow you want.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/incident-reports")}
                  className="mt-5 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  Open report flow
                </button>
              </article>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
