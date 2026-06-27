import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, History, Loader2, Map, Plus, RefreshCw, Route, SearchX } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { roadmapService } from "./roadmap.service";
import { RoadmapProgressBar, RoadmapSummaryCards } from "./components/RoadmapUi";
import type { Roadmap } from "./roadmap.types";

const roadmapsKey = queryKeys.roadmap.list();
const progressKey = queryKeys.roadmap.progressList();

const isActive = (roadmap: Roadmap) => ["ACTIVE", "IN_PROGRESS", "COMPLETED"].includes(roadmap.status);

export function RoadmapPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const roadmapsQuery = useQuery({
    queryKey: roadmapsKey,
    queryFn: roadmapService.listRoadmaps,
    staleTime: queryTimes.short,
  });
  const progressQuery = useQuery({
    queryKey: progressKey,
    queryFn: roadmapService.listProgress,
    staleTime: queryTimes.short,
  });

  const generateRoadmap = useMutation({
    mutationFn: roadmapService.generate,
    onSuccess: (roadmap) => {
      queryClient.invalidateQueries({ queryKey: roadmapsKey });
      queryClient.invalidateQueries({ queryKey: progressKey });
      queryClient.setQueryData(queryKeys.roadmap.detail(roadmap.id), roadmap);
      toast.success("Roadmap generated");
      navigate(`${routePaths.roadmap}/${roadmap.id}`);
    },
  });

  if (roadmapsQuery.isLoading || progressQuery.isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      </div>
    );
  }

  if (roadmapsQuery.isError || progressQuery.isError) {
    return <EmptyState title="Roadmaps could not be loaded" description="Please check your session and try again." icon={<SearchX className="h-8 w-8" />} />;
  }

  const roadmaps = roadmapsQuery.data ?? [];
  const current = roadmaps.find(isActive) ?? roadmaps[0] ?? null;
  const currentProgress = current ? progressQuery.data?.find((item) => item.roadmapId === current.id) : undefined;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Learning Roadmap</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">Your current learning path.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Follow deterministic roadmap phases generated from your latest gap report and track completion milestone by milestone.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => roadmapsQuery.refetch()} className="btn-secondary" disabled={roadmapsQuery.isFetching}>
              <RefreshCw className={cn("h-4 w-4", roadmapsQuery.isFetching && "animate-spin")} />
              Refresh
            </button>
            <button type="button" onClick={() => generateRoadmap.mutate()} className="btn-primary" disabled={generateRoadmap.isPending}>
              {generateRoadmap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Regenerate Roadmap
            </button>
          </div>
        </div>
      </section>

      {!current ? (
        <EmptyState title="No roadmap yet" description="Run gap analysis first, then generate a roadmap from the latest report." icon={<Route className="h-8 w-8" />} />
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">{current.plan.difficulty}</p>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">{current.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{current.description}</p>
              </div>
              <Link to={`${routePaths.roadmap}/${current.id}`} className="btn-primary self-start">
                View Details
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-5">
              <RoadmapProgressBar value={currentProgress?.summary.overallCompletionPercentage ?? 0} />
            </div>
          </section>

          <RoadmapSummaryCards roadmap={current} progress={currentProgress} />
        </>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          <h2 className="font-bold text-slate-950 dark:text-white">Roadmap History</h2>
        </div>
        {roadmaps.length === 0 ? <EmptyState title="No roadmap history" description="Generated roadmaps will appear here." /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roadmaps.map((roadmap) => {
              const progress = progressQuery.data?.find((item) => item.roadmapId === roadmap.id);
              return (
                <Link key={roadmap.id} to={`${routePaths.roadmap}/${roadmap.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950 dark:text-white">{roadmap.title}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(roadmap.createdAt).toLocaleDateString()} · {roadmap.status}</p>
                    </div>
                    <Map className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-4">
                    <RoadmapProgressBar value={progress?.summary.overallCompletionPercentage ?? 0} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
