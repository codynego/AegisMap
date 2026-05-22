"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserProfile = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  is_verified: boolean;
  date_joined: string;
  profile_picture?: string;
};

type CurrentUserResponse = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile?: {
    id: number;
    display_name: string;
    role: string;
    organization: string;
    phone_number: string;
    region_name: string;
    is_active_operator: boolean;
    metadata: UnknownRecord;
    created_at: string;
    updated_at: string;
  };
};

type ReportHistoryItem = {
  id: number;
  title: string;
  status: string;
  created_at: string;
  verified: boolean;
  accuracy_score?: number;
};

type SavedRoute = {
  id: number;
  name: string;
  origin: string;
  destination: string;
  created_at: string;
};

type SourceProfileRecord = {
  id: number;
  user: number | null;
  linked_username: string;
  label: string;
  reliability_band: string;
  trust_score: number;
  report_count: number;
  verified_signal_count: number;
  disputed_signal_count: number;
};

type ApiListResponse<T> = { results?: T[] };

type TrustMetrics = {
  trust_score: number;
  accuracy_percentage: number;
  reports_submitted: number;
  verified_reports: number;
  contribution_level: string;
};

type UnknownRecord = Record<string, unknown>;

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";

// ─── Icons ────────────────────────────────────────────────────────────────────

const I = {
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 3l7 4v5c0 5-3.5 8.3-7 9-3.5-.7-7-4-7-9V7l7-4Z" /><path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  star: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
      <polygon points="12 2 15.09 10.26 24 10.26 17.55 16.61 20.63 24.88 12 19.24 3.37 24.88 6.45 16.61 0 10.26 8.91 10.26 12 2" />
    </svg>
  ),
  map: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <polygon points="3 7 9 4 15 7 21 4 21 17 15 20 9 17 3 20" /><line x1="9" y1="4" x2="9" y2="17" /><line x1="15" y1="7" x2="15" y2="20" />
    </svg>
  ),
  bell: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M10.3 4.3 2.1 18a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  ),
  chevronRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function relTime(v?: string | null): string {
  if (!v) return "Now";
  const m = Math.max(0, Math.round((Date.now() - new Date(v).getTime()) / 60000));
  if (m < 1) return "Now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function getList<T>(payload: T[] | ApiListResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

function isObjectRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function pickString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function pickNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function pickBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseCurrentUserProfile(payload: unknown): { profile: UserProfile; userId: number; username: string } | null {
  if (!isObjectRecord(payload)) return null;

  const profile = isObjectRecord(payload.profile) ? payload.profile : null;
  const displayName = pickString(profile?.display_name, "").trim();
  const fullName = [pickString(payload.first_name, "").trim(), pickString(payload.last_name, "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
  const username = pickString(payload.username, "User");
  const name = displayName || fullName || username;
  const role = pickString(profile?.role, "");

  return {
    userId: pickNumber(payload.id),
    username,
    profile: {
      id: pickNumber(profile?.id),
      name,
      email: pickString(payload.email),
      phone: pickString(profile?.phone_number, "") || undefined,
      is_verified: ["trusted_verifier", "analyst", "admin"].includes(role),
      date_joined: pickString(profile?.created_at, ""),
      profile_picture: undefined,
    },
  };
}

function parseSourceProfiles(payload: unknown): SourceProfileRecord[] {
  const rows = getList<unknown>(payload as unknown[] | ApiListResponse<unknown>);
  return rows
    .map((row): SourceProfileRecord | null => {
      if (!isObjectRecord(row)) return null;
      return {
        id: pickNumber(row.id),
        user: typeof row.user === "number" ? row.user : null,
        linked_username: pickString(row.linked_username),
        label: pickString(row.label, "Source profile"),
        reliability_band: pickString(row.reliability_band, "moderate"),
        trust_score: pickNumber(row.trust_score),
        report_count: pickNumber(row.report_count),
        verified_signal_count: pickNumber(row.verified_signal_count),
        disputed_signal_count: pickNumber(row.disputed_signal_count),
      };
    })
    .filter((item): item is SourceProfileRecord => item !== null);
}

function reliabilityLabel(band: string): string {
  switch (band) {
    case "trusted":
      return "Trusted";
    case "high":
      return "High";
    case "moderate":
      return "Moderate";
    case "low":
      return "Low";
    default:
      return band ? band.charAt(0).toUpperCase() + band.slice(1) : "Unknown";
  }
}

function buildTrustMetrics(sourceProfile: SourceProfileRecord): TrustMetrics {
  const accuracyPercentage =
    sourceProfile.report_count > 0
      ? Math.round((sourceProfile.verified_signal_count / sourceProfile.report_count) * 100)
      : 0;

  return {
    trust_score: sourceProfile.trust_score,
    accuracy_percentage: accuracyPercentage,
    reports_submitted: sourceProfile.report_count,
    verified_reports: sourceProfile.verified_signal_count,
    contribution_level: reliabilityLabel(sourceProfile.reliability_band),
  };
}

function parseReportHistoryItems(payload: unknown): ReportHistoryItem[] {
  const rows = getList<unknown>(payload as unknown[] | ApiListResponse<unknown>);
  return rows
    .map((row): ReportHistoryItem | null => {
      if (!isObjectRecord(row)) return null;
      return {
        id: pickNumber(row.id),
        title: pickString(row.title, "Untitled report"),
        status: pickString(row.status, "pending"),
        created_at: pickString(row.created_at),
        verified: pickBoolean(row.verified),
        accuracy_score:
          typeof row.accuracy_score === "number" && Number.isFinite(row.accuracy_score)
            ? row.accuracy_score
            : undefined,
      };
    })
    .filter((item): item is ReportHistoryItem => item !== null);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "border-b-2 border-cyan-400 text-cyan-300"
          : "border-b-2 border-transparent text-white/50 hover:text-white/70"
      }`}
    >
      {label}
    </button>
  );
}

function StatBox({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "positive" | "neutral" | "warning" }) {
  const toneClass =
    tone === "positive" ? "text-emerald-300" : tone === "warning" ? "text-amber-300" : "text-cyan-300";
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-xs text-white/40">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authToken] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("geopulse.token"),
  );

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trustMetrics, setTrustMetrics] = useState<TrustMetrics | null>(null);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(Boolean(authToken));
  const [activeTab, setActiveTab] = useState("account");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    let active = true;
    const h = { Authorization: `Token ${authToken}` };

    async function load() {
      setLoading(true);
      try {
        const [meRes, sourceRes, reportRes] = await Promise.all([
          fetch(`${API_BASE_URL}/auth/me/`, { headers: h }).catch(() => null),
          fetch(`${API_BASE_URL}/source-profiles/`, { headers: h }).catch(() => null),
          fetch(`${API_BASE_URL}/incidents/?submitted_by=me`, { headers: h }).catch(() => null),
        ]);

        if (!active) return;

        let currentUser: CurrentUserResponse | null = null;

        if (meRes?.ok) {
          const meData = (await meRes.json()) as unknown;
          const parsedUser = parseCurrentUserProfile(meData);
          if (parsedUser) {
            currentUser = {
              id: parsedUser.userId,
              username: parsedUser.username,
              email: parsedUser.profile.email,
              first_name: "",
              last_name: "",
              profile: {
                id: parsedUser.profile.id,
                display_name: parsedUser.profile.name,
                role: parsedUser.profile.is_verified ? "trusted_verifier" : "community_reporter",
                organization: "",
                phone_number: parsedUser.profile.phone ?? "",
                region_name: "",
                is_active_operator: true,
                metadata: {},
                created_at: parsedUser.profile.date_joined,
                updated_at: parsedUser.profile.date_joined,
              },
            };
            setProfile(parsedUser.profile);
          }
        }

        if (sourceRes?.ok) {
          const sourceData = (await sourceRes.json()) as unknown;
          const sourceProfiles = parseSourceProfiles(sourceData);
          const matchedSource =
            sourceProfiles.find((item) => item.user === currentUser?.id) ??
            sourceProfiles.find((item) => item.linked_username === currentUser?.username) ??
            sourceProfiles[0];
          if (matchedSource) {
            setTrustMetrics(buildTrustMetrics(matchedSource));
          }
        }

        if (reportRes?.ok) {
          const rData = (await reportRes.json()) as unknown;
          const parsedReports = parseReportHistoryItems(rData).slice(0, 5) as ReportHistoryItem[];
          setReportHistory(parsedReports);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [authToken]);

  if (!mounted) return null;

  if (!profile && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060B16] text-white">
        <div className="text-center">
          <p className="text-white/50">Unable to load profile. Please try again.</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-400/20"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060B16] text-white antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_50%_at_0%_0%,rgba(6,182,212,0.05),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(255,82,82,0.04),transparent)]" />

      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-white/[0.06] bg-[#060B16]/90 px-4 backdrop-blur-xl sm:px-6">
          <h1 className="text-sm font-semibold text-white">Profile</h1>
        </header>

        <main className="space-y-4 px-3 py-4 sm:px-6 lg:px-8">
          {/* User Header Card */}
          {profile && (
            <div className="rounded-3xl border border-white/[0.06] bg-[#08101F]/90 p-4 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-xl font-bold text-cyan-300">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{profile.name}</h2>
                    {profile.is_verified && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                        {I.check} Verified
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/40">{profile.email}</p>
                  {profile.phone && <p className="text-xs text-white/40">{profile.phone}</p>}
                  <p className="mt-2 text-xs text-white/30">Member since {new Date(profile.date_joined).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-white/[0.06]">
            <div className="flex gap-1 overflow-x-auto">
              <TabButton label="Account Info" active={activeTab === "account"} onClick={() => setActiveTab("account")} />
              <TabButton label="Trust & Reports" active={activeTab === "trust"} onClick={() => setActiveTab("trust")} />
              <TabButton label="Routes & Alerts" active={activeTab === "routes"} onClick={() => setActiveTab("routes")} />
            </div>
          </div>

          {/* Account Info Tab */}
          {activeTab === "account" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-[#08101F]/90 p-4">
                <h3 className="mb-4 text-sm font-semibold text-white">Personal Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Name</span>
                    <span className="text-sm text-white">{profile?.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Email</span>
                    <span className="text-sm text-white">{profile?.email}</span>
                  </div>
                  {profile?.phone && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/50">Phone</span>
                      <span className="text-sm text-white">{profile.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50">Verification Status</span>
                    <span className="text-sm text-emerald-300 font-semibold">
                      {profile?.is_verified ? "✓ Verified" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-[#08101F]/90 p-4">
                <h3 className="mb-4 text-sm font-semibold text-white">Privacy & Security</h3>
                <div className="space-y-3">
                  <button className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.04]">
                    <span className="text-white">Change Password</span>
                    <p className="mt-0.5 text-xs text-white/40">Update your login credentials</p>
                  </button>
                  <button className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.04]">
                    <span className="text-white">Privacy Settings</span>
                    <p className="mt-0.5 text-xs text-white/40">Control what data is shared</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Trust & Reports Tab */}
          {activeTab === "trust" && (
            <div className="space-y-4">
              {/* Trust Score Card */}
              {trustMetrics && (
                <div className="rounded-2xl border border-white/[0.06] bg-[#08101F]/90 p-4">
                  <h3 className="mb-4 text-sm font-semibold text-white">Trust & Reputation</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <StatBox label="Trust Score" value={trustMetrics.trust_score} tone="positive" />
                    <StatBox label="Accuracy Rate" value={`${trustMetrics.accuracy_percentage}%`} tone="positive" />
                    <StatBox label="Reports Submitted" value={trustMetrics.reports_submitted} tone="neutral" />
                    <StatBox label="Verified Reports" value={trustMetrics.verified_reports} tone="positive" />
                  </div>
                  <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                    <p className="text-xs text-emerald-300">
                      <span className="font-semibold">{trustMetrics.contribution_level}</span> • Your reports are highly valued by the community
                    </p>
                  </div>
                </div>
              )}

              {/* Report History */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#08101F]/90 p-4">
                <h3 className="mb-4 text-sm font-semibold text-white">Recent Reports</h3>
                {reportHistory.length > 0 ? (
                  <div className="space-y-2">
                    {reportHistory.map((report) => (
                      <div key={report.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{report.title}</p>
                          <p className="mt-0.5 text-xs text-white/40">{relTime(report.created_at)}</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          {report.verified && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 font-semibold uppercase">
                              Verified
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${
                              report.status === "resolved"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : report.status === "pending"
                                  ? "bg-amber-500/10 text-amber-300"
                                  : "bg-white/10 text-white/40"
                            }`}
                          >
                            {report.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-white/40">No reports submitted yet</p>
                )}
              </div>
            </div>
          )}

          {/* Routes & Alerts Tab */}
          {activeTab === "routes" && (
            <div className="space-y-4">
              {/* Saved Routes */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#08101F]/90 p-4">
                <h3 className="mb-4 text-sm font-semibold text-white">Saved Routes</h3>
                {savedRoutes.length > 0 ? (
                  <div className="space-y-2">
                    {savedRoutes.map((route) => (
                      <div key={route.id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex-shrink-0 text-cyan-300">{I.map}</div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{route.name}</p>
                            <p className="mt-0.5 truncate text-xs text-white/40">
                              {route.origin} → {route.destination}
                            </p>
                          </div>
                        </div>
                        <button className="flex-shrink-0 text-white/30 hover:text-white/50">{I.chevronRight}</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-white/40">No saved routes yet</p>
                )}
              </div>

              {/* Alert Preferences */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#08101F]/90 p-4">
                <h3 className="mb-4 text-sm font-semibold text-white">Alert Preferences</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                    <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-white/20 accent-cyan-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">Nearby Incidents</p>
                      <p className="mt-0.5 text-xs text-white/40">Get alerts for incidents near you</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                    <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-white/20 accent-cyan-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">Route Warnings</p>
                      <p className="mt-0.5 text-xs text-white/40">Alerts for saved routes</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                    <input type="checkbox" className="h-4 w-4 rounded border-white/20 accent-cyan-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white">Critical Alerts Only</p>
                      <p className="mt-0.5 text-xs text-white/40">Only high-severity incidents</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Emergency Settings */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#08101F]/90 p-4">
                <h3 className="mb-4 text-sm font-semibold text-white flex items-center gap-2">
                  {I.alert} Emergency Settings
                </h3>
                <div className="space-y-3">
                  <button className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.04]">
                    <span className="text-white">Emergency Contacts</span>
                    <p className="mt-0.5 text-xs text-white/40">Add people to notify in emergencies</p>
                  </button>
                  <button className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.04]">
                    <span className="text-white">SOS Preferences</span>
                    <p className="mt-0.5 text-xs text-white/40">Configure SOS button behavior</p>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
