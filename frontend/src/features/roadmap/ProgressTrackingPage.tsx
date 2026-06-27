import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, Save, Target } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { roadmapService } from "./roadmap.service";
import { RoadmapPanel, RoadmapProgressBar, progressForItem } from "./components/RoadmapUi";
import type { RoadmapItem } from "./roadmap.types";

export function ProgressTrackingPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  const roadmapQuery = useQuery({
    queryKey: queryKeys.roadmap.detail(id),
    queryFn: () => roadmapService.getRoadmap(id!),
    enabled: Boolean(id),
    staleTime: queryTimes.short,
  });
  const progressQuery = useQuery({
    queryKey: queryKeys.roadmap.progress(id),
    queryFn: () => roadmapService.getProgress(id!),
    enabled: Boolean(id),
    staleTime: queryTimes.short,
  });

  const saveProgress = useMutation({
    mutationFn: ({ item, percentage }: { item: RoadmapItem; percentage: number }) => roadmapService.updateProgress({
      roadmapId: id!,
      roadmapItemId: String(item.orderNumber),
      completionPercentage: percentage,
      completed: percentage === 100,
    }),
    onSuccess: () => toast.success("Progress saved"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap.progress(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap.progressList() });
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap.list() });
    },
  });

  if (roadmapQuery.isLoading || progressQuery.isLoading) return <div className="space-y-6"><CardSkeleton /><CardSkeleton /></div>;
  if (roadmapQuery.isError || progressQuery.isError || !roadmapQuery.data) {
    return <EmptyState title="Progress could not be loaded" description="Please check this roadmap and try again." />;
  }

  const roadmap = roadmapQuery.data;
  const progress = progressQuery.data;

  const valueFor = (item: RoadmapItem) => {
    const key = String(item.orderNumber);
    return drafts[key] ?? progressForItem(progress, item.orderNumber)?.completionPercentage ?? 0;
  };

  return (
    <div className="space-y-6">
      <Link to={`${routePaths.roadmap}/${roadmap.id}`} className="btn-secondary w-fit">
        <ArrowLeft className="h-4 w-4" />
        Back to Roadmap Details
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Progress Tracking</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">{roadmap.title}</h1>
        <div className="mt-5">
          <RoadmapProgressBar value={progress?.summary.overallCompletionPercentage ?? 0} />
        </div>
      </section>

      <RoadmapPanel title="Milestone Progress" icon={Target}>
        <div className="space-y-4">
          {roadmap.plan.phases.map((item) => {
            const value = valueFor(item);
            const completed = value === 100;
            return (
              <div key={item.orderNumber} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-extrabold text-slate-950 dark:text-white">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.estimatedWeeks} weeks · {item.estimatedHours} hours · {item.priority}</p>
                  </div>
                  <button type="button" className="btn-primary" disabled={saveProgress.isPending || completed} onClick={() => saveProgress.mutate({ item, percentage: 100 })}>
                    {saveProgress.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {completed ? "Completed" : "Mark Complete"}
                  </button>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 flex justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
                    <span>Completion percentage</span>
                    <span>{value}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={value}
                    onChange={(event) => setDrafts((current) => ({ ...current, [item.orderNumber]: Number(event.target.value) }))}
                    className="w-full accent-blue-600"
                  />
                </label>

                <div className="mt-4 flex justify-end">
                  <button type="button" className="btn-secondary" disabled={saveProgress.isPending} onClick={() => saveProgress.mutate({ item, percentage: value })}>
                    <Save className="h-4 w-4" />
                    Save Progress
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </RoadmapPanel>
    </div>
  );
}
