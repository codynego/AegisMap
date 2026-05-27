"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { getCurrentRole } from "@/lib/access";

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  Menu: () => (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0115 0" />
    </svg>
  ),
  Bell: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  ),
  MapPin: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
  Shield: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  Lock: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  Signal: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304-.001a3.75 3.75 0 010 5.304m-7.425 2.122a6.75 6.75 0 010-9.546m9.546.001a6.75 6.75 0 010 9.545M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12z" />
    </svg>
  ),
  Eye: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.574-3.007-9.964-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  ExternalLink: () => (
    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  ),
  Loader: () => (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="animate-spin">
      <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  RadioWave: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.5 10.5a3 3 0 104.243 4.243M6.343 6.343A8.25 8.25 0 0117.657 17.657M3.515 3.515A12.75 12.75 0 0120.485 20.485" />
    </svg>
  ),
  Verified: () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-.605 3.032 3.745 3.745 0 01-3.033.603 3.745 3.745 0 01-3.068 1.593 3.745 3.745 0 01-3.068-1.593 3.745 3.745 0 01-3.032-.604 3.745 3.745 0 01-.604-3.032A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 01.604-3.032 3.745 3.745 0 013.032-.604A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.745 3.745 0 013.032.604 3.745 3.745 0 01.604 3.032A3.745 3.745 0 0121 12z" />
    </svg>
  ),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const PREF_KEY = "user_preferences_v1";

const DEFAULTS = {
  display_name: "",
  default_dashboard: "/dashboard",
  time_horizon: "24h",
  email_alerts: true,
  flood_alerts: true,
  route_warnings: true,
  emergency_alerts: true,
  minor_incidents: false,
  severity_threshold: "medium",
  alert_radius_km: 50,
  anonymous_reporting: false,
  blur_exact_location: true,
  share_profile_public: false,
  push_notifications: true,
  sms_alerts: false,
};

type Prefs = typeof DEFAULTS & Record<string, unknown>;

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer group py-0.5">
      <div>
        <div className="text-sm font-medium text-[#E2EAF4] group-hover:text-white transition-colors">{label}</div>
        {sub && <div className="text-xs text-[#4A6070] mt-0.5">{sub}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/50 ${
          checked ? "bg-[#00C8FF]" : "bg-[#1A2535]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

// ── Checkbox ──────────────────────────────────────────────────────────────────
function Checkbox({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group py-0.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          checked ? "bg-[#00C8FF] border-[#00C8FF]" : "bg-transparent border-[#1E2D3D] group-hover:border-[#2E4050]"
        }`}
      >
        {checked && <Icon.Check />}
      </button>
      <div>
        <div className="text-sm text-[#D0DCE8] group-hover:text-white transition-colors">{label}</div>
        {sub && <div className="text-xs text-[#4A6070] mt-0.5">{sub}</div>}
      </div>
    </label>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#2E4558]">{label}</span>
      <div className="flex-1 h-px bg-[#0E1E2C]" />
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[180px_1fr] gap-1.5 sm:gap-4 items-start">
      <label className="text-xs font-medium text-[#4A6070] pt-2.5 uppercase tracking-wide">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, readOnly, placeholder }: { value: string; onChange?: (v: string) => void; readOnly?: boolean; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
        readOnly
          ? "border-[#0E1E2C] bg-[#060D17] text-[#3A5060] cursor-not-allowed"
          : "border-[#152030] bg-[#081018] text-[#D8E8F4] focus:border-[#00C8FF]/40 focus:bg-[#081520] placeholder:text-[#2A3D50]"
      }`}
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[#152030] bg-[#081018] px-3 py-2 text-sm text-[#D8E8F4] outline-none focus:border-[#00C8FF]/40 transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const role = getCurrentRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

  const [section, setSection] = useState("profile");
  const [prefs, setPrefs] = useState<Prefs>(() => ({ ...DEFAULTS }));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [watchZones, setWatchZones] = useState<any[] | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(PREF_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed) setPrefs((p) => ({ ...p, ...parsed }));
    } catch {}

    const token = typeof window !== "undefined" ? window.localStorage.getItem("geopulse.token") : null;
    const headers = token ? { Authorization: `Token ${token}` } : undefined;

    Promise.all([
      fetch(`${API_BASE_URL}/user-preferences/me/`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE_URL}/auth/me/`, { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`${API_BASE_URL}/watch-zones/`).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([prefBody, userBody, zonesBody]) => {
      if (prefBody) setPrefs((p) => ({ ...p, ...prefBody }));
      if (userBody) setUserInfo(userBody);
      if (zonesBody) setWatchZones(Array.isArray(zonesBody) ? zonesBody : []);
    });
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
      setDirty(false);
      const token = typeof window !== "undefined" ? window.localStorage.getItem("geopulse.token") : null;
      const resp = await fetch(`${API_BASE_URL}/user-preferences/me/`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...(token ? { Authorization: `Token ${token}` } : {}) },
        body: JSON.stringify(prefs),
      }).catch(() => null);
      if (resp?.ok) {
        const body = await resp.json();
        if (body) setPrefs((p) => ({ ...p, ...body }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [prefs]);

  const reset = useCallback(() => {
    setPrefs({ ...DEFAULTS });
    setDirty(true);
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setDirty(true);
  }, []);

  const sections = useMemo(() => [
    { key: "profile", label: "Profile", icon: <Icon.User /> },
    { key: "alerts", label: "Alert Preferences", icon: <Icon.AlertTriangle /> },
    { key: "watch_zones", label: "Watch Zones", icon: <Icon.MapPin /> },
    { key: "privacy", label: "Privacy", icon: <Icon.Lock /> },
    { key: "notifications", label: "Notifications", icon: <Icon.Bell /> },
    { key: "trust", label: "Trust & Verification", icon: <Icon.Verified /> },
  ], []);

  const currentSection = sections.find((x) => x.key === section);

  if (!role) return null;

  return (
    <>
      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePath="/dashboard/settings"
        onNavigate={(p) => router.push(p)}
        onLogout={() => {
          window.localStorage.removeItem("geopulse.token");
          window.localStorage.removeItem("geopulse.user");
          window.location.assign("/login");
        }}
        role={role}
      />

      <div className="relative z-10 lg:ml-64 min-h-screen bg-[#040B14]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#0A1928] bg-[#040B14]/95 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg border border-[#0E1E2C] bg-[#081018] text-[#4A6070] hover:text-white transition"
            >
              <Icon.Menu />
            </button>
            <div className="flex items-center gap-2 text-[#3A5570]">
              <button onClick={() => router.push("/dashboard")} className="hover:text-[#00C8FF] transition-colors text-sm">Dashboard</button>
              <Icon.ChevronRight />
              <span className="text-[#8AAABB] text-sm font-medium">Settings</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1.5 text-xs text-[#00C8FF] bg-[#00C8FF]/10 border border-[#00C8FF]/20 px-2.5 py-1 rounded-full">
                <Icon.Check /> Saved
              </span>
            )}
            <button
              type="button"
              onClick={reset}
              className="rounded-lg px-3 py-1.5 text-xs border border-[#0E1E2C] bg-[#060E18] text-[#4A6070] hover:text-white hover:border-[#1E2D3D] transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                !dirty
                  ? "bg-[#060E18] text-[#2A3D50] border border-[#0A1828] cursor-not-allowed"
                  : "bg-[#00C8FF] text-[#020810] hover:bg-[#40DAFF] shadow-[0_0_16px_rgba(0,200,255,0.25)]"
              }`}
            >
              {saving ? <><Icon.Loader /> Saving…</> : "Save changes"}
            </button>
          </div>
        </header>

        <div className="px-4 py-5 sm:px-6 lg:px-8">
          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-sm text-[#3A5570] mt-0.5">Manage your AegisMap preferences and account details</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-5">
            {/* Sidebar nav */}
            <aside className="lg:w-52 shrink-0">
              {/* Mobile: pill strip (scrollable horizontal) */}
              <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                {sections.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                      section === s.key
                        ? "bg-[#00C8FF]/15 text-[#00C8FF] border border-[#00C8FF]/30"
                        : "bg-[#07121C] text-[#4A6070] border border-[#0A1828] hover:text-white"
                    }`}
                  >
                    <span className={section === s.key ? "text-[#00C8FF]" : "text-[#2E4050]"}>{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Desktop: stacked list */}
              <nav className="hidden lg:flex flex-col gap-0.5 rounded-2xl border border-[#0A1928] bg-[#050D17] p-2">
                {sections.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-lg transition-all group ${
                      section === s.key
                        ? "bg-[#00C8FF]/10 text-white border border-[#00C8FF]/15"
                        : "text-[#4A6070] hover:bg-[#07121C] hover:text-[#9ABCCC]"
                    }`}
                  >
                    <span className={`transition-colors ${section === s.key ? "text-[#00C8FF]" : "text-[#2E4050] group-hover:text-[#4A7080]"}`}>
                      {s.icon}
                    </span>
                    <span className="text-sm font-medium">{s.label}</span>
                    {section === s.key && (
                      <span className="ml-auto text-[#00C8FF]"><Icon.ChevronRight /></span>
                    )}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Content panel */}
            <main className="flex-1 min-w-0">
              <div className="rounded-2xl border border-[#0A1928] bg-[#050D17] overflow-hidden">
                {/* Panel header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-[#0A1928]">
                  <span className="text-[#00C8FF]">{currentSection?.icon}</span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">{currentSection?.label}</h2>
                    <p className="text-[11px] text-[#3A5070] mt-0.5">
                      {section === "profile" && "Your public identity and dashboard defaults"}
                      {section === "alerts" && "Choose what incidents you're notified about"}
                      {section === "watch_zones" && "Saved geographic areas you're monitoring"}
                      {section === "privacy" && "Control your data and visibility settings"}
                      {section === "notifications" && "How and where you receive alerts"}
                      {section === "trust" && "Verification level and contribution history"}
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-6">
                  {/* ── PROFILE ── */}
                  {section === "profile" && (
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <FieldRow label="Display name">
                          <TextInput
                            value={String(prefs.display_name ?? "")}
                            onChange={(v) => update({ display_name: v })}
                            placeholder="Your name"
                          />
                        </FieldRow>
                        <FieldRow label="Email">
                          <TextInput value={userInfo?.email ?? "(managed by auth)"} readOnly />
                        </FieldRow>
                        <FieldRow label="Username">
                          <TextInput value={userInfo?.username ?? ""} readOnly />
                        </FieldRow>
                      </div>

                      <Divider label="Dashboard defaults" />

                      <div className="space-y-3">
                        <FieldRow label="Default view">
                          <SelectInput
                            value={String(prefs.default_dashboard)}
                            onChange={(v) => update({ default_dashboard: v })}
                            options={[
                              { value: "/dashboard", label: "Overview" },
                              { value: "/dashboard/map", label: "Map view" },
                              { value: "/dashboard/alerts", label: "Alerts feed" },
                            ]}
                          />
                        </FieldRow>
                        <FieldRow label="Time horizon">
                          <SelectInput
                            value={String(prefs.time_horizon)}
                            onChange={(v) => update({ time_horizon: v })}
                            options={[
                              { value: "1h", label: "Last 1 hour" },
                              { value: "6h", label: "Last 6 hours" },
                              { value: "24h", label: "Last 24 hours" },
                              { value: "7d", label: "Last 7 days" },
                            ]}
                          />
                        </FieldRow>
                      </div>

                    </div>
                  )}

                  {/* ── ALERTS ── */}
                  {section === "alerts" && (
                    <div className="space-y-5">
                      <Divider label="Alert types" />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Checkbox checked={Boolean(prefs.flood_alerts)} onChange={(v) => update({ flood_alerts: v })} label="Flood alerts" sub="River and flash-flood warnings" />
                        <Checkbox checked={Boolean(prefs.route_warnings)} onChange={(v) => update({ route_warnings: v })} label="Route warnings" sub="Road closures and diversions" />
                        <Checkbox checked={Boolean(prefs.emergency_alerts)} onChange={(v) => update({ emergency_alerts: v })} label="Emergency alerts" sub="High-priority incident notifications" />
                        <Checkbox checked={Boolean(prefs.minor_incidents)} onChange={(v) => update({ minor_incidents: v })} label="Minor incidents" sub="Low-severity community reports" />
                      </div>

                      <Divider label="Thresholds" />

                      <FieldRow label="Min. severity">
                        <SelectInput
                          value={String(prefs.severity_threshold)}
                          onChange={(v) => update({ severity_threshold: v })}
                          options={[
                            { value: "low", label: "Low — all incidents" },
                            { value: "medium", label: "Medium and above" },
                            { value: "high", label: "High and above" },
                            { value: "critical", label: "Critical only" },
                          ]}
                        />
                      </FieldRow>

                      <FieldRow label="Alert radius (km)">
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={5}
                            max={200}
                            step={5}
                            value={Number(prefs.alert_radius_km)}
                            onChange={(e) => update({ alert_radius_km: Number(e.target.value) })}
                            className="flex-1 accent-[#00C8FF]"
                          />
                          <span className="text-sm font-semibold text-[#00C8FF] w-12 text-right">{prefs.alert_radius_km} km</span>
                        </div>
                      </FieldRow>
                    </div>
                  )}

                  {/* ── WATCH ZONES ── */}
                  {section === "watch_zones" && (
                    <div className="space-y-4">
                      <p className="text-sm text-[#4A6070]">Geographic areas you are actively monitoring for risk events.</p>
                      {watchZones === null && (
                        <div className="flex items-center gap-2 text-sm text-[#3A5070]">
                          <Icon.Loader /> Loading zones…
                        </div>
                      )}
                      {watchZones?.length === 0 && (
                        <div className="rounded-xl border border-dashed border-[#0E1E2C] p-6 text-center">
                          <Icon.MapPin />
                          <p className="text-sm text-[#3A5070] mt-2">No watch zones configured yet.</p>
                        </div>
                      )}
                      {watchZones && watchZones.length > 0 && (
                        <div className="space-y-2">
                          {watchZones.map((z) => {
                            const risk = String(z.current_risk_level ?? "").toLowerCase();
                            const riskColor = risk === "high" || risk === "critical" ? "text-red-400" : risk === "medium" ? "text-orange-400" : "text-emerald-400";
                            return (
                              <div key={z.id} className="flex items-center justify-between rounded-xl border border-[#0A1928] bg-[#060E18] px-4 py-3 hover:border-[#152535] transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="text-[#2E5060]"><Icon.MapPin /></span>
                                  <div>
                                    <div className="text-sm font-medium text-[#C8DCE8]">{z.name}</div>
                                    <div className={`text-xs ${riskColor} mt-0.5`}>{z.current_risk_level} · score {z.current_risk_score ?? "—"}</div>
                                  </div>
                                </div>
                                <a
                                  href={`/watch-area?watch_area_id=${z.id}`}
                                  className="flex items-center gap-1 text-xs text-[#00C8FF] hover:text-[#40DAFF] transition-colors"
                                >
                                  View <Icon.ExternalLink />
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── PRIVACY ── */}
                  {section === "privacy" && (
                    <div className="space-y-5">
                      <Divider label="Reporting" />
                      <div className="space-y-3">
                        <Toggle
                          checked={Boolean(prefs.anonymous_reporting)}
                          onChange={(v) => update({ anonymous_reporting: v })}
                          label="Anonymous reporting"
                          sub="Your identity won't be attached to submitted reports"
                        />
                        <Toggle
                          checked={Boolean(prefs.blur_exact_location)}
                          onChange={(v) => update({ blur_exact_location: v })}
                          label="Blur exact location"
                          sub="Reduces GPS precision when sharing location data"
                        />
                      </div>
                      <Divider label="Visibility" />
                      <Toggle
                        checked={Boolean(prefs.share_profile_public)}
                        onChange={(v) => update({ share_profile_public: v })}
                        label="Public profile"
                        sub="Allow other users to see your activity stats"
                      />
                    </div>
                  )}

                  {/* ── NOTIFICATIONS ── */}
                  {section === "notifications" && (
                    <div className="space-y-5">
                      <Divider label="Channels" />
                      <div className="space-y-3">
                        <Toggle
                          checked={Boolean(prefs.push_notifications)}
                          onChange={(v) => update({ push_notifications: v })}
                          label="Push notifications"
                          sub="In-app and browser notifications"
                        />
                        <Toggle
                          checked={Boolean(prefs.email_alerts)}
                          onChange={(v) => update({ email_alerts: v })}
                          label="Email alerts"
                          sub="Receive alerts to your registered email"
                        />
                        <div className="opacity-50 pointer-events-none">
                          <Toggle
                            checked={Boolean(prefs.sms_alerts)}
                            onChange={() => {}}
                            label="SMS alerts"
                            sub="Coming soon — not yet available"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── TRUST ── */}
                  {section === "trust" && (
                    <div className="space-y-5">
                      <div className="grid sm:grid-cols-3 gap-3">
                        {[
                          { label: "Role", value: userInfo?.profile?.role ?? "—", icon: <Icon.Shield /> },
                          { label: "Trust score", value: String(userInfo?.profile?.metadata?.trust_score ?? userInfo?.profile?.trust_score ?? "—"), icon: <Icon.Verified /> },
                          { label: "Status", value: userInfo?.is_active ? "Active" : "—", icon: <Icon.Signal /> },
                        ].map((stat) => (
                          <div key={stat.label} className="rounded-xl border border-[#0A1928] bg-[#060E18] p-4">
                            <div className="flex items-center gap-2 text-[#3A5570] mb-2">{stat.icon}<span className="text-xs uppercase tracking-wide">{stat.label}</span></div>
                            <div className="text-xl font-bold text-white">{stat.value}</div>
                          </div>
                        ))}
                      </div>
                      <Divider label="Verification history" />
                      <p className="text-sm text-[#3A5570]">Contribution stats and verification events appear here once your account has activity.</p>
                    </div>
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}