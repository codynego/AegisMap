"use client";

import { useEffect } from "react";

import { getCurrentRole } from "@/lib/access";

export default function DashboardAnalyticsPage() {
  const role = getCurrentRole();

  useEffect(() => {
    if (role !== "analyst" && role !== "admin") {
      window.location.replace("/dashboard");
    }
  }, [role]);

  if (role === "analyst" || role === "admin") {
    return (
      <div className="min-h-screen bg-[#060B16] text-white px-6 py-8">
        <h1 className="text-2xl font-bold">AI Predictions</h1>
        <p className="mt-2 text-sm text-white/60">Incident forecasting and predictive risk signals for internal teams.</p>
      </div>
    );
  }

  return null;
}
