import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckCircle2, Milestone, Route, Waypoints } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { roadmapService } from "./roadmap.service";
import { RoadmapItemCard, RoadmapPanel, RoadmapProgressBar, RoadmapSummaryCards, progressForItem } from "./components/RoadmapUi";
import type { RoadmapItem, RoadmapProgress } from "./roadmap.types";

export function RoadmapDetailsPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const updateProgress = useMutation({
    mutationFn: (item: RoadmapItem) => roadmapService.updateProgress({
      roadmapId: id!,
      roadmapItemId: String(item.orderNumber),
      completed: true,
      completionPercentage: 100,
    }),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.roadmap.progress(id) });
      const previous = queryClient.getQueryData<RoadmapProgress>(queryKeys.roadmap.progress(id));
      if (previous) {
        const existing = previous.progress.find((log) => log.roadmapItemId === String(item.orderNumber));
        const nextProgress = existing
          ? previous.progress.map((log) => log.roadmapItemId === String(item.orderNumber) ? { ...log, completed: true, completionPercentage: 100, completedAt: new Date().toISOString() } : log)
          : [...previous.progress, {
              id: `optimistic-${item.orderNumber}`,
              userId: "",
              roadmapId: id!,
              roadmapItemId: String(item.orderNumber),
              completed: true,
              completionPercentage: 100,
              completedAt: new Date().toISOString(),
              notes: null,
              loggedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              status: "ACTIVE",
            }];
        const totalItems = previous.summary.totalItems || roadmapQuery.data?.plan.phases.length || 1;
        const completedItems = nextProgress.filter((log) => log.completed).length;
        queryClient.setQueryData<RoadmapProgress>(queryKeys.roadmap.progress(id), {
          ...previous,
          progress: nextProgress,
          summary: {
            ...previous.summary,
            completedItems,
            overallCompletionPercentage: Math.round((completedItems / totalItems) * 100),
          },
        });
      }
      return { previous };
    },
    onError: (_error, _item, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.roadmap.progress(id), context.previous);
    },
    onSuccess: () => toast.success("Progress updated"),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap.progress(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap.progressList() });
    },
  });

  if (roadmapQuery.isLoading || progressQuery.isLoading) {
    return <div className="space-y-6"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
  }

  if (roadmapQuery.isError || progressQuery.isError || !roadmapQuery.data) {
    return <EmptyState title="Roadmap could not be loaded" description="The roadmap may not exist or may not belong to your account." icon={<Route className="h-8 w-8" />} />;
  }

  const roadmap = roadmapQuery.data;
  const progress = progressQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Link to={routePaths.roadmap} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <button type="button" onClick={() => navigate(`${routePaths.roadmap}/${roadmap.id}/progress`)} className="btn-primary">
          <CheckCircle2 className="h-4 w-4" />
          Progress Tracking
        </button>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">{roadmap.plan.difficulty}</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">{roadmap.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{roadmap.description}</p>
        <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />Target: {new Date(roadmap.targetDate).toLocaleDateString()}</span>
          <span className="inline-flex items-center gap-2"><Milestone className="h-4 w-4" />{roadmap.careerRole.title}</span>
          <span className="inline-flex items-center gap-2"><Waypoints className="h-4 w-4" />Status: {roadmap.status}</span>
        </div>
      </section>

      <RoadmapSummaryCards roadmap={roadmap} progress={progress} />

      <RoadmapPanel title="Timeline" icon={Waypoints}>
        <RoadmapProgressBar value={progress?.summary.overallCompletionPercentage ?? 0} />
        <div className="relative mt-8 space-y-5 before:absolute before:bottom-0 before:left-5 before:top-0 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
          {roadmap.plan.phases.map((item) => (
            <div key={item.orderNumber} className="relative pl-12">
              <span className="absolute left-2 top-6 z-10 grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">{item.orderNumber}</span>
              <RoadmapItemCard
                item={item}
                progress={progressForItem(progress, item.orderNumber)}
                onMarkComplete={(phase) => updateProgress.mutate(phase)}
                updating={updateProgress.isPending}
              />
            </div>
          ))}
        </div>
      </RoadmapPanel>
    </div>
  );
}
