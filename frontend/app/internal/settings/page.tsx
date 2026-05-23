"use client";

import { useMemo } from "react";

import { INTERNAL_NAV_ITEMS } from "@/lib/access";

export default function InternalSettingsPage() {
  const links = useMemo(
    () => INTERNAL_NAV_ITEMS.filter((item) => item.path !== "/internal/settings"),
    [],
  );

  return (
    <div className="min-h-screen bg-[#060B16] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-3xl border border-white/[0.06] bg-[#08101F]/90 p-5">
          <p className="text-[10px] uppercase tracking-widest text-cyan-300">Operational settings</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Admin controls and governance</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
            Settings is reserved for analyst and admin users. This area is intended for user management, alert configuration,
            audit-aware overrides, and operational policies. Silent deletion and unlogged history edits remain disallowed.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/35">Role governance</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Promote reliable contributors to trusted reporters, manage analyst access, and keep all role changes auditable.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/35">Alert policy</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Adjust watch-zone thresholds, sensitive-report safeguards, and consensus requirements without bypassing audit logs.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/80 p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/35">Operational shortcuts</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {links.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/70 transition hover:bg-white/[0.05] hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
