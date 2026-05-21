const metrics = [
  { label: "Launch speed", value: "Fast" },
  { label: "Stack", value: "Next.js + Tailwind" },
  { label: "State", value: "Ready to extend" },
];

const capabilities = [
  "App Router with typed metadata",
  "Tailwind-powered visual system",
  "TypeScript-first project layout",
  "Clean foundation for product work",
];

export default function Home() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.22),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent)] opacity-40" />

      <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 sm:px-8 lg:px-10">
        <div className="grid w-full gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
          <div className="space-y-8">
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 backdrop-blur">
              Frontend scaffold ready
            </span>

            <div className="space-y-5">
              <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-white sm:text-6xl lg:text-7xl">
                A bold starting point for your Next.js frontend.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                This project starts with a polished App Router setup, typed
                metadata, Tailwind styling, and a visual direction that is ready
                for product work instead of a placeholder screen.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <a
                href="https://nextjs.org/docs"
                className="inline-flex items-center justify-center rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-accent-600"
              >
                Read the docs
              </a>
              <a
                href="#capabilities"
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Explore the scaffold
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <article
                  key={metric.label}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur"
                >
                  <p className="text-sm text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {metric.value}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-accent-100">
                  Project layout
                </p>
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-white">
                  Built to grow cleanly.
                </h2>
              </div>

              <div id="capabilities" className="space-y-3">
                {capabilities.map((capability, index) => (
                  <div
                    key={capability}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.04] p-4"
                  >
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-accent-500/15 text-sm font-semibold text-accent-100">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                      {capability}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-accent-500/20 bg-accent-500/10 p-5 text-sm leading-6 text-accent-50">
                Next step: add your first feature area or API integration and keep
                the rest of the foundation intact.
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
