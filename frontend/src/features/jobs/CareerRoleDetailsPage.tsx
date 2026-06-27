import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpenCheck, BriefcaseBusiness, CheckCircle2, FileText, Gauge, Loader2, Map, Sparkles, Target, WandSparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { SkillBadges } from "./components/SkillBadges";
import { jobsService } from "./jobs.service";

function DetailPanel({ title, icon: Icon, children }: { title: string; icon: typeof Target; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
        <h2 className="font-bold text-slate-950 dark:text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function CareerRoleDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const roleQuery = useQuery({
    queryKey: queryKeys.jobs.careerRole(id),
    queryFn: () => jobsService.getCareerRole(id!),
    enabled: Boolean(id),
    staleTime: queryTimes.long,
  });

  const runGapAnalysis = useMutation({
    mutationFn: () => jobsService.runGapAnalysis(id!),
    onSuccess: () => toast.success("Gap analysis completed"),
  });

  const generateRoadmap = useMutation({
    mutationFn: jobsService.generateRoadmap,
    onSuccess: () => {
      toast.success("Roadmap generated");
      navigate(routePaths.roadmap);
    },
  });

  if (roleQuery.isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      </div>
    );
  }

  if (roleQuery.isError || !roleQuery.data) {
    return <EmptyState title="Career role could not be loaded" description="The role may not exist or may not be available to your account." />;
  }

  const role = roleQuery.data;

  return (
    <div className="space-y-6">
      <Link to={routePaths.jobs} className="btn-secondary w-fit">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to roles
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">{role.level}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">{role.title}</h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600 dark:text-slate-300">
              {role.description || "No detailed description has been added for this role yet."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button type="button" onClick={() => runGapAnalysis.mutate()} className="btn-primary" disabled={runGapAnalysis.isPending}>
              {runGapAnalysis.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Gauge className="h-4 w-4" aria-hidden="true" />}
              Run Gap Analysis
            </button>
            <button type="button" onClick={() => generateRoadmap.mutate()} className="btn-secondary" disabled={generateRoadmap.isPending}>
              {generateRoadmap.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Map className="h-4 w-4" aria-hidden="true" />}
              Generate Roadmap
            </button>
            <Link to={routePaths.resume} className="btn-secondary">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Match Resume
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Experience</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">{role.minExperience}+ years</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Required Skills</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">{role.requiredSkills.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Status</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">{role.status}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DetailPanel title="Required Skills" icon={CheckCircle2}>
          <SkillBadges skills={role.requiredSkills} tone="emerald" />
        </DetailPanel>
        <DetailPanel title="Preferred Skills" icon={Sparkles}>
          <SkillBadges skills={role.niceToHaveSkills} tone="blue" />
        </DetailPanel>
        <DetailPanel title="Technologies & Roadmap Tags" icon={WandSparkles}>
          <SkillBadges skills={role.roadmapTags} tone="slate" />
        </DetailPanel>
        <DetailPanel title="Responsibilities" icon={BookOpenCheck}>
          <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
            Responsibilities are not stored as a separate field for career roles yet. Use linked job descriptions for role-specific responsibilities.
          </p>
        </DetailPanel>
      </div>

      <DetailPanel title="Related Job Descriptions" icon={BriefcaseBusiness}>
        <RelatedJobDescriptions roleTitle={role.title} roleSkills={role.requiredSkills} />
      </DetailPanel>
    </div>
  );
}

function RelatedJobDescriptions({ roleTitle, roleSkills }: { roleTitle: string; roleSkills: string[] }) {
  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.relatedJobDescriptions(roleTitle),
    queryFn: jobsService.listJobDescriptions,
    staleTime: queryTimes.long,
  });

  if (jobsQuery.isLoading) return <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>;
  if (jobsQuery.isError) return <EmptyState title="Related job descriptions could not be loaded" />;

  const roleTokens = roleTitle.toLowerCase().split(/\s+/).filter(Boolean);
  const related = (jobsQuery.data ?? []).filter((job) => {
    const text = `${job.title} ${job.description}`.toLowerCase();
    const titleMatch = roleTokens.some((token) => text.includes(token));
    const skillMatch = roleSkills.some((skill) => job.requiredSkills.includes(skill) || job.preferredSkills.includes(skill));
    return titleMatch || skillMatch;
  }).slice(0, 4);

  if (related.length === 0) return <EmptyState title="No related job descriptions found" description="Published job descriptions will appear here when they match this role or its skills." />;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {related.map((job) => (
        <Link key={job.id} to={`${routePaths.jobs}/job-descriptions/${job.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-800">
          <h3 className="font-bold text-slate-950 dark:text-white">{job.title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{job.company}</p>
          <div className="mt-3">
            <SkillBadges skills={job.requiredSkills} tone="emerald" limit={5} />
          </div>
        </Link>
      ))}
    </div>
  );
}
