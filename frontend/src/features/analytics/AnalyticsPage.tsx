import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Brain,
  CalendarDays,
  Download,
  FileText,
  Gauge,
  GraduationCap,
  LineChart as LineChartIcon,
  ListChecks,
  PieChart as PieChartIcon,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton, Skeleton } from "../../components/ui/Skeleton";
import { useApiQuery } from "../../hooks/useApiQuery";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { useAuthStore } from "../../store/auth.store";
import { cn } from "../../utils/cn";
import { adminService } from "../admin/admin.service";
import type { AdminRole } from "../admin/admin.types";
import { dashboardService } from "../dashboard/dashboard.service";
import type { StudentDashboard } from "../dashboard/dashboard.types";

type TimeRange = "7d" | "30d" | "90d" | "all";

const chartColors = ["#2563eb", "#06b6d4", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

const rangeOptions: Array<{ value: TimeRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

const percent = (value: number | null | undefined) => typeof value === "number" ? `${Math.round(value)}%` : "Not available";
const numberText = (value: number | null | undefined) => typeof value === "number" ? String(Math.round(value)) : "Not available";

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const inRange = (dateValue: string, range: TimeRange) => {
  if (range === "all") return true;
  const parsed = parseDate(dateValue);
  if (!parsed) return true;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return parsed >= cutoff;
};

const formatDate = (value: string) => {
  const parsed = parseDate(value);
  return parsed ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed) : value;
};

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children, className }: { title: string; icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      <div className="mb-5 flex items-center gap-2">
        <span className="text-blue-600 dark:text-blue-300">{icon}</span>
        <h2 className="font-extrabold text-slate-950 dark:text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ title }: { title: string }) {
  return (
    <div className="grid h-72 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-950">
      <EmptyState title={`No ${title} data yet`} description="This chart will populate when the backend has matching analytics records." />
    </div>
  );
}

function ProgressMetric({ label, value, icon, tone = "blue" }: { label: string; value: string; icon: ReactNode; tone?: "blue" | "emerald" | "amber" | "violet" | "rose" | "cyan" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-200",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-200",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-200",
    cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-200",
  };

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-4">
        <span className={cn("rounded-2xl p-3", tones[tone])}>{icon}</span>
        <p className="text-2xl font-extrabold text-slate-950 dark:text-white">{value}</p>
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
    </article>
  );
}

function SkillChips({ title, skills, tone }: { title: string; skills: string[]; tone: "strong" | "weak" }) {
  return (
    <ChartCard title={title} icon={tone === "strong" ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}>
      {skills.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} description="Skill insights are calculated from verified evidence, gap reports, and roadmap progress." />
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-bold",
                tone === "strong"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
              )}
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

const adminRoles: AdminRole[] = ["STUDENT", "MENTOR", "PLACEMENT_OFFICER", "ADMIN"];

function AdminAnalyticsPage() {
  const analyticsQuery = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: async () => {
      const roleResults = await Promise.all(adminRoles.map(async (role) => ({
        role,
        result: await adminService.list("users", { page: 1, limit: 1, role }),
      })));
      const reports = await adminService.list("reports", { page: 1, limit: 100 });
      return { roleResults, reports };
    },
    staleTime: queryTimes.short,
  });

  if (analyticsQuery.isLoading) return <AnalyticsSkeleton />;
  if (analyticsQuery.isError || !analyticsQuery.data) {
    return <EmptyState title="Admin analytics could not be loaded" description="The admin analytics requests did not complete successfully." icon={<AlertTriangle className="h-8 w-8" />} />;
  }

  const roleData = analyticsQuery.data.roleResults.map(({ role, result }) => ({
    role: role === "PLACEMENT_OFFICER" ? "Placement" : role.charAt(0) + role.slice(1).toLowerCase(),
    count: result.pagination.total,
  }));
  const roleCount = (role: AdminRole) => analyticsQuery.data.roleResults.find((item) => item.role === role)?.result.pagination.total ?? 0;
  const totalAccounts = roleData.reduce((sum, item) => sum + item.count, 0);
  const staffAccounts = totalAccounts - roleCount("STUDENT");
  const readinessScores = analyticsQuery.data.reports.items
    .map((report) => Number(report.readinessScore))
    .filter((score) => Number.isFinite(score));
  const readinessData = [
    { range: "0–49", count: readinessScores.filter((score) => score < 50).length },
    { range: "50–74", count: readinessScores.filter((score) => score >= 50 && score < 75).length },
    { range: "75–89", count: readinessScores.filter((score) => score >= 75 && score < 90).length },
    { range: "90–100", count: readinessScores.filter((score) => score >= 90).length },
  ];
  const averageReadiness = readinessScores.length > 0
    ? Math.round(readinessScores.reduce((sum, score) => sum + score, 0) / readinessScores.length)
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Admin Analytics</p>
        <h1 className="mt-2 text-3xl font-extrabold">Platform analytics dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
          Account composition and readiness reporting across the platform.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressMetric label="Total Accounts" value={String(totalAccounts)} icon={<Users className="h-5 w-5" />} />
        <ProgressMetric label="Students" value={String(roleCount("STUDENT"))} icon={<GraduationCap className="h-5 w-5" />} tone="emerald" />
        <ProgressMetric label="Staff Accounts" value={String(staffAccounts)} icon={<ShieldCheck className="h-5 w-5" />} tone="violet" />
        <ProgressMetric label="Average Readiness" value={percent(averageReadiness)} icon={<Gauge className="h-5 w-5" />} tone="amber" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Accounts by Role" icon={<Users className="h-5 w-5" />}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="role" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Readiness Distribution" icon={<BarChart3 className="h-5 w-5" />}>
          {readinessScores.length === 0 ? <ChartEmpty title="readiness distribution" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={readinessData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="range" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </section>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Readiness metrics use the latest {readinessScores.length} of {analyticsQuery.data.reports.pagination.total} accessible reports.
      </p>
    </div>
  );
}

function exportAnalyticsReport(dashboard: StudentDashboard, range: TimeRange) {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), timeRange: range, analytics: dashboard.analytics }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sgip-analytics-${range}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success("Analytics report exported");
}

function StudentAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const dashboardQuery = useApiQuery({
    queryKey: queryKeys.dashboard.student(),
    queryFn: dashboardService.getStudentDashboard,
    staleTime: queryTimes.short,
  });

  const dashboard = dashboardQuery.data;

  const filtered = useMemo(() => {
    if (!dashboard) return null;
    return {
      readinessTrend: dashboard.analytics.trends.placementReadiness.filter((item) => inRange(item.date, timeRange)),
      interviewTrend: dashboard.analytics.charts.interviewPerformance.filter((item) => inRange(item.date, timeRange)),
      weeklyImprovement: dashboard.analytics.trends.weeklyImprovement.filter((item) => inRange(item.week, timeRange)),
      monthlyImprovement: dashboard.analytics.trends.monthlyImprovement.filter((item) => inRange(item.month, timeRange)),
    };
  }, [dashboard, timeRange]);

  if (dashboardQuery.isLoading) return <AnalyticsSkeleton />;

  if (dashboardQuery.isError) {
    return (
      <EmptyState
        title="Analytics dashboard could not be loaded"
        description="The backend analytics API did not respond successfully. Any backend error message was shown as a toast."
        icon={<AlertTriangle className="h-8 w-8" />}
      />
    );
  }

  if (!dashboard || !filtered) {
    return <EmptyState title="No analytics data available" description="Complete profile, resume, interview, and roadmap workflows to populate analytics." />;
  }

  const metrics = dashboard.analytics.metrics;
  const radarData = [
    { metric: "Readiness", value: metrics.currentReadiness ?? 0 },
    { metric: "Resume", value: metrics.resumeScore ?? 0 },
    { metric: "Interview", value: metrics.latestInterviewScore ?? metrics.averageInterviewScore ?? 0 },
    { metric: "Roadmap", value: metrics.roadmapProgress },
    { metric: "Skills", value: Math.min(100, metrics.verifiedSkillsCount * 10) },
  ];

  const hasAnalytics =
    filtered.readinessTrend.length > 0
    || filtered.interviewTrend.length > 0
    || dashboard.analytics.skillDistribution.length > 0
    || dashboard.analytics.charts.roadmapCompletion.length > 0
    || dashboard.analytics.strongSkills.length > 0
    || dashboard.analytics.weakSkills.length > 0
    || metrics.currentReadiness !== null
    || metrics.resumeScore !== null
    || metrics.averageInterviewScore !== null;

  if (!hasAnalytics) {
    return (
      <div className="space-y-4">
        <EmptyState title="No analytics records yet" description="Analytics will appear after you run gap analysis, upload/analyze a resume, complete interviews, and progress your roadmap." />
        <div className="flex justify-center">
          <button type="button" className="btn-secondary" onClick={() => dashboardQuery.refetch()}>
            Refresh analytics
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Analytics Dashboard</p>
            <h1 className="mt-2 text-3xl font-extrabold">Placement readiness intelligence</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Every chart is calculated from backend analytics returned by the dashboard API. Empty charts mean no matching records exist yet.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold">
              <CalendarDays className="h-4 w-4" />
              <select
                className="bg-transparent text-white outline-none [&>option]:text-slate-950"
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value as TimeRange)}
                aria-label="Analytics time range"
              >
                {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" className="btn bg-white text-slate-950 hover:bg-blue-50" onClick={() => exportAnalyticsReport(dashboard, timeRange)}>
              <Download className="h-4 w-4" /> Export report
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProgressMetric label="Current Readiness" value={percent(metrics.currentReadiness)} icon={<Gauge className="h-5 w-5" />} />
        <ProgressMetric label="Resume Score" value={numberText(metrics.resumeScore)} icon={<FileText className="h-5 w-5" />} tone="rose" />
        <ProgressMetric label="Interview Performance" value={numberText(metrics.latestInterviewScore ?? metrics.averageInterviewScore)} icon={<Brain className="h-5 w-5" />} tone="amber" />
        <ProgressMetric label="Roadmap Completion" value={percent(metrics.roadmapProgress)} icon={<ListChecks className="h-5 w-5" />} tone="cyan" />
        <ProgressMetric label="Skill Improvement" value={percent(metrics.weeklyImprovement ?? metrics.monthlyImprovement)} icon={<TrendingUp className="h-5 w-5" />} tone="emerald" />
        <ProgressMetric label="Projects Completed" value={String(metrics.projectsCompleted)} icon={<Sparkles className="h-5 w-5" />} tone="violet" />
        <ProgressMetric label="Courses Completed" value={String(metrics.coursesCompleted)} icon={<BookOpenCheck className="h-5 w-5" />} tone="blue" />
        <ProgressMetric label="Verified Skills" value={String(metrics.verifiedSkillsCount)} icon={<GraduationCap className="h-5 w-5" />} tone="emerald" />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Readiness Trend" icon={<LineChartIcon className="h-5 w-5" />}>
          {filtered.readinessTrend.length === 0 ? <ChartEmpty title="readiness trend" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filtered.readinessTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip labelFormatter={formatDate} />
                  <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Interview Performance Trend" icon={<TrendingUp className="h-5 w-5" />}>
          {filtered.interviewTrend.length === 0 ? <ChartEmpty title="interview performance" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filtered.interviewTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip labelFormatter={formatDate} />
                  <Line type="monotone" dataKey="score" name="Final" stroke="#2563eb" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="technicalScore" name="Technical" stroke="#7c3aed" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="communicationScore" name="Communication" stroke="#0891b2" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="confidenceScore" name="Confidence" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Roadmap Completion" icon={<BarChart3 className="h-5 w-5" />}>
          {dashboard.analytics.charts.roadmapCompletion.length === 0 ? <ChartEmpty title="roadmap completion" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.analytics.charts.roadmapCompletion}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="title" fontSize={11} interval={0} angle={-12} textAnchor="end" height={72} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="completionPercentage" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Skill Distribution" icon={<PieChartIcon className="h-5 w-5" />}>
          {dashboard.analytics.skillDistribution.length === 0 ? <ChartEmpty title="skill distribution" /> : (
            <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.analytics.skillDistribution} dataKey="count" nameKey="category" innerRadius={58} outerRadius={92} paddingAngle={3}>
                      {dashboard.analytics.skillDistribution.map((entry, index) => <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {dashboard.analytics.skillDistribution.map((entry, index) => (
                  <div key={entry.category} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
                    <span className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                      {entry.category}
                    </span>
                    <span className="font-extrabold text-slate-950 dark:text-white">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Skill Improvement" icon={<Target className="h-5 w-5" />}>
          {filtered.weeklyImprovement.length === 0 ? <ChartEmpty title="skill improvement" /> : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filtered.weeklyImprovement}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" fontSize={12} />
                  <YAxis domain={[0, 100]} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="roadmapCompletion" name="Roadmap completion" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="averageInterviewScore" name="Average interview score" fill="#22c55e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Readiness Radar" icon={<Sparkles className="h-5 w-5" />}>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" fontSize={12} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={11} />
                <Radar dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.22} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <SkillChips title="Strong Skills" skills={dashboard.analytics.strongSkills} tone="strong" />
        <SkillChips title="Weak Skills" skills={dashboard.analytics.weakSkills} tone="weak" />
      </section>
    </div>
  );
}

export function AnalyticsPage() {
  const role = useAuthStore((state) => state.user?.role);
  return role === "ADMIN" ? <AdminAnalyticsPage /> : <StudentAnalyticsPage />;
}
