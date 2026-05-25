import Link from "next/link";

const navItems = ["Features", "Solutions", "Intelligence", "Pricing", "Docs"];

const featureCards = [
  {
    badge: "MP",
    title: "Incident Mapping",
    body: "Global geospatial tracking of incidents with millisecond precision and rich contextual metadata.",
    accent: "var(--primary-container)",
  },
  {
    badge: "AI",
    title: "AI Threat Detection",
    body: "Proprietary LLMs analyzing signals to identify emerging threats before they materialize.",
    accent: "var(--secondary)",
  },
  {
    badge: "RI",
    title: "Route Intelligence",
    body: "Dynamic risk-aware routing for assets, personnel, and high-value logistics operations.",
    accent: "var(--primary-container)",
  },
  {
    badge: "GF",
    title: "Heatmaps & Geofencing",
    body: "Automated perimeter alerts and risk concentration visualizations across any geographic scale.",
    accent: "var(--secondary)",
  },
  {
    badge: "RA",
    title: "Real-Time Alerts",
    body: "Multi-channel instant notifications with priority routing for emergency response coordination.",
    accent: "var(--primary-container)",
  },
  {
    badge: "DS",
    title: "Drone & Satellite Analysis",
    body: "Integration of high-altitude imaging and local drone feeds for comprehensive surveillance.",
    accent: "var(--secondary)",
  },
  {
    badge: "PA",
    title: "Predictive Analytics",
    body: "Forecasting future risk hotspots using historical patterns and live environmental data.",
    accent: "var(--primary-container)",
  },
  {
    badge: "EC",
    title: "Emergency Coordination",
    body: "Unified communication layer for multi-agency response and asset management.",
    accent: "var(--secondary)",
  },
];

const lifecycle = [
  {
    step: "01",
    badge: "SR",
    title: "Collect Reports",
    body: "Aggregating disparate data from satellites, IoT, and field reports.",
    accent: "var(--primary-container)",
    ink: "var(--on-primary-container)",
  },
  {
    step: "02",
    badge: "AN",
    title: "Analyze Signals",
    body: "Processing noise through advanced AI models to find relevant data points.",
    accent: "var(--secondary)",
    ink: "var(--on-secondary)",
  },
  {
    step: "03",
    badge: "PT",
    title: "Detect Patterns",
    body: "Synthesizing multi-vector analysis to identify recurring risk signatures.",
    accent: "var(--primary-container)",
    ink: "var(--on-primary-container)",
  },
  {
    step: "04",
    badge: "GI",
    title: "Generate Intelligence",
    body: "Transforming data into actionable tactical intelligence reports.",
    accent: "var(--secondary)",
    ink: "var(--on-secondary)",
  },
  {
    step: "05",
    badge: "CR",
    title: "Coordinate Response",
    body: "Deploying assets and managing personnel based on AI insights.",
    accent: "var(--primary-container)",
    ink: "var(--on-primary-container)",
  },
];

const footerColumns = [
  {
    title: "Platform",
    links: ["Intelligence API", "Case Studies", "Documentation"],
  },
  {
    title: "Company",
    links: ["About Us", "Careers", "Security"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Service", "Compliance"],
  },
];

function HudChip({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-white/5 px-2 font-mono-ui text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{ color, borderColor: "color-mix(in srgb, currentColor 20%, transparent)" }}
    >
      {label}
    </span>
  );
}

export default function Home() {
  return (
    <div className="bg-[var(--background)] text-[var(--on-surface)]">
      <header className="fixed top-0 z-50 w-full border-b border-[color:var(--outline-variant)]/20 bg-[rgb(14_19_34_/_0.6)] backdrop-blur-xl">
        <nav className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-2 md:gap-3">
            <span className="font-display text-[24px] font-bold text-[var(--primary)] md:text-[32px]">
              GeoPulse AI
            </span>
            <span className="rounded-full border border-[rgb(78_222_163_/_0.2)] bg-[rgb(78_222_163_/_0.1)] px-2 py-0.5 font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--secondary)]">
              TACTICAL-V4
            </span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            {navItems.map((item, index) => (
              <a
                key={item}
                href="#"
                className={
                  index === 0
                    ? "border-b-2 border-[var(--primary)] pb-1 text-[18px] font-semibold text-[var(--primary)]"
                    : "text-[18px] font-semibold text-[var(--on-surface-variant)] transition-colors hover:text-[var(--primary)]"
                }
              >
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            <button
              aria-label="Open navigation"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(134,147,151,0.18)] bg-white/5 text-[var(--on-surface)] md:hidden"
            >
              <span className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
              </span>
            </button>
            <button className="hidden text-[18px] font-semibold text-[var(--on-surface)] transition-colors hover:text-[var(--primary)] md:block">
              Contact
            </button>
            <Link
              href="/login"
              className="rounded-full bg-[var(--primary-container)] px-4 py-2 text-[16px] font-semibold text-[var(--on-primary-container)] shadow-[0_12px_40px_rgba(6,182,212,0.18)] transition hover:bg-[var(--primary)] md:px-6 md:text-[18px]"
            >
              Login
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative pt-20">
        <section className="map-bg hud-grid relative flex min-h-[720px] items-center justify-center overflow-hidden px-4 sm:px-6 md:px-8 lg:min-h-[800px] lg:h-screen">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <img
              alt="Intelligence Map"
              className="h-full w-full object-cover opacity-20 grayscale brightness-50"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBoUDUv6KsJ6aOEGjCRHq1-PQnOShZ_sAOYawMq1F4Yyctzcz7GGfq1z8pYMI3r-pB18DvWCLtCsNEG9Ze7I3BJAhF4BLKd9UEZ-wIDvjktedoAdYNTt2rwLLwDqOXNkd2oPEA1Z3Ssaaxj0xvIM7WEXfIHpJmw8BTY9N-qQ0vLebpLzlSFbme8h71P2F5to4Tp-dHvdNnI5NZGlIaFaQxuO-_3scT7aOXEldeGc21pbtiLZFCshc8nf-sgxcuo1pHknUOF1Jh7kg3A"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(6,182,212,0.10),transparent_28%),radial-gradient(circle_at_80%_70%,rgba(78,222,163,0.08),transparent_25%),linear-gradient(180deg,rgba(5,5,5,0.18),rgba(10,15,30,0.5))]" />
            <div className="glow-pulse absolute left-[22%] top-[28%] h-3 w-3 rounded-full bg-[var(--secondary)]" />
            <div
              className="glow-pulse absolute right-[29%] top-[34%] h-4 w-4 rounded-full bg-[var(--primary-container)]"
              style={{ animationDelay: "1s" }}
            />
            <div
              className="glow-pulse absolute bottom-[22%] right-[24%] h-2.5 w-2.5 rounded-full bg-[var(--tertiary-container)]"
              style={{ animationDelay: "2s" }}
            />

            <div className="glass-panel absolute right-8 top-32 hidden max-w-[200px] rounded-xl border-l-4 border-l-[var(--primary)] p-4 lg:block">
              <div className="mb-2 flex items-center gap-2">
                <HudChip label="SEC" color="var(--primary)" />
                <span className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
                  Threat Level
                </span>
              </div>
              <div className="font-display text-[32px] font-semibold text-[var(--primary)]">
                ELEVATED
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full w-[65%] bg-[var(--primary)]" />
              </div>
            </div>

            <div className="glass-panel absolute bottom-28 left-8 hidden max-w-[220px] rounded-xl border-l-4 border-l-[var(--secondary)] p-4 lg:block">
              <div className="mb-2 flex items-center gap-2">
                <HudChip label="MON" color="var(--secondary)" />
                <span className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
                  Live Analysis
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between font-mono-ui text-[11px] uppercase tracking-[0.15em] text-[var(--on-surface)]">
                  <span>SATELLITE</span>
                  <span className="text-[var(--secondary)]">ACTIVE</span>
                </div>
                <div className="flex justify-between font-mono-ui text-[11px] uppercase tracking-[0.15em] text-[var(--on-surface)]">
                  <span>GRID SYNC</span>
                  <span className="text-[var(--secondary)]">98.4%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="scanline relative z-10 mx-auto max-w-4xl px-2 text-center">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-[rgb(76,215,246,0.16)] bg-[rgb(9,14,28,0.72)] px-4 py-2 backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-[var(--secondary)]" />
              <span className="font-mono-ui text-[11px] uppercase tracking-[0.2em] text-[var(--on-surface-variant)]">
                LIVE GEOINT SIGNAL FUSION PLATFORM
              </span>
            </div>
            <h1 className="font-display text-[40px] font-bold leading-[1.12] tracking-[-0.02em] sm:text-[54px] md:text-[64px]">
              AI-Powered Threat Intelligence <br />
              <span className="text-[var(--primary)]">&amp; Situational Awareness</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-8 text-[var(--on-surface-variant)] md:text-xl">
              Monitor incidents, analyze risk patterns, and coordinate real-time intelligence from a unified geospatial platform designed for the next generation of global security operations.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 md:flex-row">
              <Link
                href="/public-safety"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgb(78,222,163,0.22)] bg-[rgb(78,222,163,0.08)] px-8 py-4 text-[18px] font-semibold text-[var(--secondary)] transition hover:scale-[1.02] hover:bg-[rgb(78,222,163,0.14)]"
              >
                <HudChip label="MAP" color="var(--secondary)" />
                Explore Public Safety Map
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary-container)] px-8 py-4 text-[18px] font-semibold text-[var(--on-primary-container)] transition hover:scale-[1.02] hover:bg-[var(--primary)]"
              >
                <HudChip label="GO" color="var(--on-primary-container)" />
                Launch Command Center
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgb(134,147,151,0.22)] px-8 py-4 text-[18px] font-semibold text-[var(--on-surface)] transition hover:bg-[var(--surface-variant)]"
              >
                <HudChip label="VIS" color="var(--on-surface)" />
                Create Access
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-[var(--surface-container-lowest)] px-4 py-20 sm:px-6 md:px-8 md:py-24">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-12 text-center md:mb-16">
              <span className="font-mono-ui text-[12px] uppercase tracking-[0.2em] text-[var(--secondary)]">
                Operations Dashboard
              </span>
              <h2 className="mt-2 font-display text-[24px] font-semibold leading-8 sm:text-[32px] sm:leading-10">
                Unified Tactical View
              </h2>
            </div>

            <div className="glass-panel relative overflow-hidden rounded-[24px] shadow-2xl">
              <div className="flex h-8 items-center gap-2 border-b border-[rgb(61,73,76,0.2)] bg-[var(--surface-container-high)] px-4">
                <div className="h-2.5 w-2.5 rounded-full bg-[rgb(255,180,171,0.4)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[rgb(255,129,122,0.4)]" />
                <div className="h-2.5 w-2.5 rounded-full bg-[rgb(78,222,163,0.4)]" />
                <div className="ml-4 font-mono-ui text-[11px] uppercase tracking-[0.16em] text-[var(--on-surface-variant)]">
                  INTELLIGENCE_CORE_V2.0 // TERMINAL_ALPHA
                </div>
              </div>

              <div className="flex flex-col gap-6 bg-[rgb(22,27,43,0.45)] p-4 pt-12 lg:flex-row lg:p-8">
                <div className="w-full space-y-4 lg:w-80">
                  <div className="glass-panel rounded-xl border-l-2 border-l-[var(--primary)] p-4">
                    <h4 className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--primary)]">
                      RISK SCORE: LONDON HQ
                    </h4>
                    <div className="mt-2 font-display text-[36px] font-semibold leading-none">
                      12.4{" "}
                      <span className="text-base font-normal text-[var(--secondary)]">
                        (-2.1)
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--on-surface-variant)]">
                      Status: Stable Operations
                    </p>
                  </div>

                  <div className="glass-panel rounded-xl border-l-2 border-l-[var(--tertiary-container)] p-4">
                    <h4 className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--tertiary-container)]">
                      CRITICAL ALERTS
                    </h4>
                    <div className="mt-4 space-y-3">
                      {[
                        ["Anomalous Activity Detected", "Sector 4-G | 2 mins ago"],
                        ["Sensor Disconnection", "Northeast Perimeter | 14 mins ago"],
                      ].map(([title, detail]) => (
                        <div key={title} className="flex items-start gap-3">
                          <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--tertiary-container)]" />
                          <div>
                            <p className="text-sm font-semibold text-[var(--on-surface)]">{title}</p>
                            <p className="text-xs text-[var(--on-surface-variant)]">{detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative h-[360px] overflow-hidden rounded-xl sm:h-[420px] lg:h-[500px] lg:flex-1">
                  <img
                    alt="Interface Preview"
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8PXP5bcwIPguhK09nVCSB3DvXP6fnYshtVHqhhFagXAb5ivGug7TP3JQM7-USbQH1GYu-ZRhplJSwNDBsTMYnOoICZjEPVQMIWLDl8Lrrgi9DG32tUGHgIoRoG-x0hRMiDJRkWaPmW6wd_9Am0ufF4VCRc06-kbpSGgexUYBzYR4NQ55g6G4ertei7OP8oqhZ39SFblbgbjX9LVpT04OFESmg-rgJ5qyxaGuvT1I_LAG0pscT2BcJ4IxpuU5X34yZlvOvi1UyEX_j"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-container-lowest)] to-transparent opacity-45" />
                  <div className="pointer-events-none absolute inset-4 flex flex-col justify-between border border-[rgb(76,215,246,0.1)]">
                    <div className="flex justify-between p-4">
                      <div className="rounded border border-[rgb(76,215,246,0.3)] bg-black/80 px-2 py-1 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
                        GRID_SYNC_092
                      </div>
                      <div className="rounded border border-[rgb(76,215,246,0.3)] bg-black/80 px-2 py-1 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
                        REC: 00:45:12
                      </div>
                    </div>
                    <div className="flex gap-4 overflow-x-auto p-4">
                      <div className="glass-panel shrink-0 rounded-md border border-[rgb(78,222,163,0.2)] px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full bg-[var(--secondary)]" />
                          <span className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface)]">
                            Sector Secure
                          </span>
                        </div>
                      </div>
                      <div className="glass-panel shrink-0 rounded-md border border-[rgb(76,215,246,0.2)] px-4 py-2">
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]" />
                          <span className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface)]">
                            UAV Live Feed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 md:px-8 md:py-24">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-12 flex flex-col gap-4 md:mb-16 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="font-mono-ui text-[12px] uppercase tracking-[0.2em] text-[var(--primary)]">
                  Capabilities
                </span>
                <h2 className="mt-2 max-w-md font-display text-[24px] font-semibold leading-8 sm:text-[32px] sm:leading-10">
                  Next-Generation Intelligence Features
                </h2>
              </div>
              <button className="self-start border-b border-[rgb(76,215,246,0.3)] text-[18px] font-semibold text-[var(--primary)] transition hover:border-[var(--primary)] md:self-auto">
                Explore Platform Specs →
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((feature) => (
                <div
                  key={feature.title}
                  className="glass-panel rounded-xl border-t-2 border-t-transparent p-8 transition hover:-translate-y-2"
                  style={{ borderTopColor: "transparent" }}
                >
                  <div className="transition" style={{ color: feature.accent }}>
                    <HudChip label={feature.badge} color={feature.accent} />
                  </div>
                  <h3 className="mt-6 text-[18px] font-semibold text-[var(--on-surface)]">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--on-surface-variant)]">
                    {feature.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-[rgb(61,73,76,0.15)] bg-[var(--surface-container-low)] px-4 py-16 sm:px-6 md:px-8">
          <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-10 lg:grid-cols-4">
            {[
              ["1.2M+", "Incidents Monitored", "var(--primary)"],
              ["450+", "Active Zones", "var(--secondary)"],
              ["99.8%", "Prediction Accuracy", "var(--primary)"],
              ["-42%", "Response Time Reduction", "var(--secondary)"],
            ].map(([value, label, tone]) => (
              <div key={label} className="text-center">
                <div className="font-mono-ui text-[40px] font-semibold" style={{ color: tone }}>
                  {value}
                </div>
                <div className="mt-2 font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden px-4 py-20 sm:px-6 md:px-8 md:py-24">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-16 text-center md:mb-20">
              <span className="font-mono-ui text-[12px] uppercase tracking-[0.2em] text-[var(--secondary)]">
                Methodology
              </span>
              <h2 className="mt-2 font-display text-[24px] font-semibold leading-8 sm:text-[32px] sm:leading-10">
                The Intelligence Lifecycle
              </h2>
            </div>

            <div className="relative">
              <div className="absolute left-0 top-1/2 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-[rgb(61,73,76,0.4)] to-transparent lg:block" />
              <div className="relative z-10 grid grid-cols-1 gap-8 lg:grid-cols-5">
                {lifecycle.map((item) => (
                  <div key={item.step} className="flex flex-col items-center text-center">
                    <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[rgb(61,73,76,0.3)] bg-[var(--surface-container-high)]">
                      <HudChip label={item.badge} color="var(--on-surface)" />
                      <div
                        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full font-mono-ui text-[10px] font-bold"
                        style={{ backgroundColor: item.accent, color: item.ink }}
                      >
                        {item.step}
                      </div>
                    </div>
                    <h4 className="text-[18px] font-semibold text-[var(--on-surface)]">
                      {item.title}
                    </h4>
                    <p className="mt-2 max-w-[160px] text-xs leading-6 text-[var(--on-surface-variant)]">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 md:px-8 md:py-24">
          <div className="glass-panel relative mx-auto max-w-4xl overflow-hidden rounded-[24px] border border-[rgb(76,215,246,0.2)] p-8 text-center sm:p-12">
            <div className="absolute inset-0 bg-[rgb(76,215,246,0.05)]" />
            <div className="relative">
              <h2 className="font-display text-[24px] font-semibold leading-8 sm:text-[48px] sm:leading-[56px]">
                Secure Your Operations Today
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--on-surface-variant)]">
                Join 200+ global intelligence teams monitoring the world in real-time.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <button className="rounded-full bg-[var(--primary-container)] px-10 py-4 text-[18px] font-semibold text-[var(--on-primary-container)] transition hover:shadow-[0_16px_48px_rgba(76,215,246,0.22)]">
                  Request Demo Access
                </button>
                <button className="rounded-full border border-[rgb(134,147,151,0.22)] px-10 py-4 text-[18px] font-semibold text-[var(--on-surface)] transition hover:bg-[var(--surface-variant)]">
                  View Pricing
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[rgb(61,73,76,0.15)] bg-[var(--surface-container-lowest)] px-4 py-12 sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <div className="font-display text-[32px] font-bold text-[var(--on-surface)]">
              GeoPulse AI
            </div>
            <p className="max-w-xs text-base leading-7 text-[var(--on-surface-variant)]">
              Tactical intelligence systems for a safer, more predictable world. Powered by proprietary AI geospatial engines.
            </p>
            <div className="flex gap-4">
              <HudChip label="WEB" color="var(--on-surface-variant)" />
              <HudChip label="SHD" color="var(--on-surface-variant)" />
              <HudChip label="CMD" color="var(--on-surface-variant)" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-16">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h5 className="mb-4 text-[18px] font-semibold text-[var(--on-surface)]">
                  {column.title}
                </h5>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-[var(--on-surface-variant)] transition-colors hover:text-[var(--primary)]"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-[1440px] flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <div className="text-base text-[rgb(188,201,205,0.6)]">
            Copyright 2024 GeoPulse AI. Tactical Intelligence Systems.
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--on-surface-variant)]">
            <span>System Status:</span>
            <span className="flex items-center gap-1.5 text-[var(--secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]" />
              ALL SYSTEMS OPERATIONAL
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
