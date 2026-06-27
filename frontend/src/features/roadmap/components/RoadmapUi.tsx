import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, ChevronUp, Clock, FolderKanban, Target, TimerReset } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../../../utils/cn";
import type { ProgressLog, Roadmap, RoadmapItem, RoadmapProgress } from "../roadmap.types";

const priorityClass = {
  HIGH: "bg-red-50 text-red-700 ring-red-100 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900",
  LOW: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-200 dark:ring-blue-900",
  FINAL: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-900",
};

export function RoadmapPanel({ title, icon: Icon, children, action }: { title: string; icon: typeof Target; children: ReactNode; action?: ReactNode }) {
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

export function RoadmapProgressBar({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="flex justify-between text-sm font-semibold text-slate-500 dark:text-slate-400">
        <span>Overall completion</span>
        <span>{safeValue}%</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safeValue}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
        />
      </div>
    </div>
  );
}

export const progressForItem = (progress?: RoadmapProgress, orderNumber?: number): ProgressLog | undefined => {
  if (!progress || typeof orderNumber !== "number") return undefined;
  return progress.progress.find((item) => item.roadmapItemId === String(orderNumber));
};

export function RoadmapSummaryCards({ roadmap, progress }: { roadmap: Roadmap; progress?: RoadmapProgress }) {
  const phases = roadmap.plan.phases ?? [];
  const totalWeeks = phases.reduce((sum, item) => sum + item.estimatedWeeks, 0);
  const totalHours = phases.reduce((sum, item) => sum + item.estimatedHours, 0);
  const completion = progress?.summary.overallCompletionPercentage ?? 0;
  const cards = [
    { label: "Estimated Weeks", value: totalWeeks, icon: Clock },
    { label: "Estimated Hours", value: totalHours, icon: TimerReset },
    { label: "Milestones", value: phases.length, icon: Target },
    { label: "Completion", value: `${completion}%`, icon: CheckCircle2 },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-3 text-3xl font-extrabold text-slate-950 dark:text-white">{card.value}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RoadmapItemCard({
  item,
  progress,
  onMarkComplete,
  updating,
}: {
  item: RoadmapItem;
  progress?: ProgressLog;
  onMarkComplete?: (item: RoadmapItem) => void;
  updating?: boolean;
}) {
  const [expanded, setExpanded] = useState(item.priority === "HIGH");
  const completionPercentage = progress?.completionPercentage ?? (item.completionStatus === "COMPLETED" ? 100 : 0);
  const completed = progress?.completed || completionPercentage === 100 || item.completionStatus === "COMPLETED";

  return (
    <motion.article
      layout
      className={cn(
        "relative rounded-2xl border bg-white p-5 shadow-sm transition dark:bg-slate-900",
        completed ? "border-emerald-200 dark:border-emerald-900" : "border-slate-200 dark:border-slate-800",
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">#{item.orderNumber}</span>
            <span className={cn("rounded-full px-3 py-1 text-xs font-bold ring-1", priorityClass[item.priority])}>{item.priority}</span>
            <span className={cn(
              "rounded-full px-3 py-1 text-xs font-bold",
              completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
            )}>
              {completed ? "COMPLETED" : completionPercentage > 0 ? "IN_PROGRESS" : "NOT_STARTED"}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-extrabold text-slate-950 dark:text-white">{item.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
        </div>

        <div className="flex shrink-0 gap-2">
          {onMarkComplete ? (
            <button type="button" onClick={() => onMarkComplete(item)} className="btn-primary" disabled={completed || updating}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {completed ? "Complete" : "Mark Complete"}
            </button>
          ) : null}
          <button type="button" onClick={() => setExpanded((value) => !value)} className="btn-secondary" aria-expanded={expanded}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Item progress</span>
          <span>{completionPercentage}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <motion.div layout className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" animate={{ width: `${completionPercentage}%` }} />
        </div>
      </div>

      {expanded ? (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-5 grid gap-4 lg:grid-cols-3">
          <Detail title="Skills Covered" items={item.skillsCovered} />
          <Detail title="Projects" items={item.recommendedProjects} icon={<FolderKanban className="h-4 w-4" />} />
          <Detail title="Practice Goals" items={item.practiceGoals} />
        </motion.div>
      ) : null}
    </motion.article>
  );
}

function Detail({ title, items, icon }: { title: string; items: string[]; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">{icon}{title}</h4>
      {items.length === 0 ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No items listed.</p> : (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
