"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole } from "@/lib/access";

type ManagedIncident = {
  id: number | string;
  title: string;
  incident_type: string;
  confidence: string;
  confidence_score?: number | null;
  status: string;
  location_name?: string;
  detected_at?: string;
  signal_count?: number;
  hidden_from_map?: boolean;
  visibility_score?: number;
};

export default function IncidentManagementPage() {
  const router = useRouter();
  const role = getCurrentRole();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [incidents, setIncidents] = useState<ManagedIncident[]>([]);
  const [stateFilter, setStateFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token"),
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const load = async () => {
      const url = new URL(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/incidents/`,
      );
      url.searchParams.set("include_hidden", "true");
      if (stateFilter) url.searchParams.set("state", stateFilter);
      if (locationFilter) url.searchParams.set("location", locationFilter);
      if (dateFrom) url.searchParams.set("date_from", dateFrom);
      if (dateTo) url.searchParams.set("date_to", dateTo);

      const res = await fetch(url.toString(), {
        headers: authToken ? { Authorization: `Token ${authToken}` } : undefined,
      });
      if (!res.ok) return;

      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : payload.results ?? [];
      setIncidents(list);
    };

    void load();
  }, [mounted, authToken, stateFilter, locationFilter, dateFrom, dateTo]);

  const totalReports = useMemo(
    () => incidents.reduce((sum, incident) => sum + (incident.signal_count ?? 1), 0),
    [incidents],
  );

  const averageConfidenceScore = useMemo(() => {
    const scores = incidents
      .map((incident) => incident.confidence_score)
      .filter((score): score is number => typeof score === "number");
    if (scores.length === 0) return null;
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1);
  }, [incidents]);

  const clearFilters = () => {
    setStateFilter("");
    setLocationFilter("");
    setDateFrom("");
    setDateTo("");
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/incident-reports"
        role={role}
        onNavigate={(path) => router.push(path)}
        onLogout={() => {
          window.localStorage.removeItem("geopulse.token");
          window.location.assign("/login");
        }}
      />
      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#060B16]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">Incident Management</h2>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">
                <label className="block text-[10px] text-white/35">State</label>
                <input
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  placeholder="e.g. Lagos"
                  className="mt-1 w-full rounded-md bg-[#07101A] px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">
                <label className="block text-[10px] text-white/35">Location</label>
                <input
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="e.g. Benin, Allen Avenue"
                  className="mt-1 w-full rounded-md bg-[#07101A] px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">
                <label className="block text-[10px] text-white/35">Date from</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1 w-full rounded-md bg-[#07101A] px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">
                <label className="block text-[10px] text-white/35">Date to</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1 w-full rounded-md bg-[#07101A] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-white/35">
                  Visible incidents
                </div>
                <div className="mt-2 text-2xl font-semibold">{incidents.length}</div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-white/35">
                  Reports merged
                </div>
                <div className="mt-2 text-2xl font-semibold">{totalReports}</div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">
                <div className="text-[10px] uppercase tracking-widest text-white/35">
                  Avg confidence score
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {averageConfidenceScore ? `${averageConfidenceScore}%` : "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3 flex items-end">
                <button
                  onClick={clearFilters}
                  className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                >
                  Clear filters
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {incidents.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-2xl border border-white/[0.04] px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-semibold">{inc.title}</div>
                    <div className="text-xs text-white/40">
                      {inc.incident_type} · {inc.confidence} · {inc.status}
                    </div>
                    <div className="mt-1 text-xs text-white/30">
                      {inc.location_name || "No location"}
                      {inc.detected_at ? ` · ${new Date(inc.detected_at).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <div className="grid min-w-[220px] grid-cols-2 gap-2 text-xs text-white/50">
                    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-widest text-white/30">
                        Reports
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {inc.signal_count ?? 1}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-widest text-white/30">
                        Score
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {typeof inc.confidence_score === "number"
                          ? `${inc.confidence_score}%`
                          : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/incidents/${inc.id}`)}
                      className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      View
                    </button>
                    {role === "admin" && (
                      <>
                        <button
                          onClick={async () => {
                            if (!authToken) return;
                            const res = await fetch(
                              `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/incidents/${inc.id}/approve/`,
                              { method: "POST", headers: { Authorization: `Token ${authToken}` } },
                            );
                            if (res.ok) {
                              const updated = await res.json();
                              setIncidents((s) => s.map((i) => (i.id === updated.id ? updated : i)));
                            } else {
                              console.error(await res.text());
                            }
                          }}
                          className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            if (!authToken) return;
                            const res = await fetch(
                              `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/incidents/${inc.id}/remove_from_map/`,
                              { method: "POST", headers: { Authorization: `Token ${authToken}` } },
                            );
                            if (res.ok) {
                              const updated = await res.json();
                              setIncidents((s) => s.map((i) => (i.id === updated.id ? updated : i)));
                            } else {
                              console.error(await res.text());
                            }
                          }}
                          className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300"
                        >
                          Remove From Map
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
