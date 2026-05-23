"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole } from "@/lib/access";

export default function IncidentDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const incidentId = params.id;
  const role = getCurrentRole();

  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [incident, setIncident] = useState<any | null>(null);
  const [patrolUploads, setPatrolUploads] = useState<any[]>([]);
  const [availableUploads, setAvailableUploads] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newFiles, setNewFiles] = useState<File[] | null>(null);
  const [authToken] = useState<string | null>(() => (typeof window === "undefined" ? null : window.localStorage.getItem("geopulse.token")));
  const [attaching, setAttaching] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!incidentId) return;
    const load = async () => {
      const incRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/incidents/${incidentId}/`, {
        headers: authToken ? { Authorization: `Token ${authToken}` } : undefined,
      });
      if (incRes.ok) setIncident(await incRes.json());

      // patrol uploads for this incident (API may paginate)
      const pRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/patrol-uploads/?incident=${incidentId}`, {
        headers: authToken ? { Authorization: `Token ${authToken}` } : undefined,
      });
      if (pRes.ok) {
        const data = await pRes.json();
        const list = Array.isArray(data) ? data : data.results ?? [];
        setPatrolUploads(list);
      }

      // available (unattached) uploads - fetch all then filter client-side
      const aRes = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/patrol-uploads/`, {
        headers: authToken ? { Authorization: `Token ${authToken}` } : undefined,
      });
      if (aRes.ok) {
        const all = await aRes.json();
        // API may return paginated list or array; normalize
        const list = Array.isArray(all) ? all : all.results ?? [];
        setAvailableUploads(list.filter((u: any) => !u.incident));
      }
    };
    void load();
  }, [mounted, incidentId, authToken]);

  const handleAttach = async () => {
    if (!selectedUpload || !authToken) return;
    setAttaching(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/patrol-uploads/${selectedUpload}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Token ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ incident: Number(incidentId) }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPatrolUploads((s) => [...s, updated]);
        setAvailableUploads((s) => s.filter((u) => u.id !== updated.id));
        setSelectedUpload(null);
      } else {
        console.error("Attach failed", await res.text());
      }
    } finally {
      setAttaching(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activePath="/dashboard/incident-reports" role={role} onNavigate={(p) => router.push(p)} onLogout={() => { window.localStorage.removeItem("geopulse.token"); window.location.assign("/login"); }} />
      <div className="lg:ml-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#060B16]/90 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate text-lg font-semibold">Incident</h2>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full space-y-4">
            {incident ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0A1020]/60 p-4">
                <h3 className="text-lg font-semibold">{incident.title}</h3>
                <p className="text-sm text-white/50">{incident.summary}</p>
                <p className="mt-2 text-xs text-white/30">Type: {incident.incident_type}</p>
              </div>
            ) : (
              <div className="text-white/40">Loading incident…</div>
            )}

            <section>
              <h4 className="mb-2 text-sm font-semibold">Attached patrol uploads</h4>
              <div className="space-y-2">
                {patrolUploads.length === 0 && <div className="text-white/30">No patrol uploads attached.</div>}
                {patrolUploads.map((p) => (
                  <div key={p.id} className="rounded-xl border border-white/[0.04] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-white/40">{p.summary}</div>
                      </div>
                      <div className="text-xs text-white/30">{new Date(p.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-2 text-sm font-semibold">Attach existing patrol upload</h4>
              <div className="flex gap-2">
                <select value={selectedUpload ?? ""} onChange={(e) => setSelectedUpload(Number(e.target.value) || null)} className="flex-1 rounded-xl bg-[#0A1020]/60 px-3 py-2">
                  <option value="">Select an upload</option>
                  {availableUploads.map((u) => (
                    <option key={u.id} value={u.id}>{u.title}</option>
                  ))}
                </select>
                <button disabled={!selectedUpload || attaching} onClick={handleAttach} className="rounded-xl bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 disabled:opacity-40">
                  Attach
                </button>
              </div>
            </section>

            {role === "analyst" && (
              <section>
                <h4 className="mb-2 mt-4 text-sm font-semibold">Create new patrol upload</h4>
                <div className="rounded-2xl border border-white/[0.04] px-4 py-3">
                  <div className="mb-2">
                    <label className="block text-xs text-white/40">Title</label>
                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1 w-full rounded-md bg-[#07101A] px-3 py-2 text-sm" />
                  </div>
                  <div className="mb-2">
                    <label className="block text-xs text-white/40">Summary</label>
                    <textarea value={newSummary} onChange={(e) => setNewSummary(e.target.value)} className="mt-1 w-full rounded-md bg-[#07101A] px-3 py-2 text-sm" rows={3} />
                  </div>
                  <div className="mb-3">
                    <label className="block text-xs text-white/40">Media</label>
                    <input type="file" multiple onChange={(e) => setNewFiles(e.target.files ? Array.from(e.target.files) : null)} className="mt-1 w-full text-sm text-white/60" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!authToken) return;
                        try {
                          const payload = { title: newTitle || `Patrol ${new Date().toISOString()}`, summary: newSummary, recorded_at: new Date().toISOString(), incident: Number(incidentId) };
                          const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/patrol-uploads/`, {
                            method: "POST",
                            headers: { Authorization: `Token ${authToken}`, "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                          });
                          if (!res.ok) {
                            console.error("Failed creating patrol upload", await res.text());
                            return;
                          }
                          const created = await res.json();
                          // upload files
                          if (newFiles && newFiles.length > 0) {
                            for (const f of newFiles) {
                              const fd = new FormData();
                              fd.append("file", f);
                              fd.append("media_type", f.type.startsWith("image/") ? "image" : "other");
                              fd.append("patrol_upload", String(created.id));
                              const mres = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"}/media-assets/`, {
                                method: "POST",
                                headers: { Authorization: `Token ${authToken}` },
                                body: fd,
                              });
                              if (!mres.ok) console.error("media upload failed", await mres.text());
                            }
                          }
                          // refresh lists
                          setPatrolUploads((s) => [...s, created]);
                          setNewTitle("");
                          setNewSummary("");
                          setNewFiles(null);
                          setAvailableUploads((s) => s.filter((u) => u.id !== created.id));
                        } catch (err) {
                          console.error(err);
                        }
                      }}
                      className="rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300"
                    >
                      Create & Attach
                    </button>
                    <span className="text-xs text-white/40">You can also attach existing uploads above.</span>
                  </div>
                </div>
              </section>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
