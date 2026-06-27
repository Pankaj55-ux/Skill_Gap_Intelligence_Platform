import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock, FileText, History, Loader2, Play, RotateCcw, Settings2, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { interviewSetupSchema, type InterviewSetupSchemaValues } from "./interview.schemas";
import { interviewService } from "./interview.service";
import type { InterviewDifficulty, InterviewSetupFormValues, InterviewType } from "./interview.types";

const steps = [
  { id: 0, title: "Role", icon: BriefcaseBusiness },
  { id: 1, title: "Format", icon: Settings2 },
  { id: 2, title: "Context", icon: FileText },
  { id: 3, title: "Review", icon: CheckCircle2 },
];

const defaultValues: InterviewSetupSchemaValues = {
  targetRole: "",
  interviewType: "TECHNICAL",
  difficulty: "MEDIUM",
  questionCount: 8,
  resumeId: "",
  jobDescriptionId: "",
  durationMinutes: 30,
};

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs font-semibold text-red-600">{message}</p> : null;
}

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {steps.map((step) => {
        const Icon = step.icon;
        const active = step.id === currentStep;
        const complete = step.id < currentStep;
        return (
          <div key={step.id} className={cn(
            "rounded-2xl border p-4 transition",
            active || complete ? "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
          )}>
            <div className="flex items-center gap-3">
              <span className={cn(
                "grid h-9 w-9 place-items-center rounded-xl",
                complete ? "bg-emerald-600 text-white" : active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800",
              )}>
                {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Step {step.id + 1}</p>
                <p className="font-bold text-slate-950 dark:text-white">{step.title}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OptionButton<T extends string>({ value, selected, label, description, onClick }: {
  value: T;
  selected: boolean;
  label: string;
  description: string;
  onClick: (value: T) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        "rounded-2xl border p-4 text-left transition hover:-translate-y-0.5",
        selected ? "border-blue-400 bg-blue-50 shadow-card dark:border-blue-700 dark:bg-blue-950/30" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
      )}
    >
      <p className="font-extrabold text-slate-950 dark:text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </button>
  );
}

export function InterviewSetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const form = useForm<InterviewSetupSchemaValues>({
    resolver: zodResolver(interviewSetupSchema),
    mode: "onChange",
    defaultValues,
  });

  const resumesQuery = useQuery({
    queryKey: queryKeys.interview.setupResumes(),
    queryFn: interviewService.listResumes,
    staleTime: queryTimes.medium,
  });
  const jobsQuery = useQuery({
    queryKey: queryKeys.interview.setupJobs(),
    queryFn: interviewService.listJobDescriptions,
    staleTime: queryTimes.long,
  });
  const sessionsQuery = useQuery({
    queryKey: queryKeys.interview.sessions(),
    queryFn: interviewService.listSessions,
    staleTime: queryTimes.short,
  });

  const values = form.watch();
  const selectedResume = resumesQuery.data?.find((resume) => resume.id === values.resumeId);
  const selectedJob = jobsQuery.data?.find((job) => job.id === values.jobDescriptionId);
  const suggestedDuration = Math.max(5, Math.min(180, values.questionCount * (values.difficulty === "HARD" ? 5 : values.difficulty === "MEDIUM" ? 4 : 3)));

  const targetRoles = useMemo(() => Array.from(new Set((jobsQuery.data ?? []).map((job) => job.title))).slice(0, 10), [jobsQuery.data]);

  const startSession = useMutation({
    mutationFn: (data: InterviewSetupFormValues) => interviewService.startSession(data, selectedJob),
    onSuccess: (session) => {
      toast.success("Interview started");
      sessionsQuery.refetch();
      navigate(`/interview/sessions/${session.id}/arena`);
    },
  });

  if (resumesQuery.isLoading || jobsQuery.isLoading || sessionsQuery.isLoading) {
    return <div className="space-y-6"><CardSkeleton /><div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div></div>;
  }

  if (resumesQuery.isError || jobsQuery.isError || sessionsQuery.isError) {
    return <EmptyState title="Interview setup could not be loaded" description="Please check your session and try again." />;
  }

  const next = async () => {
    const fieldsByStep: Array<Array<keyof InterviewSetupSchemaValues>> = [
      ["targetRole"],
      ["interviewType", "difficulty", "questionCount", "durationMinutes"],
      ["resumeId", "jobDescriptionId"],
      [],
    ];
    const ok = await form.trigger(fieldsByStep[step]);
    if (ok) setStep((current) => Math.min(3, current + 1));
  };

  const submit = form.handleSubmit((data) => startSession.mutate(data));

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Interview Setup</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">Configure your interview simulation.</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Select role, format, resume, and job context before starting a backend-powered live interview session.
        </p>
      </section>

      <Stepper currentStep={step} />

      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <AnimatePresence mode="wait">
            {step === 0 ? (
              <motion.div key="role" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Target Role</h2>
                <label className="mt-5 block">
                  <span className="label">Target role</span>
                  <input className="input" placeholder="Frontend Developer, Data Analyst..." {...form.register("targetRole")} />
                  <FieldError message={form.formState.errors.targetRole?.message} />
                </label>
                {targetRoles.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {targetRoles.map((role) => (
                      <button key={role} type="button" onClick={() => form.setValue("targetRole", role, { shouldValidate: true })} className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
                        {role}
                      </button>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            ) : step === 1 ? (
              <motion.div key="format" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Interview Format</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {([
                    ["TECHNICAL", "Technical", "Role skills, projects, problem solving."],
                    ["HR", "HR", "Communication, behavioral stories, motivation."],
                    ["MIXED", "Mixed", "Balanced technical and HR interview."],
                  ] as const).map(([value, label, description]) => (
                    <OptionButton key={value} value={value} selected={values.interviewType === value} label={label} description={description} onClick={(v: InterviewType) => form.setValue("interviewType", v, { shouldValidate: true })} />
                  ))}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {([
                    ["EASY", "Easy", "Foundational questions and confidence building."],
                    ["MEDIUM", "Medium", "Balanced preparation difficulty."],
                    ["HARD", "Hard", "Deeper role-specific interview pressure."],
                  ] as const).map(([value, label, description]) => (
                    <OptionButton key={value} value={value} selected={values.difficulty === value} label={label} description={description} onClick={(v: InterviewDifficulty) => form.setValue("difficulty", v, { shouldValidate: true })} />
                  ))}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="label">Question count</span>
                    <input className="input" type="number" {...form.register("questionCount")} />
                    <FieldError message={form.formState.errors.questionCount?.message} />
                  </label>
                  <label className="block">
                    <span className="label">Estimated duration</span>
                    <input className="input" type="number" {...form.register("durationMinutes")} />
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Suggested: {suggestedDuration} minutes</p>
                    <FieldError message={form.formState.errors.durationMinutes?.message} />
                  </label>
                </div>
              </motion.div>
            ) : step === 2 ? (
              <motion.div key="context" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Resume & Job Context</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="label">Resume</span>
                    <select className="input" {...form.register("resumeId")}>
                      <option value="">No resume</option>
                      {(resumesQuery.data ?? []).map((resume) => <option key={resume.id} value={resume.id}>{resume.originalFileName}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Job Description</span>
                    <select className="input" {...form.register("jobDescriptionId")}>
                      <option value="">No job description</option>
                      {(jobsQuery.data ?? []).map((job) => <option key={job.id} value={job.id}>{job.title} · {job.company}</option>)}
                    </select>
                  </label>
                </div>
              </motion.div>
            ) : (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Review Setup</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Review label="Role" value={values.targetRole} />
                  <Review label="Type" value={values.interviewType} />
                  <Review label="Difficulty" value={values.difficulty} />
                  <Review label="Questions" value={String(values.questionCount)} />
                  <Review label="Duration" value={`${values.durationMinutes} minutes`} />
                  <Review label="Resume" value={selectedResume?.originalFileName ?? "Not selected"} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <button type="button" className="btn-secondary" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || startSession.isPending}>
              Back
            </button>
            {step < 3 ? (
              <button type="button" className="btn-primary" onClick={next}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="submit" className="btn-primary" disabled={!form.formState.isValid || startSession.isPending}>
                {startSession.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start Interview
              </button>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <Preview title="Resume Preview" icon={<UserRound className="h-5 w-5" />}>
            {selectedResume ? (
              <div>
                <p className="font-bold text-slate-950 dark:text-white">{selectedResume.originalFileName}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{(selectedResume.fileSize / 1024 / 1024).toFixed(2)} MB · {selectedResume.parsingStatus}</p>
              </div>
            ) : <p className="text-sm text-slate-500 dark:text-slate-400">No resume selected.</p>}
          </Preview>

          <Preview title="Job Description Preview" icon={<FileText className="h-5 w-5" />}>
            {selectedJob ? (
              <div>
                <p className="font-bold text-slate-950 dark:text-white">{selectedJob.title}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedJob.company}</p>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{selectedJob.description}</p>
              </div>
            ) : <p className="text-sm text-slate-500 dark:text-slate-400">No job description selected.</p>}
          </Preview>

          <Preview title="Previous Interviews" icon={<History className="h-5 w-5" />}>
            {(sessionsQuery.data ?? []).length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No previous interviews yet.</p> : (
              <div className="space-y-3">
                {(sessionsQuery.data ?? []).slice(0, 5).map((session) => (
                  <Link key={session.id} to={`${routePaths.interview}/sessions/${session.id}/results`} className="block rounded-xl bg-slate-50 p-3 transition hover:bg-blue-50 dark:bg-slate-950 dark:hover:bg-blue-950/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950 dark:text-white">{session.targetRole}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(session.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{session.status}</span>
                    </div>
                  </Link>
                ))}
                <Link to={`${routePaths.interview}/history`} className="btn-secondary w-full justify-center">
                  View full history
                </Link>
              </div>
            )}
          </Preview>

          <Preview title="Estimated Duration" icon={<Clock className="h-5 w-5" />}>
            <p className="text-3xl font-extrabold text-slate-950 dark:text-white">{values.durationMinutes} min</p>
            <button type="button" className="btn-secondary mt-3" onClick={() => form.setValue("durationMinutes", suggestedDuration, { shouldValidate: true })}>
              <RotateCcw className="h-4 w-4" />
              Use suggested
            </button>
          </Preview>
        </aside>
      </form>
    </div>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-950 dark:text-white">{value || "—"}</p>
    </div>
  );
}

function Preview({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-300">
        {icon}
        <h2 className="font-bold text-slate-950 dark:text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}
