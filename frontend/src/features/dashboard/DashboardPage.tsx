import { lazy, Suspense, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Gauge,
  ListChecks,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton, Skeleton } from "../../components/ui/Skeleton";
import { useApiQuery } from "../../hooks/useApiQuery";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { dashboardService } from "./dashboard.service";
import type { StudentDashboard } from "./dashboard.types";

const DashboardCharts = lazy(() => import("./DashboardCharts").then((module) => ({ default: module.DashboardCharts })));
const SkillDistribution = lazy(() => import("./DashboardCharts").then((module) => ({ default: module.SkillDistribution })));

const formatPercent = (value: number | null | undefined) => (
  typeof value === "number" ? `${Math.round(value)}%` : "Not available"
);

const formatNumber = (value: number | null | undefined) => (
  typeof value === "number" ? `${Math.round(value)}` : "Not available"
);

const formatDate = (value: string | null | undefined) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
};

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
    </div>
  );
}

function ScoreRing({ value, label }: { value: number | null; label: string }) {
  const score = typeof value === "number" ? Math.max(0, Math.min(100, Math.round(value))) : 0;
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-20 w-20 place-items-center rounded-full"
        style={{ background: `conic-gradient(#2563eb ${score * 3.6}deg, rgba(148,163,184,.22) 0deg)` }}
        aria-label={`${label}: ${typeof value === "number" ? `${score}%` : "not available"}`}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-lg font-extrabold text-slate-950 dark:bg-slate-900 dark:text-white">
          {typeof value === "number" ? score : "—"}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{typeof value === "number" ? "Calculated from backend data" : "Run required workflows to calculate"}</p>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Gauge;
  tone?: "blue" | "emerald" | "amber" | "violet" | "rose" | "cyan";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-200",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-200",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-200",
    cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-200",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-3 text-2xl font-extrabold text-slate-950 dark:text-white">{value}</p>
        </div>
        <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", tones[tone])}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </article>
  );
}

function DashboardPanel({ title, icon: Icon, children, className }: { title: string; icon: typeof Gauge; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-label={`Progress ${safeValue}%`}>
      <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function SkillChips({ skills, emptyLabel }: { skills: string[]; emptyLabel: string }) {
  if (skills.length === 0) {
    return <EmptyState title={emptyLabel} description="Add evidence, run analysis, or complete roadmap items to populate this list." />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.slice(0, 16).map((skill) => (
        <span key={skill} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          {skill}
        </span>
      ))}
    </div>
  );
}

function OverviewCards({ dashboard }: { dashboard: StudentDashboard }) {
  const metrics = dashboard.analytics.metrics;
  const roleLabel = dashboard.careerRole
    ? `${dashboard.careerRole.title} · ${dashboard.careerRole.level}`
    : dashboard.profile?.profile?.targetRole ?? "Not selected";

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <MetricCard title="Profile Completion" value={formatPercent(dashboard.profileCompletion)} description="Calculated from completed student profile fields." icon={CheckCircle2} tone="emerald" />
      <MetricCard title="Readiness Score" value={formatPercent(dashboard.currentReadinessScore)} description="Latest deterministic gap analysis result." icon={Gauge} />
      <MetricCard title="Current Target Role" value={roleLabel} description="Based on the latest gap report or student profile." icon={BriefcaseBusiness} tone="violet" />
      <MetricCard title="Roadmap Progress" value={formatPercent(dashboard.roadmapProgress.overallCompletionPercentage)} description={`${dashboard.roadmapProgress.completedItems} of ${dashboard.roadmapProgress.totalItems} roadmap items completed.`} icon={ListChecks} tone="cyan" />
      <MetricCard title="Interview Score" value={formatNumber(metrics.latestInterviewScore ?? metrics.averageInterviewScore)} description="Latest available interview evaluation score." icon={Activity} tone="amber" />
      <MetricCard title="Resume Score" value={formatNumber(metrics.resumeScore)} description="Latest resume analysis or resume-job match score." icon={FileText} tone="rose" />
      <MetricCard title="Weak Skills" value={String(metrics.weakSkillsCount)} description="Derived from the latest gap analysis." icon={AlertTriangle} tone="amber" />
      <MetricCard title="Strong Skills" value={String(metrics.strongSkillsCount)} description="Verified and matched skills from backend records." icon={ShieldCheck} tone="emerald" />
    </div>
  );
}

function ActivityAndTasks({ dashboard }: { dashboard: StudentDashboard }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <DashboardPanel title="Recent Activities" icon={Activity}>
        {dashboard.recentActivities.length === 0 ? <EmptyState title="No recent activity" description="Activity will appear after profile, evidence, roadmap, or analysis actions." /> : (
          <div className="space-y-3">
            {dashboard.recentActivities.slice(0, 6).map((activity) => (
              <div key={activity.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{activity.action.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{activity.entityType} · {formatDate(activity.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel title="Notifications" icon={Bell}>
        {dashboard.latestNotifications.length === 0 ? <EmptyState title="No notifications" description="You're all caught up." /> : (
          <div className="space-y-3">
            {dashboard.latestNotifications.slice(0, 6).map((notification) => (
              <div key={notification.id} className="rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-950 dark:bg-blue-950/30">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-200">{notification.type}</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{notification.message}</p>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel title="Upcoming Tasks" icon={CalendarCheck}>
        {dashboard.upcomingGoals.length === 0 ? <EmptyState title="No upcoming tasks" description="Generate or progress a roadmap to see next actions." /> : (
          <div className="space-y-4">
            {dashboard.upcomingGoals.slice(0, 5).map((goal) => (
              <div key={goal.roadmapItemId} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{goal.title}</p>
                  {goal.priority ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-200">{goal.priority}</span> : null}
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {goal.estimatedWeeks ? `${goal.estimatedWeeks} week(s)` : "Duration pending"}
                  {goal.estimatedHours ? ` · ${goal.estimatedHours} hour(s)` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}

function RoadmapSummary({ dashboard }: { dashboard: StudentDashboard }) {
  return (
    <DashboardPanel title="Roadmap Summary" icon={ListChecks}>
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{dashboard.roadmapProgress.title ?? "No active roadmap"}</p>
            <p className="text-sm font-bold text-slate-950 dark:text-white">{formatPercent(dashboard.roadmapProgress.overallCompletionPercentage)}</p>
          </div>
          <div className="mt-3">
            <ProgressBar value={dashboard.roadmapProgress.overallCompletionPercentage} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-xs text-slate-500 dark:text-slate-400">Completed</p>
            <p className="mt-1 text-lg font-bold">{dashboard.roadmapProgress.completedItems}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Items</p>
            <p className="mt-1 text-lg font-bold">{dashboard.roadmapProgress.totalItems}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
            <p className="text-xs text-slate-500 dark:text-slate-400">Projected Readiness</p>
            <p className="mt-1 text-lg font-bold">{formatPercent(dashboard.roadmapProgress.projectedReadinessScore)}</p>
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}

export function DashboardPage() {
  const dashboardQuery = useApiQuery({
    queryKey: queryKeys.dashboard.student(),
    queryFn: dashboardService.getStudentDashboard,
    staleTime: queryTimes.short,
  });

  if (dashboardQuery.isLoading) return <DashboardSkeleton />;

  if (dashboardQuery.isError) {
    return (
      <EmptyState
        title="Dashboard could not be loaded"
        description="Please check your session and try again. The backend error message, if any, was shown as a toast."
        icon={<AlertTriangle className="h-8 w-8" />}
      />
    );
  }

  const dashboard = dashboardQuery.data;
  if (!dashboard) {
    return <EmptyState title="No dashboard data available" description="Create your profile to start building readiness insights." />;
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Student Dashboard</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">
              Welcome{dashboard.profile?.displayName ? `, ${dashboard.profile.displayName}` : ""}.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Every widget below is calculated from backend records. Empty sections mean the related workflow has not produced data yet.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:items-center">
            <ScoreRing value={dashboard.currentReadinessScore} label="Current readiness" />
            <button type="button" onClick={() => dashboardQuery.refetch()} className="btn-secondary self-start lg:self-center" disabled={dashboardQuery.isFetching}>
              <RefreshCw className={cn("h-4 w-4", dashboardQuery.isFetching && "animate-spin")} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <OverviewCards dashboard={dashboard} />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <RoadmapSummary dashboard={dashboard} />
        <Suspense fallback={<CardSkeleton />}>
          <SkillDistribution dashboard={dashboard} />
        </Suspense>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DashboardPanel title="Weak Skills" icon={AlertTriangle}>
          <SkillChips skills={dashboard.analytics.weakSkills} emptyLabel="No weak skills identified yet" />
        </DashboardPanel>
        <DashboardPanel title="Strong Skills" icon={ShieldCheck}>
          <SkillChips skills={dashboard.analytics.strongSkills} emptyLabel="No strong skills identified yet" />
        </DashboardPanel>
      </div>

      <Suspense fallback={<div className="grid gap-4 xl:grid-cols-2"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>}>
        <DashboardCharts dashboard={dashboard} />
      </Suspense>
      <ActivityAndTasks dashboard={dashboard} />
    </div>
  );
}
