"use client";

import { useEffect } from "react";
import { getCurrentRole } from "@/lib/access";

export default function DashboardDroneRedirectPage() {
  const role = getCurrentRole();

  useEffect(() => {
    if (role !== "analyst" && role !== "admin") {
      window.location.replace("/dashboard/profile");
    }
  }, [role]);

  if (role === "analyst" || role === "admin") {
    return (
      <div className="min-h-screen bg-[#060B16] text-white px-6 py-8">
        <h1 className="text-2xl font-bold">Drone Intelligence</h1>
        <p className="mt-2 text-sm text-white/60">Operational drone feeds and overlays for analysts.</p>
      </div>
    );
  }

  return null;
}
