import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="glass-panel-strong w-full max-w-3xl rounded-[28px] p-8 text-center sm:p-12">
        <p className="font-mono-ui text-[11px] uppercase tracking-[0.22em] text-[var(--secondary)]">
          Dashboard Shell
        </p>
        <h1 className="mt-4 font-display text-4xl font-semibold text-[var(--on-surface)] sm:text-5xl">
          Command center access is ready.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-[var(--on-surface-variant)] sm:text-lg">
          Authentication now routes here successfully. The next step is building the full operational dashboard with map, alerts, watch zones, and live signal activity.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-[var(--primary-container)] px-6 py-3 text-base font-semibold text-[var(--on-primary-container)] transition hover:bg-[var(--primary)]"
          >
            Back to Homepage
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[rgb(134,147,151,0.18)] px-6 py-3 text-base font-semibold text-[var(--on-surface)] transition hover:bg-[var(--surface-container-high)]"
          >
            Switch Account
          </Link>
        </div>
      </div>
    </main>
  );
}
