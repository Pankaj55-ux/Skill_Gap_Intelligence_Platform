import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Download, FileText, Lightbulb, MinusCircle, Target, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
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
import { EmptyState } from "../../../components/common/EmptyState";
import { cn } from "../../../utils/cn";
import type { GapAnalysisResult, GapHistoryItem, GapSkillEntry } from "../gap-analysis.types";

const statusStyles = {
  matched: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-900",
  weak: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900",
  missing: "bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-900",
};

function Panel({ title, icon: Icon, children, action }: { title: string; icon: typeof Target; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <h2 className="font-bold text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReadinessMeter({ score }: { score: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const tone = safeScore >= 75 ? "#22c55e" : safeScore >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-slate-50 p-6 text-center dark:bg-slate-950">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="grid h-40 w-40 place-items-center rounded-full"
        style={{ background: `conic-gradient(${tone} ${safeScore * 3.6}deg, rgba(148,163,184,.22) 0deg)` }}
        aria-label={`Readiness score ${safeScore}%`}
      >
        <div className="grid h-32 w-32 place-items-center rounded-full bg-white dark:bg-slate-900">
          <div>
            <p className="text-4xl font-extrabold text-slate-950 dark:text-white">{safeScore}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">/ 100</p>
          </div>
        </div>
      </motion.div>
      <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Deterministic readiness score</p>
    </div>
  );
}

function SkillChips({ skills, status, empty }: { skills: GapSkillEntry[]; status: "matched" | "weak" | "missing"; empty: string }) {
  if (skills.length === 0) return <EmptyState title={empty} description="This list is calculated from the latest backend gap report." />;

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span key={`${status}-${skill.skillName}`} className={cn("rounded-full px-3 py-1.5 text-xs font-bold ring-1", statusStyles[status])}>
          {skill.skillName}
          <span className="ml-1 opacity-75">{skill.currentLevel} → {skill.requiredLevel}</span>
        </span>
      ))}
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, tone }: { title: string; value: string; icon: typeof Target; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-extrabold text-slate-950 dark:text-white">{value}</p>
        </div>
        <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", tone)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

const downloadReport = (result: GapAnalysisResult) => {
  const payload = {
    title: `${result.report.careerRole.title} Gap Report`,
    generatedAt: result.report.generatedAt,
    readinessScore: result.analysis.readinessScore,
    evidenceCoverage: result.analysis.evidenceCoverage,
    explanation: result.analysis.explanation,
    matchedSkills: result.analysis.matchedSkills,
    weakSkills: result.analysis.weakSkills,
    missingSkills: result.analysis.missingSkills,
    recommendations: result.report.recommendations,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `gap-report-${result.report.id}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function GapReportView({ result, previous }: { result: GapAnalysisResult; previous?: GapHistoryItem | null }) {
  const chartData = [
    { name: "Matched", value: result.analysis.matchedSkills.length, fill: "#22c55e" },
    { name: "Weak", value: result.analysis.weakSkills.length, fill: "#f59e0b" },
    { name: "Missing", value: result.analysis.missingSkills.length, fill: "#ef4444" },
  ];
  const componentData = Object.entries(result.analysis.componentScores).map(([name, value]) => ({
    name: name.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
    value,
    max: result.analysis.weights[name as keyof typeof result.analysis.weights],
  }));
  const previousScore = previous?.score ?? null;
  const scoreDelta = typeof previousScore === "number"
    ? Math.round((result.analysis.readinessScore - previousScore) * 100) / 100
    : null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Gap Report</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">{result.report.careerRole.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{result.analysis.explanation}</p>
          </div>
          <button type="button" onClick={() => downloadReport(result)} className="btn-secondary self-start">
            <Download className="h-4 w-4" aria-hidden="true" />
            Download Report
          </button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Readiness Score" value={`${Math.round(result.analysis.readinessScore)}%`} icon={Target} tone="bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200" />
        <MetricCard title="Matched Skills" value={String(result.analysis.matchedSkills.length)} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200" />
        <MetricCard title="Weak Skills" value={String(result.analysis.weakSkills.length)} icon={MinusCircle} tone="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-200" />
        <MetricCard title="Missing Skills" value={String(result.analysis.missingSkills.length)} icon={AlertTriangle} tone="bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-200" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Circular Readiness Meter" icon={Target}>
          <ReadinessMeter score={result.analysis.readinessScore} />
        </Panel>

        <Panel title="Skill Comparison Chart" icon={TrendingUp}>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Scoring Progress Bars" icon={FileText}>
        <div className="grid gap-4 md:grid-cols-2">
          {componentData.map((item) => (
            <div key={item.name} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-bold text-slate-700 dark:text-slate-200">{item.name}</span>
                <span className="font-extrabold text-slate-950 dark:text-white">{item.value}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }} className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Strengths" icon={CheckCircle2}>
          <SkillChips skills={result.analysis.matchedSkills} status="matched" empty="No matched strengths yet" />
        </Panel>
        <Panel title="Weak Skills" icon={MinusCircle}>
          <SkillChips skills={result.analysis.weakSkills} status="weak" empty="No weak skills identified" />
        </Panel>
        <Panel title="Missing Skills" icon={AlertTriangle}>
          <SkillChips skills={result.analysis.missingSkills} status="missing" empty="No missing skills identified" />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Overall Recommendation" icon={Lightbulb}>
          {result.report.recommendations.length === 0 ? (
            <EmptyState title="No recommendations generated" description="The report did not return missing or weak skill recommendations." />
          ) : (
            <div className="space-y-3">
              {result.report.recommendations.map((recommendation) => (
                <div key={recommendation.skillName} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                  <p className="font-bold text-slate-950 dark:text-white">{recommendation.skillName}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{recommendation.reason}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Compare Previous Results" icon={TrendingUp}>
          {scoreDelta === null ? (
            <EmptyState title="No previous comparable report" description="Run another analysis later to compare readiness movement." />
          ) : (
            <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-950">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Previous readiness</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950 dark:text-white">{Math.round(previousScore!)}%</p>
              <p className={cn("mt-3 text-sm font-bold", scoreDelta >= 0 ? "text-emerald-600" : "text-red-600")}>
                {scoreDelta >= 0 ? "+" : ""}{scoreDelta}% compared with previous saved result
              </p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
