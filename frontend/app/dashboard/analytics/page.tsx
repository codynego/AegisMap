"use client";

import { useEffect } from "react";

import { getCurrentRole } from "@/lib/access";
import InternalRiskForecastingPage from "../../internal/ai-predictions/page";

export default function DashboardAnalyticsPage() {
  const role = getCurrentRole();

  useEffect(() => {
    if (role !== "analyst" && role !== "admin") {
      window.location.replace("/dashboard");
    }
  }, [role]);

  if (role === "analyst" || role === "admin") {
    return <InternalRiskForecastingPage />;
  }

  return null;
}
