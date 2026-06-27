import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BriefcaseBusiness, Building2, Clock, FileText, MapPin, Sparkles, Target, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { SkillBadges } from "./components/SkillBadges";
import { jobsService } from "./jobs.service";

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: ReactNode }) {
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

const paragraphsFrom = (text: string) => text
  .split(/\n{2,}|\r\n{2,}/)
  .map((paragraph) => paragraph.trim())
  .filter(Boolean);

export function JobDescriptionPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: queryKeys.jobs.jobDescription(id),
    queryFn: () => jobsService.getJobDescription(id!),
    enabled: Boolean(id),
    staleTime: queryTimes.long,
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><CardSkeleton /><CardSkeleton /></div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <EmptyState title="Job description could not be loaded" description="The job description may not exist or may not be available to your account." />;
  }

  const job = query.data;
  const paragraphs = paragraphsFrom(job.description);

  return (
    <div className="space-y-6">
      <Link to={routePaths.jobs} className="btn-secondary w-fit">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to jobs
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Job Description</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">{job.title}</h1>
            <p className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-slate-600 dark:text-slate-300">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              {job.company}
            </p>
          </div>
          <Link to={routePaths.resume} className="btn-primary self-start">
            <Target className="h-4 w-4" aria-hidden="true" />
            Match Resume
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><MapPin className="h-4 w-4" />Location</p>
          <p className="mt-2 text-lg font-extrabold text-slate-950 dark:text-white">{job.location ?? "Not specified"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Clock className="h-4 w-4" />Experience</p>
          <p className="mt-2 text-lg font-extrabold text-slate-950 dark:text-white">{job.experience ?? "Not specified"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><Users className="h-4 w-4" />Employment</p>
          <p className="mt-2 text-lg font-extrabold text-slate-950 dark:text-white">{job.employmentType ?? "Not specified"}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Formatted Job Description" icon={FileText}>
          {paragraphs.length === 0 ? (
            <EmptyState title="No description content" description="This record does not contain readable job description text." />
          ) : (
            <article className="prose prose-slate max-w-none dark:prose-invert">
              {paragraphs.map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line text-sm leading-7 text-slate-700 dark:text-slate-300">{paragraph}</p>
              ))}
            </article>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Company Information" icon={BriefcaseBusiness}>
            <div className="space-y-3">
              <Info label="Company" value={job.company} />
              <Info label="Location" value={job.location ?? "Not specified"} />
              <Info label="Employment Type" value={job.employmentType ?? "Not specified"} />
              <Info label="Published" value={new Date(job.createdAt).toLocaleDateString()} />
            </div>
          </Panel>

          <Panel title="Required Skills" icon={Target}>
            <SkillBadges skills={job.requiredSkills} tone="emerald" />
          </Panel>

          <Panel title="Preferred Skills" icon={Sparkles}>
            <SkillBadges skills={job.preferredSkills} tone="blue" />
          </Panel>
        </div>
      </div>

      <Panel title="Normalized Skills" icon={Sparkles}>
        {job.normalizedSkills.length === 0 ? (
          <EmptyState title="No normalized skills available" description="Skills will appear here when the backend normalizer has records for this job description." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {job.normalizedSkills.map((skill) => (
              <span key={skill.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" title={`Original: ${skill.originalSkill}`}>
                {skill.normalizedSkill}
                <span className="ml-1 text-xs font-medium text-slate-400">({Math.round(skill.confidence)}%)</span>
              </span>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
