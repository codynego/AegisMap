"use client";

import { useEffect } from "react";

import { getCurrentRole } from "@/lib/access";
import InternalSettingsPage from "../../internal/settings/page";

export default function DashboardSettingsPage() {
  const role = getCurrentRole();

  useEffect(() => {
    if (role !== "analyst" && role !== "admin") {
      window.location.replace("/dashboard");
    }
  }, [role]);

  if (role === "analyst" || role === "admin") {
    return <InternalSettingsPage />;
  }

  return null;
}
