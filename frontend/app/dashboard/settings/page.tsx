"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole } from "@/lib/access";

export default function DashboardSettingsPage() {
  const role = getCurrentRole();
  const router = useRouter();

  useEffect(() => {
    if (role !== "analyst" && role !== "admin") {
      window.location.replace("/dashboard");
    }
  }, [role]);

  if (role !== "analyst" && role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(6,182,212,0.05),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(255,82,82,0.04),transparent)]" />

      <DashboardSidebar
        open={false}
        onClose={() => {}}
        activePath="/dashboard/settings"
        onNavigate={(path) => router.push(path)}
        onLogout={() => {
          window.localStorage.removeItem("geopulse.token");
          window.localStorage.removeItem("geopulse.user");
          window.location.assign("/login");
        }}
        role={role}
      />

      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#070D1A]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="text-[10px] uppercase tracking-widest text-cyan-300">Settings</span>
            </div>
            <span className="truncate text-sm text-white/45">Operational configuration</span>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-white/45">
            Internal
          </span>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full space-y-5">
            <div className="rounded-3xl border border-white/[0.06] bg-[#08101F]/90 p-5">
              <p className="text-[10px] uppercase tracking-widest text-white/35">Settings</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Operational settings and configuration</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                Internal tools and configuration live here. This page now uses the same wide dashboard shell as reports and alerts.
              </p>
            </div>

            <div className="rounded-3xl border border-white/[0.06] bg-[#0A1020]/80 p-5 text-sm text-white/55">
              Settings content can be expanded here without changing the layout shell.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
