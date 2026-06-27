import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, History, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { gapAnalysisService } from "./gap-analysis.service";
import { GapReportView } from "./components/GapReportView";
import type { GapAnalysisResult } from "./gap-analysis.types";

export function GapReportPage() {
  const queryClient = useQueryClient();
  const latestResult = queryClient.getQueryData<GapAnalysisResult>(queryKeys.gapAnalysis.latestResult()) ?? null;
  const historyQuery = useQuery({
    queryKey: queryKeys.gapAnalysis.history("report"),
    queryFn: () => gapAnalysisService.history(1, 5),
    staleTime: queryTimes.short,
  });

  const previous = historyQuery.data?.items.find((item) => item.id !== latestResult?.report.id) ?? null;

  if (latestResult) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link to={routePaths.gapAnalysis} className="btn-secondary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Run another analysis
          </Link>
          <button type="button" onClick={() => historyQuery.refetch()} className="btn-secondary" disabled={historyQuery.isFetching}>
            <RefreshCw className={cn("h-4 w-4", historyQuery.isFetching && "animate-spin")} aria-hidden="true" />
            Refresh History
          </button>
        </div>
        <GapReportView result={latestResult} previous={previous} />
      </div>
    );
  }

  if (historyQuery.isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      </div>
    );
  }

  if (historyQuery.isError) {
    return <EmptyState title="Gap report could not be loaded" description="Please check your session and try again." icon={<BarChart3 className="h-8 w-8" />} />;
  }

  const history = historyQuery.data?.items ?? [];
  if (history.length === 0) {
    return (
      <EmptyState
        title="No gap report yet"
        description="Run deterministic gap analysis to create your first report."
        icon={<BarChart3 className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link to={routePaths.gapAnalysis} className="btn-primary w-fit">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Run New Analysis
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Saved Gap Reports</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">History summary</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          The backend currently exposes full report details only when a new analysis is run. Saved history summaries below come from the backend search endpoint.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <h2 className="font-bold text-slate-950 dark:text-white">Report History</h2>
        </div>
        <div className="space-y-3">
          {history.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
                  {Math.round(item.score ?? 0)}% readiness
                </span>
              </div>
              {item.summary ? <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.summary}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
