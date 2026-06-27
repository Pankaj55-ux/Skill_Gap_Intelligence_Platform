import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight, FileText, MapPin, RefreshCw, SearchX, Target } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { usePaginationState } from "../../hooks/usePaginationState";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { JobsFilters } from "./components/JobsFilters";
import { SkillBadges } from "./components/SkillBadges";
import { jobsService } from "./jobs.service";
import type { CareerRole, CareerRoleLevel } from "./jobs.types";

const pageSize = 12;

const sortRoles = (roles: CareerRole[], sort: string) => {
  const copy = [...roles];
  if (sort === "title-desc") return copy.sort((a, b) => b.title.localeCompare(a.title));
  if (sort === "newest") return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (sort === "experience-asc") return copy.sort((a, b) => a.minExperience - b.minExperience || a.title.localeCompare(b.title));
  return copy.sort((a, b) => a.title.localeCompare(b.title));
};

function RoleCard({ role, index }: { role: CareerRole; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.025 }}
      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-card dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">{role.level}</p>
          <h2 className="mt-2 line-clamp-2 text-xl font-extrabold text-slate-950 dark:text-white">{role.title}</h2>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200">
          <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>

      <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
        {role.description || "No description has been added for this career role yet."}
      </p>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="inline-flex items-center gap-2">
          <Target className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {role.minExperience} year(s) minimum experience
        </span>
        {role.industry ? (
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
            {role.industry}
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        <SkillBadges skills={role.requiredSkills} limit={6} />
      </div>

      <Link to={`${routePaths.jobs}/career-roles/${role.id}`} className="btn-secondary mt-5 w-full group-hover:border-blue-200 group-hover:text-blue-700 dark:group-hover:border-blue-800 dark:group-hover:text-blue-300">
        View role details
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </motion.article>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => <CardSkeleton key={index} />)}
    </div>
  );
}

export function CareerRolesListPage() {
  const { page, searchParams, setSearchParams, updateParams: updatePaginationParams } = usePaginationState();
  const search = searchParams.get("search") ?? "";
  const level = searchParams.get("level") ?? "";
  const skill = searchParams.get("skill") ?? "";
  const sort = searchParams.get("sort") ?? "title-asc";

  const careerRoleQuery = useMemo(() => ({
    page,
    pageSize,
    search: search || undefined,
    level: level ? level as CareerRoleLevel : undefined,
    skill: skill || undefined,
  }), [level, page, search, skill]);

  const query = useQuery({
    queryKey: queryKeys.jobs.careerRoles(careerRoleQuery),
    queryFn: () => jobsService.listCareerRoles(careerRoleQuery),
    placeholderData: (previous) => previous,
    staleTime: queryTimes.long,
  });

  const roles = useMemo(() => sortRoles(query.data?.roles ?? [], sort), [query.data?.roles, sort]);
  const pagination = query.data?.pagination;

  const updateParams = (next: { search?: string; level?: CareerRoleLevel | ""; skill?: string; sort?: string; page?: number }) => {
    updatePaginationParams(next);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Career Roles</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">Browse role paths and job descriptions.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Search backend-backed career roles, inspect required skills, and open job descriptions shared by placement teams.
            </p>
          </div>
          <Link to={`${routePaths.jobs}#job-descriptions`} className="btn-secondary self-start">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Job descriptions
          </Link>
        </div>
      </section>

      <JobsFilters
        search={search}
        level={level}
        skill={skill}
        sort={sort}
        onChange={updateParams}
        onReset={() => setSearchParams({ page: "1" })}
      />

      {query.isError ? (
        <EmptyState title="Career roles could not be loaded" description="Please check your session and try again." icon={<SearchX className="h-8 w-8" />} />
      ) : query.isLoading ? (
        <ListSkeleton />
      ) : roles.length === 0 ? (
        <EmptyState title="No career roles found" description="Try adjusting your search, skill, level, or filters." icon={<SearchX className="h-8 w-8" />} />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{pagination?.total ?? roles.length} role(s) found</span>
            <button type="button" onClick={() => query.refetch()} className="inline-flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300" disabled={query.isFetching}>
              <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} aria-hidden="true" />
              Refresh
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role, index) => <RoleCard key={role.id} role={role} index={index} />)}
          </div>

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row">
              <p className="text-sm text-slate-500 dark:text-slate-400">Page {pagination.page} of {pagination.totalPages}</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" disabled={pagination.page <= 1} onClick={() => updateParams({ page: pagination.page - 1 })}>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </button>
                <button type="button" className="btn-secondary" disabled={pagination.page >= pagination.totalPages} onClick={() => updateParams({ page: pagination.page + 1 })}>
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <JobDescriptionPreview />
    </div>
  );
}

function JobDescriptionPreview() {
  const query = useQuery({
    queryKey: queryKeys.jobs.jobDescriptions(),
    queryFn: jobsService.listJobDescriptions,
    staleTime: queryTimes.long,
  });

  return (
    <section id="job-descriptions" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
        <h2 className="text-base font-bold text-slate-950 dark:text-white">Job Description Viewer</h2>
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : query.isError ? (
        <EmptyState title="Job descriptions could not be loaded" description="Please try again after checking your session." />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState title="No job descriptions available" description="Placement teams have not published job descriptions yet." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(query.data ?? []).slice(0, 6).map((job) => (
            <Link key={job.id} to={`${routePaths.jobs}/job-descriptions/${job.id}`} className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-800 dark:hover:bg-blue-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-slate-950 dark:text-white">{job.title}</h3>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    {job.company}
                  </p>
                </div>
                {job.location ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {job.location}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{job.description}</p>
              <div className="mt-4">
                <SkillBadges skills={job.requiredSkills} limit={5} tone="emerald" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
