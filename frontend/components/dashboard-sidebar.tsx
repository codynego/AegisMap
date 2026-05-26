"use client";

import { getPublicNavItems, INTERNAL_NAV_ITEMS, isAnalystRole, type AppRole } from "@/lib/access";

export type DashboardSidebarProps = {
  open: boolean;
  onClose: () => void;
  activePath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  role: AppRole;
  title?: string;
  subtitle?: string;
  mobileExtraContent?: React.ReactNode;
};

export function DashboardSidebar({
  open,
  onClose,
  activePath,
  onNavigate,
  onLogout,
  role,
  title = "GeoPulse AI",
  subtitle = "Safety Intelligence",
  mobileExtraContent,
}: DashboardSidebarProps) {
  const navItems = isAnalystRole(role) ? INTERNAL_NAV_ITEMS : getPublicNavItems(role);

  return (
    <>
      {open ? (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-white/[0.06] bg-[#070D1A]/98 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/[0.06] px-6 py-7">
          <h1 className="text-xl font-bold tracking-tight text-cyan-400">{title}</h1>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">{subtitle}</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-3">
          {navItems.map((item, index) => {
            const active = item.path === activePath;
            return (
              <button
                key={item.label}
                onClick={() => {
                  onNavigate(item.path);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? "bg-cyan-500/10 text-cyan-300"
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-cyan-400" : "bg-white/15"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {mobileExtraContent ? (
          <div className="border-t border-white/[0.06] px-3 py-3 lg:hidden">
            {mobileExtraContent}
          </div>
        ) : null}

        <div className="border-t border-white/[0.06] p-3">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/40 transition hover:bg-white/[0.04] hover:text-white/70"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
