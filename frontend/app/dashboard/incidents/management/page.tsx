"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole } from "@/lib/access";

export default function IncidentManagementPage() {
  const router = useRouter();
  const role = getCurrentRole();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [authToken] = useState<string | null>(() => (typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token")));

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const load = async () => {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/incidents/`);
      if (stateFilter) url.searchParams.set("state", stateFilter);
      const res = await fetch(url.toString(), {
        headers: authToken ? { Authorization: `Token ${authToken}` } : undefined,
      });
      if (!res.ok) return;
      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : payload.results ?? [];
      setIncidents(list);
    };
    void load();
  }, [mounted, authToken, stateFilter]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activePath="/dashboard/incident-reports" role={role} onNavigate={(p) => router.push(p)} onLogout={() => { window.localStorage.removeItem("geopulse.token"); window.location.assign("/login"); }} />
      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#060B16]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">Incident Management</h2>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">Total: {incidents.length}</div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3">
                <label className="block text-[10px] text-white/35">State</label>
                <input value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} placeholder="e.g. Lagos" className="mt-1 w-full rounded-md bg-[#07101A] px-3 py-2 text-sm" />
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-3 flex items-end">
                <button onClick={() => setStateFilter("")} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm">Clear</button>
              </div>
            </div>

            <div className="space-y-2">
              {incidents.map((inc) => (
                <div key={inc.id} className="rounded-2xl border border-white/[0.04] px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{inc.title}</div>
                    <div className="text-xs text-white/40">{inc.incident_type} · {inc.confidence} · {inc.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => router.push(`/dashboard/incidents/${inc.id}`)} className="rounded-xl bg-white/[0.03] px-3 py-2 text-sm">View</button>
                    {role === "admin" && (
                      <button
                        onClick={async () => {
                          if (!authToken) return;
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/incidents/${inc.id}/approve/`, { method: "POST", headers: { Authorization: `Token ${authToken}` } });
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
