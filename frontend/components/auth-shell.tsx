import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
};

export function AuthShell({ children }: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 hud-grid opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(76,215,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(78,222,163,0.12),transparent_28%)]" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
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
        </div>

        {children}
      </div>
    </main>
  );
}
