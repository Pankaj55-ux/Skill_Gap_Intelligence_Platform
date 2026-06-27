import { CalendarCheck, LineChart as LineChartIcon, ListChecks, Target, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "../../components/common/EmptyState";
import { cn } from "../../utils/cn";
import type { StudentDashboard } from "./dashboard.types";

const chartColors = ["#2563eb", "#06b6d4", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444"];

const formatDate = (value: string | null | undefined) => {
  if (!value) return "No date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
};

function DashboardPanel({ title, icon: Icon, children, className }: { title: string; icon: typeof Target; children: ReactNode; className?: string }) {
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

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center dark:border-slate-800 dark:bg-slate-950">
      <EmptyState title={`No ${label} data yet`} description="This chart will populate after the related backend workflow creates records." />
    </div>
  );
}

export function SkillDistribution({ dashboard }: { dashboard: StudentDashboard }) {
  const data = dashboard.analytics.skillDistribution;

  return (
    <DashboardPanel title="Skill Distribution" icon={Target}>
      {data.length === 0 ? <EmptyState title="No verified skill categories yet" description="Skill distribution appears after evidence is added and verified." /> : (
        <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="category" innerRadius={56} outerRadius={88} paddingAngle={3} isAnimationActive={false}>
                  {data.map((entry, index) => <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {data.map((entry, index) => (
              <div key={entry.category} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                  {entry.category}
                </span>
                <span className="text-sm font-bold text-slate-950 dark:text-white">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}

export function DashboardCharts({ dashboard }: { dashboard: StudentDashboard }) {
  const readinessTrend = dashboard.analytics.trends.placementReadiness;
  const interviewTrend = dashboard.analytics.charts.interviewPerformance;
  const roadmapProgress = dashboard.analytics.charts.roadmapCompletion;
  const recentLearning = dashboard.weeklyProgress;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <DashboardPanel title="Readiness Trend" icon={TrendingUp}>
        {readinessTrend.length === 0 ? <ChartEmptyState label="readiness trend" /> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={readinessTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={formatDate} />
                <Area type="monotone" dataKey="score" stroke="#2563eb" fill="#2563eb" fillOpacity={0.16} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel title="Interview Trend" icon={LineChartIcon}>
        {interviewTrend.length === 0 ? <ChartEmptyState label="interview trend" /> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={interviewTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={formatDate} />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="technicalScore" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="communicationScore" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel title="Roadmap Progress" icon={ListChecks}>
        {roadmapProgress.length === 0 ? <ChartEmptyState label="roadmap progress" /> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roadmapProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="title" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={70} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="completionPercentage" radius={[8, 8, 0, 0]} fill="#2563eb" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel title="Recent Learning" icon={CalendarCheck}>
        {recentLearning.length === 0 ? <ChartEmptyState label="recent learning" /> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentLearning}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={formatDate} />
                <Bar dataKey="averageCompletionPercentage" name="Average completion %" fill="#06b6d4" radius={[8, 8, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="completedItems" name="Completed items" fill="#22c55e" radius={[8, 8, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
