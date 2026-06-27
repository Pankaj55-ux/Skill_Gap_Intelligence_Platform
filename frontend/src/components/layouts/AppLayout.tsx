import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { routePaths } from "../../constants/routes";
import { prefetchCatalog, prefetchNotifications, prefetchStudentHome } from "../../lib/prefetch";
import { useAuth } from "../../providers/AuthProvider";
import { useUiStore } from "../../store/ui.store";
import type { UserRole } from "../../types/auth";
import { cn } from "../../utils/cn";

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  roles?: UserRole[];
};

const navItems: NavItem[] = [
  { label: "Dashboard", to: routePaths.dashboard, icon: LayoutDashboard, roles: ["STUDENT"] },
  { label: "Profile", to: routePaths.profile, icon: User, roles: ["STUDENT"] },
  { label: "Gap Analysis", to: routePaths.gapAnalysis, icon: ClipboardList, roles: ["STUDENT"] },
  { label: "Roadmap", to: routePaths.roadmap, icon: ListChecks, roles: ["STUDENT"] },
  { label: "Projects", to: routePaths.projects, icon: BriefcaseBusiness, roles: ["STUDENT"] },
  { label: "Courses", to: routePaths.courses, icon: BookOpen, roles: ["STUDENT"] },
  { label: "Interview", to: routePaths.interview, icon: Gauge, roles: ["STUDENT"] },
  { label: "Resume", to: routePaths.resume, icon: FileText, roles: ["STUDENT"] },
  { label: "Analytics", to: routePaths.analytics, icon: BarChart3, roles: ["STUDENT", "ADMIN"] },
  { label: "Notifications", to: routePaths.notifications, icon: Bell },
  { label: "Jobs", to: routePaths.jobs, icon: BriefcaseBusiness },
  { label: "Admin", to: routePaths.admin, icon: Shield, roles: ["ADMIN"] },
];

export function AppLayout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const setSidebarOpen = useUiStore((state) => state.setSidebarOpen);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const visibleNavItems = navItems.filter((item) => !item.roles || (user?.role && item.roles.includes(user.role)));
  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate(routePaths.home, { replace: true });
  };

  useEffect(() => {
    if (user?.role === "STUDENT") {
      prefetchStudentHome(queryClient);
    }
    prefetchCatalog(queryClient);
    prefetchNotifications(queryClient);
  }, [queryClient, user?.role]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white p-5 transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="text-lg font-bold">Skill Gap Intelligence</div>
        <nav className="mt-8 space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === routePaths.dashboard}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 sm:px-6">
          <button
            type="button"
            onClick={toggleSidebar}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button type="button" onClick={handleLogout} className="btn-secondary">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
              <span className="sr-only sm:hidden">Log out</span>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
