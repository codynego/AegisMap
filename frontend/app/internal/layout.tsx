"use client";

import { ReactNode, useEffect, useState } from "react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("geopulse.token");
    setAuthorized(Boolean(token));

    if (!token) {
      window.location.replace("/login");
    }
  }, []);

  if (authorized !== true) {
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
