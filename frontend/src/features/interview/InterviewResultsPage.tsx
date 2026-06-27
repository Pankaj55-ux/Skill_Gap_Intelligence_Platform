import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Download,
  Lightbulb,
  MessageSquareText,
  RotateCcw,
  Share2,
  Sparkles,
  Target,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type { InterviewEvaluation, InterviewFinalReport, InterviewSession, InterviewSessionTurn } from "./interview.types";

const scoreColor = (score: number) => {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-300";
  if (score >= 60) return "text-amber-600 dark:text-amber-300";
  return "text-rose-600 dark:text-rose-300";
};

const asArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const unique = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const average = (items: Array<number | null | undefined>) => {
  const valid = items.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, item) => sum + item, 0) / valid.length);
};

const readReportFromSession = (session: InterviewSession): InterviewFinalReport | null => {
  if (!session.finalReport || typeof session.finalReport !== "object") return null;
  const report = session.finalReport as Partial<InterviewFinalReport>;
  if (typeof report.averageScore !== "number") return null;
  return {
    targetRole: typeof report.targetRole === "string" ? report.targetRole : session.targetRole,
    status: typeof report.status === "string" ? report.status : session.status,
    totalQuestions: typeof report.totalQuestions === "number" ? report.totalQuestions : session.turns.length,
    answeredQuestions: typeof report.answeredQuestions === "number" ? report.answeredQuestions : session.turns.filter((turn) => turn.answerText).length,
    averageScore: report.averageScore,
    strengths: asArray(report.strengths),
    weaknesses: asArray(report.weaknesses),
    missingConcepts: asArray(report.missingConcepts),
    summary: typeof report.summary === "string" ? report.summary : "",
    transcript: typeof report.transcript === "string" ? report.transcript : "",
  };
};

const evaluationList = (session: InterviewSession): InterviewEvaluation[] => (
  session.turns.map((turn) => turn.evaluation).filter((evaluation): evaluation is InterviewEvaluation => Boolean(evaluation))
);

const reportFallback = (session: InterviewSession): InterviewFinalReport => {
  const evaluations = evaluationList(session);
  return {
    targetRole: session.targetRole,
    status: session.status,
    totalQuestions: session.turns.length,
    answeredQuestions: session.turns.filter((turn) => turn.answerText).length,
    averageScore: average(evaluations.map((evaluation) => evaluation.score)) ?? 0,
    strengths: unique(evaluations.flatMap((evaluation) => evaluation.strengths)),
    weaknesses: unique(evaluations.flatMap((evaluation) => evaluation.weaknesses)),
    missingConcepts: unique(evaluations.flatMap((evaluation) => evaluation.missingConcepts)),
    summary: evaluations.length > 0 ? "This report is calculated from evaluated interview answers." : "No evaluated answers are available yet.",
    transcript: session.turns.map((turn) => `Q${turn.turnNumber}: ${turn.question}\nA: ${turn.answerText ?? "Not answered"}`).join("\n\n"),
  };
};

export function InterviewResultsPage() {
  const { sessionId } = useParams();

  const sessionQuery = useQuery({
    queryKey: queryKeys.interview.session(sessionId),
    queryFn: () => interviewService.getSession(sessionId!),
    enabled: Boolean(sessionId),
    staleTime: queryTimes.short,
  });

  const reportQuery = useQuery({
    queryKey: queryKeys.interview.report(sessionId),
    queryFn: () => interviewService.getSessionReport(sessionId!),
    enabled: Boolean(sessionId),
    retry: 1,
    staleTime: queryTimes.short,
  });

  const session = sessionQuery.data;
  const evaluations = useMemo(() => session ? evaluationList(session) : [], [session]);
  const report = useMemo(() => {
    if (!session) return null;
    return reportQuery.data ?? readReportFromSession(session) ?? reportFallback(session);
  }, [reportQuery.data, session]);

  const scoreBreakdown = useMemo(() => [
    { name: "Final", value: report?.averageScore ?? average(evaluations.map((item) => item.score)) ?? 0, color: "#2563eb" },
    { name: "Technical", value: average(evaluations.map((item) => item.technicalScore)) ?? 0, color: "#7c3aed" },
    { name: "Communication", value: average(evaluations.map((item) => item.communicationScore)) ?? 0, color: "#0891b2" },
    { name: "Confidence", value: average(evaluations.map((item) => item.confidenceScore)) ?? 0, color: "#16a34a" },
  ], [evaluations, report?.averageScore]);

  const practicePlan = useMemo(() => unique(evaluations.flatMap((evaluation) => evaluation.improvementPlan)), [evaluations]);

  const downloadReport = () => {
    if (!session || !report) return;
    const payload = JSON.stringify({ session, report }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `interview-report-${session.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Interview report downloaded");
  };

  const shareReport = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: "Interview report", text: "Interview feedback report", url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Report link copied");
  };

  if (sessionQuery.isLoading || (session && reportQuery.isLoading)) {
    return <div className="space-y-6"><CardSkeleton /><div className="grid gap-4 lg:grid-cols-2"><CardSkeleton /><CardSkeleton /></div><CardSkeleton /></div>;
  }

  if (sessionQuery.isError || !session || !report) {
    return (
      <EmptyState
        title="Interview results could not be loaded"
        description="Open a completed backend interview session to view its feedback report."
      />
    );
  }

  const finalScore = Math.round(report.averageScore);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Interview Summary</p>
            <h1 className="mt-2 text-3xl font-extrabold">{session.targetRole}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              {report.summary || "Backend feedback is available for the evaluated answers in this session."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn bg-white/10 text-white hover:bg-white/20" onClick={downloadReport}>
              <Download className="h-4 w-4" /> Download report
            </button>
            <button type="button" className="btn bg-white/10 text-white hover:bg-white/20" onClick={() => void shareReport()}>
              <Share2 className="h-4 w-4" /> Share
            </button>
            <Link to={routePaths.interview} className="btn bg-white text-slate-950 hover:bg-blue-50">
              <RotateCcw className="h-4 w-4" /> Retry interview
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ScoreCard icon={<Target />} label="Final Score" value={finalScore} />
        <ScoreCard icon={<Brain />} label="Technical Score" value={scoreBreakdown[1].value} />
        <ScoreCard icon={<MessageSquareText />} label="Communication" value={scoreBreakdown[2].value} />
        <ScoreCard icon={<Sparkles />} label="Confidence" value={scoreBreakdown[3].value} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Score Breakdown</h2>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreBreakdown}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis domain={[0, 100]} fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                  {scoreBreakdown.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          <InsightCard title="Strengths" icon={<CheckCircle2 className="h-5 w-5" />} items={report.strengths} tone="success" />
          <InsightCard title="Weaknesses" icon={<AlertTriangle className="h-5 w-5" />} items={report.weaknesses} tone="warning" />
          <InsightCard title="Missing Concepts" icon={<Lightbulb className="h-5 w-5" />} items={report.missingConcepts} tone="danger" />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Question-wise Feedback</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Each card uses the stored answer evaluation from the backend.</p>
          </div>
          <Link to={`${routePaths.interview}/history`} className="btn-secondary">View history</Link>
        </div>

        <div className="mt-5 space-y-4">
          {session.turns.length === 0 ? (
            <EmptyState title="No interview questions yet" description="Question feedback appears after the backend creates and evaluates interview turns." />
          ) : session.turns.map((turn) => <QuestionFeedbackCard key={turn.id} turn={turn} />)}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Suggested Practice Plan</h2>
        {practicePlan.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No improvement plan has been returned by the backend yet.</p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {practicePlan.map((item, index) => (
              <div key={item} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Step {index + 1}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200">{icon}</span>
        <span className={cn("text-3xl font-extrabold", scoreColor(rounded))}>{rounded}</span>
      </div>
      <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${Math.min(100, Math.max(0, rounded))}%` }} />
      </div>
    </div>
  );
}

function InsightCard({ title, icon, items, tone }: { title: string; icon: ReactNode; items: string[]; tone: "success" | "warning" | "danger" }) {
  const toneClass = {
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
    danger: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
  }[tone];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={cn("rounded-2xl p-3", toneClass)}>{icon}</span>
        <h3 className="font-extrabold text-slate-950 dark:text-white">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No items returned.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item}</span>)}
        </div>
      )}
    </div>
  );
}

function QuestionFeedbackCard({ turn }: { turn: InterviewSessionTurn }) {
  const evaluation = turn.evaluation;
  return (
    <article className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-950">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Question {turn.turnNumber}</p>
          <h3 className="mt-2 text-lg font-extrabold text-slate-950 dark:text-white">{turn.question}</h3>
        </div>
        {evaluation ? <span className={cn("rounded-full px-3 py-1 text-sm font-extrabold", scoreColor(evaluation.score), "bg-white dark:bg-slate-900")}>Score {Math.round(evaluation.score)}</span> : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DetailBlock title="Student Answer" body={turn.answerText || "No answer submitted."} />
        <DetailBlock title="AI Feedback" body={evaluation?.summary || "No feedback available yet."} />
      </div>

      <div className="mt-4">
        <p className="text-sm font-bold text-slate-950 dark:text-white">Expected Topics</p>
        {turn.expectedTopics.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No expected topics were returned for this question.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {turn.expectedTopics.map((topic) => <span key={topic} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">{topic}</span>)}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-bold text-slate-950 dark:text-white">Better Answer Suggestion</p>
        {evaluation?.improvementPlan?.length ? (
          <ul className="mt-3 space-y-2">
            {evaluation.improvementPlan.map((item) => <li key={item} className="text-sm leading-6 text-slate-600 dark:text-slate-300">- {item}</li>)}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No better-answer guidance was returned for this answer.</p>
        )}
      </div>
    </article>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-bold text-slate-950 dark:text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
    </div>
  );
}
