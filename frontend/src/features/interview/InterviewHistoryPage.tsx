import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Eye, History, Play, RotateCcw, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { interviewService } from "./interview.service";
import type { InterviewSession } from "./interview.types";

const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const finalReportScore = (session: InterviewSession) => {
  if (!session.finalReport || typeof session.finalReport !== "object") return null;
  const report = session.finalReport as { averageScore?: unknown };
  return typeof report.averageScore === "number" && Number.isFinite(report.averageScore) ? Math.round(report.averageScore) : null;
};

const sessionScore = (session: InterviewSession) => {
  const reportScore = finalReportScore(session);
  if (reportScore !== null) return reportScore;
  const scores = session.turns.map((turn) => turn.evaluation?.score).filter((score): score is number => typeof score === "number");
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
};

const answeredCount = (session: InterviewSession) => session.turns.filter((turn) => Boolean(turn.answerText)).length;

export function InterviewHistoryPage() {
  const sessionsQuery = useQuery({
    queryKey: queryKeys.interview.sessions(),
    queryFn: interviewService.listSessions,
    staleTime: queryTimes.short,
  });

  if (sessionsQuery.isLoading) {
    return <div className="space-y-6"><CardSkeleton /><div className="grid gap-4 lg:grid-cols-2"><CardSkeleton /><CardSkeleton /></div></div>;
  }

  if (sessionsQuery.isError) {
    return (
      <EmptyState
        title="Interview history could not be loaded"
        description="The backend did not return interview sessions. Please try again after refreshing."
      />
    );
  }

  const sessions = [...(sessionsQuery.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const comparisonData = [...sessions]
    .reverse()
    .map((session, index) => ({
      attempt: `Attempt ${index + 1}`,
      score: sessionScore(session),
      targetRole: session.targetRole,
      date: formatDate(session.createdAt),
    }))
    .filter((item): item is { attempt: string; score: number; targetRole: string; date: string } => item.score !== null);

  if (sessions.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="No interview attempts yet"
          description="Start a real backend interview session and completed results will appear here."
        />
        <div className="flex justify-center">
          <Link to={routePaths.interview} className="btn-primary"><Play className="h-4 w-4" /> Start interview</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Interview History</p>
            <h1 className="mt-2 text-3xl font-extrabold">Review previous interviews</h1>
            <p className="mt-2 text-sm text-blue-100">Compare attempts, open detailed feedback, and retry with the same platform flow.</p>
          </div>
          <Link to={routePaths.interview} className="btn bg-white text-slate-950 hover:bg-blue-50">
            <RotateCcw className="h-4 w-4" /> New interview
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Total Attempts" value={String(sessions.length)} icon={<History className="h-5 w-5" />} />
        <Metric label="Completed" value={String(sessions.filter((session) => session.status === "ENDED").length)} icon={<CalendarClock className="h-5 w-5" />} />
        <Metric label="Best Score" value={comparisonData.length ? String(Math.max(...comparisonData.map((item) => item.score))) : "Pending"} icon={<TrendingUp className="h-5 w-5" />} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Score comparison across attempts</h2>
        {comparisonData.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No evaluated attempts are available for comparison yet.</p>
        ) : (
          <div className="mt-5 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="attempt" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <Tooltip formatter={(value, name, item) => [`${value}`, `${item.payload.targetRole} (${item.payload.date})`]} />
                <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {sessions.map((session) => {
          const score = sessionScore(session);
          const isEnded = session.status === "ENDED";
          return (
            <article key={session.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">{formatDate(session.createdAt)}</p>
                  <h3 className="mt-2 text-xl font-extrabold text-slate-950 dark:text-white">{session.targetRole}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {answeredCount(session)} of {session.turns.length} questions answered
                  </p>
                </div>
                <span className={cn(
                  "rounded-full px-3 py-1 text-xs font-bold",
                  isEnded ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
                )}>
                  {session.status}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <SmallMetric label="Score" value={score === null ? "Pending" : String(score)} />
                <SmallMetric label="Duration" value={`${session.durationMinutes} min`} />
                <SmallMetric label="Turns" value={String(session.turns.length)} />
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link to={`${routePaths.interview}/sessions/${session.id}/results`} className="btn-primary flex-1">
                  <Eye className="h-4 w-4" /> View feedback
                </Link>
                {!isEnded ? (
                  <Link to={`${routePaths.interview}/sessions/${session.id}/arena`} className="btn-secondary flex-1">
                    <Play className="h-4 w-4" /> Resume arena
                  </Link>
                ) : (
                  <Link to={routePaths.interview} className="btn-secondary flex-1">
                    <RotateCcw className="h-4 w-4" /> Retry
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200">{icon}</span>
        <span className="text-2xl font-extrabold text-slate-950 dark:text-white">{value}</span>
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-extrabold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
