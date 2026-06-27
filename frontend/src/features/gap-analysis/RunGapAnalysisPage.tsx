import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, BriefcaseBusiness, History, Loader2, RefreshCw, SearchX, Target } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { SkillBadges } from "../jobs/components/SkillBadges";
import { gapAnalysisService } from "./gap-analysis.service";

function HistoryList() {
  const historyQuery = useQuery({
    queryKey: queryKeys.gapAnalysis.history(1),
    queryFn: () => gapAnalysisService.history(1, 8),
    staleTime: queryTimes.short,
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <h2 className="font-bold text-slate-950 dark:text-white">History</h2>
        </div>
        <button type="button" onClick={() => historyQuery.refetch()} className="text-sm font-bold text-blue-600 dark:text-blue-300">
          Refresh
        </button>
      </div>

      {historyQuery.isLoading ? (
        <div className="space-y-3"><CardSkeleton /><CardSkeleton /></div>
      ) : historyQuery.isError ? (
        <EmptyState title="History could not be loaded" description="Saved report summaries are loaded from backend search." />
      ) : (historyQuery.data?.items ?? []).length === 0 ? (
        <EmptyState title="No gap analysis history" description="Run your first analysis to create a saved report." />
      ) : (
        <div className="space-y-3">
          {historyQuery.data!.items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
                  {Math.round(item.score ?? 0)}%
                </span>
              </div>
              {item.summary ? <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.summary}</p> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RunGapAnalysisPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const rolesQuery = useQuery({
    queryKey: queryKeys.gapAnalysis.careerRoles(search),
    queryFn: () => gapAnalysisService.listCareerRoles(search),
    staleTime: queryTimes.long,
  });

  const runAnalysis = useMutation({
    mutationFn: gapAnalysisService.run,
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.gapAnalysis.latestResult(), result);
      queryClient.invalidateQueries({ queryKey: queryKeys.gapAnalysis.history(1) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.student() });
      toast.success("Gap analysis completed");
      navigate(`${routePaths.gapAnalysis}/report`);
    },
  });

  const selectedRole = rolesQuery.data?.find((role) => role.id === selectedRoleId);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Gap Analysis</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">Run deterministic readiness analysis.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Select a career role and compare your profile plus skill evidence against backend role requirements.
            </p>
          </div>
          <Link to={`${routePaths.gapAnalysis}/report`} className="btn-secondary self-start">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            View Report
          </Link>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h2 className="font-bold text-slate-950 dark:text-white">Run Analysis</h2>
            </div>
            <button type="button" onClick={() => rolesQuery.refetch()} className="btn-secondary" disabled={rolesQuery.isFetching}>
              <RefreshCw className={cn("h-4 w-4", rolesQuery.isFetching && "animate-spin")} aria-hidden="true" />
              Refresh
            </button>
          </div>

          <label className="block">
            <span className="label">Search target role</span>
            <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Frontend Developer, Data Analyst..." />
          </label>

          {rolesQuery.isLoading ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
          ) : rolesQuery.isError ? (
            <div className="mt-5">
              <EmptyState title="Career roles could not be loaded" description="Please check your session and try again." icon={<SearchX className="h-8 w-8" />} />
            </div>
          ) : (rolesQuery.data ?? []).length === 0 ? (
            <div className="mt-5">
              <EmptyState title="No roles found" description="Try a different search term or clear the search box." />
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(rolesQuery.data ?? []).map((role, index) => (
                <motion.button
                  key={role.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5",
                    selectedRoleId === role.id
                      ? "border-blue-400 bg-blue-50 shadow-card dark:border-blue-700 dark:bg-blue-950/30"
                      : "border-slate-200 bg-slate-50 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-800",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">{role.level}</p>
                      <h3 className="mt-2 font-extrabold text-slate-950 dark:text-white">{role.title}</h3>
                    </div>
                    <BriefcaseBusiness className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{role.description || "No description available."}</p>
                  <div className="mt-4">
                    <SkillBadges skills={role.requiredSkills} limit={5} tone="emerald" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {selectedRole ? `Selected: ${selectedRole.title}` : "Select a target career role to run analysis."}
            </p>
            <button type="button" className="btn-primary" disabled={!selectedRoleId || runAnalysis.isPending} onClick={() => runAnalysis.mutate(selectedRoleId)}>
              {runAnalysis.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              Run Analysis
            </button>
          </div>
        </section>

        <HistoryList />
      </div>
    </div>
  );
}
