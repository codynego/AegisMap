export type AppRole = "regular_user" | "community_reporter" | "trusted_verifier" | "analyst" | "admin";

export type StoredSessionUser = {
  id?: number;
  username?: string;
  email?: string;
  profile?: {
    role?: string;
    display_name?: string;
  };
};

export type NavItem = {
  label: string;
  path: string;
};

export const INTERNAL_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Watch Area", path: "/watch-area" },
  { label: "Live Intelligence", path: "/dashboard/live-intelligence" },
  { label: "Incident Reports", path: "/dashboard/incident-reports" },
  { label: "Route Intelligence", path: "/dashboard/route-intelligence" },
  { label: "Drone Intelligence", path: "/dashboard/drone-intelligence" },
  { label: "AI Predictions", path: "/dashboard/ai-predictions" },
  { label: "Incident Management", path: "/dashboard/incidents/management" },
  { label: "Verification Queue", path: "/dashboard/verification-queue" },
  { label: "Settings", path: "/dashboard/settings" },
];

export function parseStoredSessionUser(raw: string | null): StoredSessionUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSessionUser;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredSessionUser() {
  if (typeof window === "undefined") return null;
  return parseStoredSessionUser(window.localStorage.getItem("geopulse.user"));
}

export function getUserRole(user: StoredSessionUser | null): AppRole {
  const role = user?.profile?.role;
  if (
    role === "regular_user" ||
    role === "community_reporter" ||
    role === "trusted_verifier" ||
    role === "analyst" ||
    role === "admin"
  ) {
    return role;
  }
  return "regular_user";
}

export function isAnalystRole(role: AppRole) {
  return role === "analyst" || role === "admin";
}

export function isTrustedReporterRole(role: AppRole) {
  return role === "trusted_verifier" || role === "community_reporter";
}

export function getDefaultRouteForRole(role: AppRole) {
  return "/dashboard";
}

export function getCurrentRole() {
  return getUserRole(getStoredSessionUser());
}

export function getPublicNavItems(role: AppRole): NavItem[] {
  // Public-facing nav for community users and trusted reporters.
  // Keep ordering consistent with product spec.
  const userItems: NavItem[] = [
    { label: "Home", path: "/dashboard" },
    { label: "Watch Area", path: "/watch-area" },
    { label: "Map", path: "/dashboard/live-intelligence" },
    { label: "Report", path: "/dashboard/incident-reports" },
    { label: "Routes", path: "/dashboard/route-intelligence" },
    { label: "Alerts", path: "/dashboard/ai-predictions" },
    { label: "Profile", path: "/dashboard/profile" },
  ];

  if (isTrustedReporterRole(role)) {
    // Insert Verification Queue before Profile for trusted reporters.
    const trusted = [...userItems];
    trusted.splice(userItems.length - 1, 0, { label: "Verification Queue", path: "/dashboard/verification-queue" });
    return trusted;
  }

  return userItems;
}

export function resolvePublicNavItems() {
  return getPublicNavItems(getCurrentRole());
}
