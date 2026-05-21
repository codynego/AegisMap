"use client";

import { ReactNode, useEffect, useSyncExternalStore } from "react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const authorized = useSyncExternalStore(
    () => () => {},
    () => Boolean(window.localStorage.getItem("geopulse.token")),
    () => false,
  );

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
