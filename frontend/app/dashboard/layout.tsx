"use client";

import { ReactNode, useEffect, useState } from "react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [authorized] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window.localStorage.getItem("geopulse.token"));
  });

  useEffect(() => {
    if (!authorized) {
      window.location.replace("/login");
    }
  }, [authorized]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#060B16] text-white">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-6 py-4 text-sm text-white/55">
          Verifying operator access...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
