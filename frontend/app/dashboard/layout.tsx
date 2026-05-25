"use client";

import { ReactNode, useEffect, useState } from "react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mounted, setMounted] = useState(false);
  const hasToken =
    mounted && typeof window !== "undefined" && !!window.localStorage.getItem("geopulse.token");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (mounted && !hasToken) {
      window.location.replace("/login");
    }
  }, [hasToken, mounted]);

  if (!mounted || !hasToken) {
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
