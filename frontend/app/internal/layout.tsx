"use client";

import { ReactNode, useEffect, useState } from "react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("geopulse.token");
    if (!token) {
      window.location.replace("/login");
      return;
    }
    const path = window.location.pathname;
    const mappedPath =
      path === "/internal"
        ? "/dashboard"
        : path === "/internal/live-intelligence"
          ? "/dashboard/live-intelligence"
          : path === "/internal/incident-reports"
            ? "/dashboard/incident-reports"
            : path === "/internal/route-intelligence"
              ? "/dashboard/route-intelligence"
              : path === "/internal/ai-predictions"
                ? "/dashboard/analytics"
                : path === "/internal/drone-intelligence"
                  ? "/dashboard/drone-intelligence"
                  : "/dashboard";
    window.location.replace(mappedPath);
  }, []);

  if (authorized !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060B16] text-white">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-6 py-4 text-sm text-white/55">
          Redirecting to the unified dashboard...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
