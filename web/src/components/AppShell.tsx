import { NavLink, Outlet } from "react-router-dom";
import {
  MessageSquare,
  History,
  BookOpen,
  Users,
  Radar,
  GraduationCap,
  Settings,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/useAuth";

const NAV_ITEMS = [
  { to: "/chat", label: "Neuer Fall / Chat", icon: MessageSquare },
  { to: "/cases", label: "Verlauf / Fälle", icon: History },
  { to: "/prompts", label: "Prompts / Bibliothek", icon: BookOpen },
  { to: "/agents", label: "Agenten", icon: Users },
  { to: "/risk-radar", label: "Risiko-Radar", icon: Radar },
  { to: "/knowledge", label: "Wissen", icon: GraduationCap },
  { to: "/settings", label: "Einstellungen", icon: Settings },
];

export function AppShell() {
  const { user, userId, configured, signOut } = useAuth();
  const displayName = user?.email || (configured ? "Nicht angemeldet" : userId);

  return (
    <div className="flex h-screen bg-sand text-ink">
      <aside className="flex w-60 shrink-0 flex-col bg-petrol-900 text-petrol-tint">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-petrol-700">
            <Scale className="h-4 w-4 text-white" strokeWidth={2.2} />
          </div>
          <div className="text-sm font-semibold text-white">
            Labour Relations <span className="font-normal text-petrol-tint">Experte</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-petrol-700 text-white"
                    : "text-petrol-tint hover:bg-petrol-800 hover:text-white"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 border-t border-petrol-700/60 px-4 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-petrol-600 text-[11px] font-semibold text-white">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-white">{displayName}</div>
            <div className="text-[11px] text-petrol-tint/80">Administrator</div>
          </div>
          {configured && user && (
            <button
              onClick={() => signOut()}
              className="text-[11px] text-petrol-tint/70 hover:text-white"
              title="Abmelden"
            >
              Abmelden
            </button>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
