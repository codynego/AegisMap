export type ReportTypeDefinition = {
  value: string;
  label: string;
  color: string;
};

export const REPORT_TYPE_DEFINITIONS: ReportTypeDefinition[] = [
  { value: "suspicious_activity", label: "Suspicious Activity", color: "#4cd7f6" },
  { value: "road_accident", label: "Road Accident", color: "#ffb454" },
  { value: "armed_robbery", label: "Armed Robbery", color: "#ff3f5a" },
  { value: "kidnapping", label: "Kidnapping", color: "#ff5f6d" },
  { value: "fire_outbreak", label: "Fire Outbreak", color: "#ff8f4c" },
  { value: "road_obstruction", label: "Road Obstruction", color: "#f8c15b" },
  { value: "flooding", label: "Flooding", color: "#46c0ff" },
  { value: "medical_emergency", label: "Medical Emergency", color: "#7cdb8a" },
  { value: "gunshots_heard", label: "Gunshots Heard", color: "#d96cff" },
  { value: "unsafe_route", label: "Unsafe Route", color: "#8f7dff" },
];

const REPORT_TYPE_ALIASES: Record<string, string> = {
  suspicious_movement: "suspicious_activity",
  abnormal_sighting: "suspicious_activity",
  camp_indicator: "suspicious_activity",
  threat_activity: "suspicious_activity",
  tip: "suspicious_activity",
  other: "suspicious_activity",
  violence: "gunshots_heard",
  road_threat: "unsafe_route",
  road_blockade: "road_obstruction",
  fire_smoke: "fire_outbreak",
  fire: "fire_outbreak",
  flood: "flooding",
};

const REPORT_TYPE_LABELS = new Map(REPORT_TYPE_DEFINITIONS.map((type) => [type.value, type.label]));
const REPORT_TYPE_COLORS = new Map(REPORT_TYPE_DEFINITIONS.map((type) => [type.value, type.color]));

export const REPORT_TYPE_VALUES = REPORT_TYPE_DEFINITIONS.map((type) => type.value);
export const REPORT_TYPE_LEGEND = REPORT_TYPE_DEFINITIONS.map(({ label, color }) => ({ label, color }));

export function normalizeReportType(value: string) {
  const normalized = value.trim().toLowerCase();
  return REPORT_TYPE_ALIASES[normalized] ?? normalized;
}

export function formatReportType(value: string) {
  const normalized = normalizeReportType(value);
  return (
    REPORT_TYPE_LABELS.get(normalized) ??
    normalized
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function reportTypeColor(value: string) {
  return REPORT_TYPE_COLORS.get(normalizeReportType(value)) ?? "#4cd7f6";
}

export function isRouteRiskReportType(value: string) {
  const normalized = normalizeReportType(value);
  return normalized === "unsafe_route" || normalized === "road_obstruction" || normalized === "road_accident";
}
