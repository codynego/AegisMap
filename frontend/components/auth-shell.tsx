import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  alternateLabel: string;
  alternateHref: string;
  alternateText: string;
  children: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  alternateLabel,
  alternateHref,
  alternateText,
  children,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hud-grid opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(76,215,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(78,222,163,0.12),transparent_28%)]" />

      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-[rgb(134,147,151,0.14)] bg-[rgb(9,14,28,0.72)] shadow-[0_32px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="border-b border-[rgb(61,73,76,0.22)] px-6 py-8 sm:px-8 lg:border-b-0 lg:border-r lg:px-12 lg:py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-[var(--on-surface)] transition hover:text-[var(--primary)]"
          >
            <span className="font-display text-3xl font-bold text-[var(--primary)]">
              GeoPulse AI
            </span>
            <span className="rounded-full border border-[rgb(78,222,163,0.16)] bg-[rgb(78,222,163,0.1)] px-2.5 py-1 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-[var(--secondary)]">
              AUTH NODE
            </span>
          </Link>

          <div className="mt-12 max-w-md">
            <p className="font-mono-ui text-[11px] uppercase tracking-[0.22em] text-[var(--secondary)]">
              {eyebrow}
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-[var(--on-surface)] sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-[var(--on-surface-variant)] sm:text-lg">
              {description}
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              ["Secure Token Auth", "Direct integration with the platform auth endpoints."],
              ["Fast Access", "Minimal form fields so field operators can get in quickly."],
              ["Responsive Layout", "Works cleanly on phones, tablets, and desktop screens."],
              ["Mission Ready", "Aligned with the same tactical visual system as the homepage."],
            ].map(([label, body]) => (
              <div key={label} className="glass-panel rounded-2xl p-4">
                <p className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--primary)]">
                  {label}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--on-surface-variant)]">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="font-mono-ui text-[11px] uppercase tracking-[0.18em] text-[var(--on-surface-variant)]">
                  ACCESS CONTROL
                </p>
                <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
                  {alternateLabel}{" "}
                  <Link href={alternateHref} className="font-semibold text-[var(--primary)] hover:underline">
                    {alternateText}
                  </Link>
                </p>
              </div>
              <span className="rounded-full border border-[rgb(76,215,246,0.18)] bg-[rgb(76,215,246,0.08)] px-3 py-1 font-mono-ui text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
                Tactical Access
              </span>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
