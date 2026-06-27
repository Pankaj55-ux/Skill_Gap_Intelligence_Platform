import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Code2,
  FileUp,
  GraduationCap,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton, Skeleton } from "../../components/ui/Skeleton";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { evidenceFormSchema, profileFormSchema, resumeUploadSchema, toProfilePayload, type EvidenceFormValues, type ProfileFormValues, type ResumeUploadValues } from "./profile.schemas";
import { profileService } from "./profile.service";
import type { EvidenceType, SkillEvidence, StudentProfile } from "./profile.types";

const profileQueryKey = queryKeys.profile.me();
const evidenceQueryKey = queryKeys.profile.evidence();
const profileResumesQueryKey = queryKeys.profile.resumes();

const evidenceGroups: Array<{ type: EvidenceType; title: string; icon: typeof Sparkles; empty: string }> = [
  { type: "CODING_PROFILE", title: "Coding Profiles", icon: Code2, empty: "No coding profiles added yet" },
  { type: "PROJECT", title: "Projects", icon: BriefcaseBusiness, empty: "No projects added yet" },
  { type: "CERTIFICATE", title: "Certificates", icon: Award, empty: "No certificates added yet" },
  { type: "OTHER", title: "Achievements", icon: Trophy, empty: "No achievements added yet" },
];

const textOrDash = (value: string | number | null | undefined) => value === null || value === undefined || value === "" ? "—" : String(value);

const listToText = (value: string[] | null | undefined) => value?.join(", ") ?? "";

const defaultProfileValues = (profile: StudentProfile | null): ProfileFormValues => ({
  fullName: profile?.fullName ?? "",
  college: profile?.college ?? "",
  branch: profile?.branch ?? "",
  graduationYear: profile?.graduationYear ?? "",
  targetRole: profile?.targetRole ?? "",
  currentSkillsText: listToText(profile?.currentSkills),
  preferredCompaniesText: listToText(profile?.preferredCompanies),
  resumeUrl: profile?.resumeUrl ?? "",
});

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <CardSkeleton key={index} />)}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, action }: { title: string; icon: typeof User; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs font-semibold text-red-600">{message}</p> : null;
}

function CompletionCard({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <SectionCard title="Profile Completion" icon={Check}>
      <div className="flex items-center gap-5">
        <div
          className="grid h-24 w-24 place-items-center rounded-full"
          style={{ background: `conic-gradient(#2563eb ${safeValue * 3.6}deg, rgba(148,163,184,.22) 0deg)` }}
          aria-label={`Profile completion ${safeValue}%`}
        >
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-2xl font-extrabold dark:bg-slate-900">
            {safeValue}%
          </div>
        </div>
        <div>
          <p className="font-bold text-slate-950 dark:text-white">{safeValue === 100 ? "Profile complete" : "Keep building your profile"}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Completion is calculated by the backend from filled profile fields.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function ProfileView({ profile }: { profile: StudentProfile | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard title="Personal Details" icon={User}>
        <div className="grid gap-3">
          <Field label="Full name" value={textOrDash(profile?.fullName)} />
          <Field label="Email" value={textOrDash(profile?.user.email)} />
        </div>
      </SectionCard>

      <SectionCard title="Education" icon={GraduationCap}>
        <div className="grid gap-3">
          <Field label="College" value={textOrDash(profile?.college)} />
          <Field label="Branch" value={textOrDash(profile?.branch)} />
          <Field label="Graduation year" value={textOrDash(profile?.graduationYear)} />
        </div>
      </SectionCard>

      <SectionCard title="Target Role" icon={Target}>
        <div className="grid gap-3">
          <Field label="Target role" value={textOrDash(profile?.targetRole)} />
          <Field label="Preferred companies" value={profile?.preferredCompanies?.length ? profile.preferredCompanies.join(", ") : "—"} />
        </div>
      </SectionCard>

      <SectionCard title="Skills" icon={Sparkles}>
        {profile?.currentSkills?.length ? (
          <div className="flex flex-wrap gap-2">
            {profile.currentSkills.map((skill) => (
              <span key={skill} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                {skill}
              </span>
            ))}
          </div>
        ) : <EmptyState title="No skills listed yet" description="Edit your profile to add your current skills." />}
      </SectionCard>
    </div>
  );
}

function ProfileEditForm({
  profile,
  onCancel,
  onSaved,
}: {
  profile: StudentProfile | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    mode: "onChange",
    defaultValues: defaultProfileValues(profile),
  });

  useEffect(() => {
    form.reset(defaultProfileValues(profile));
  }, [form, profile]);

  const saveProfile = useMutation({
    mutationFn: (values: ProfileFormValues) => profileService.saveProfile(toProfilePayload(values), Boolean(profile)),
    onSuccess: (savedProfile) => {
      queryClient.setQueryData(profileQueryKey, savedProfile);
      toast.success("Profile saved");
      onSaved();
    },
  });

  const onSubmit = form.handleSubmit((values) => saveProfile.mutate(values));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="label">Full name</span>
          <input className="input" {...form.register("fullName")} />
          <FormError message={form.formState.errors.fullName?.message} />
        </label>
        <label className="block">
          <span className="label">College</span>
          <input className="input" {...form.register("college")} />
          <FormError message={form.formState.errors.college?.message} />
        </label>
        <label className="block">
          <span className="label">Branch</span>
          <input className="input" {...form.register("branch")} />
          <FormError message={form.formState.errors.branch?.message} />
        </label>
        <label className="block">
          <span className="label">Graduation year</span>
          <input className="input" type="number" inputMode="numeric" {...form.register("graduationYear")} />
          <FormError message={form.formState.errors.graduationYear?.message} />
        </label>
        <label className="block md:col-span-2">
          <span className="label">Target role</span>
          <input className="input" placeholder="Frontend Developer, Data Analyst, Cloud Engineer..." {...form.register("targetRole")} />
          <FormError message={form.formState.errors.targetRole?.message} />
        </label>
        <label className="block md:col-span-2">
          <span className="label">Current skills</span>
          <textarea className="input min-h-24" placeholder="React, Node.js, SQL" {...form.register("currentSkillsText")} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Separate skills with commas.</p>
          <FormError message={form.formState.errors.currentSkillsText?.message} />
        </label>
        <label className="block md:col-span-2">
          <span className="label">Preferred companies</span>
          <textarea className="input min-h-20" placeholder="Google, Microsoft, Infosys" {...form.register("preferredCompaniesText")} />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Separate company names with commas.</p>
          <FormError message={form.formState.errors.preferredCompaniesText?.message} />
        </label>
        <label className="block md:col-span-2">
          <span className="label">Resume URL</span>
          <input className="input" placeholder="https://..." {...form.register("resumeUrl")} />
          <FormError message={form.formState.errors.resumeUrl?.message} />
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={saveProfile.isPending}>
          <X className="h-4 w-4" aria-hidden="true" />
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={!form.formState.isValid || saveProfile.isPending}>
          {saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Save profile
        </button>
      </div>
    </form>
  );
}

function ResumeSection({ resumes }: { resumes: Awaited<ReturnType<typeof profileService.listResumes>> }) {
  const queryClient = useQueryClient();
  const form = useForm<ResumeUploadValues>({ resolver: zodResolver(resumeUploadSchema) });

  const uploadResume = useMutation({
    mutationFn: (file: File) => profileService.uploadResume(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileResumesQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.resume.list() });
      toast.success("Resume uploaded and parsing started");
      form.reset();
    },
  });

  const deleteResume = useMutation({
    mutationFn: profileService.deleteResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileResumesQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.resume.list() });
      toast.success("Resume deleted");
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    uploadResume.mutate(values.resume[0]);
  });

  return (
    <SectionCard title="Resume" icon={FileUp}>
      <form onSubmit={onSubmit} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
        <label className="block">
          <span className="label">Upload resume</span>
          <input className="input file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" {...form.register("resume")} />
          <FormError message={form.formState.errors.resume?.message} />
        </label>
        <button type="submit" className="btn-primary mt-4" disabled={uploadResume.isPending}>
          {uploadResume.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileUp className="h-4 w-4" aria-hidden="true" />}
          Upload resume
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {resumes.length === 0 ? <EmptyState title="No resumes uploaded" description="Upload a PDF, DOC, or DOCX resume to enable future analysis." /> : resumes.map((resume) => (
          <div key={resume.id} className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{resume.originalFileName}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {(resume.fileSize / 1024 / 1024).toFixed(2)} MB · {resume.parsingStatus} · {new Date(resume.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <a href={resume.fileUrl} target="_blank" rel="noreferrer" className="btn-secondary">View</a>
              <button type="button" onClick={() => deleteResume.mutate(resume.id)} className="btn-secondary text-red-600 hover:text-red-700" disabled={deleteResume.isPending}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function EvidenceMiniForm() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceFormSchema),
    mode: "onChange",
    defaultValues: {
      skillName: "",
      category: "",
      proficiencyLevel: "BEGINNER",
      evidenceType: "PROJECT",
      evidenceUrl: "",
      description: "",
    },
  });

  const createEvidence = useMutation({
    mutationFn: (values: EvidenceFormValues) => profileService.createEvidence({
      ...values,
      evidenceUrl: values.evidenceUrl?.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: evidenceQueryKey });
      toast.success("Evidence added");
      form.reset();
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Add evidence
      </button>
    );
  }

  return (
    <form onSubmit={form.handleSubmit((values) => createEvidence.mutate(values))} className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="label">Name</span>
          <input className="input" placeholder="React Portfolio, LeetCode, AWS Certificate..." {...form.register("skillName")} />
          <FormError message={form.formState.errors.skillName?.message} />
        </label>
        <label className="block">
          <span className="label">Category</span>
          <input className="input" placeholder="Frontend, Cloud, DSA..." {...form.register("category")} />
          <FormError message={form.formState.errors.category?.message} />
        </label>
        <label className="block">
          <span className="label">Type</span>
          <select className="input" {...form.register("evidenceType")}>
            <option value="PROJECT">Project</option>
            <option value="CERTIFICATE">Certificate</option>
            <option value="CODING_PROFILE">Coding Profile</option>
            <option value="INTERNSHIP">Internship</option>
            <option value="COURSE">Course</option>
            <option value="OTHER">Achievement</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Level</span>
          <select className="input" {...form.register("proficiencyLevel")}>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>
        <label className="block md:col-span-2">
          <span className="label">URL</span>
          <input className="input" placeholder="https://..." {...form.register("evidenceUrl")} />
          <FormError message={form.formState.errors.evidenceUrl?.message} />
        </label>
        <label className="block md:col-span-2">
          <span className="label">Description</span>
          <textarea className="input min-h-24" {...form.register("description")} />
          <FormError message={form.formState.errors.description?.message} />
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary" disabled={createEvidence.isPending}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={!form.formState.isValid || createEvidence.isPending}>
          {createEvidence.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Save evidence
        </button>
      </div>
    </form>
  );
}

function EvidenceCard({ item }: { item: SkillEvidence }) {
  const level = item.proficiencyLevel ?? item.proficiency;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-bold text-slate-950 dark:text-white">{item.skillName}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.category} · {level ?? "Level pending"}</p>
        </div>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-xs font-bold",
          item.verifiedStatus === "VERIFIED" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
          item.verifiedStatus === "REJECTED" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
          item.verifiedStatus === "PENDING" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
        )}>
          {item.verifiedStatus}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.description}</p>
      {item.evidenceUrl ? <a className="mt-3 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700" href={item.evidenceUrl} target="_blank" rel="noreferrer">Open evidence</a> : null}
    </div>
  );
}

function EvidenceSections({ evidence }: { evidence: SkillEvidence[] }) {
  const grouped = useMemo(() => {
    const map = new Map<EvidenceType, SkillEvidence[]>();
    for (const item of evidence) {
      map.set(item.evidenceType, [...(map.get(item.evidenceType) ?? []), item]);
    }
    return map;
  }, [evidence]);

  return (
    <SectionCard title="Skills, Projects & Achievements" icon={BookOpen} action={<EvidenceMiniForm />}>
      <div className="grid gap-4 lg:grid-cols-2">
        {evidenceGroups.map((group) => {
          const Icon = group.icon;
          const items = grouped.get(group.type) ?? [];
          return (
            <div key={group.type} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <Icon className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                <h3 className="font-bold text-slate-950 dark:text-white">{group.title}</h3>
              </div>
              {items.length === 0 ? <EmptyState title={group.empty} description="Use Add evidence to create backend-backed records." /> : (
                <div className="space-y-3">
                  {items.map((item) => <EvidenceCard key={item.id} item={item} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function ProfilePage() {
  const [editing, setEditing] = useState(false);

  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: profileService.getOwnProfile,
    staleTime: queryTimes.medium,
  });
  const evidenceQuery = useQuery({
    queryKey: evidenceQueryKey,
    queryFn: profileService.listEvidence,
    staleTime: queryTimes.medium,
  });
  const resumesQuery = useQuery({
    queryKey: profileResumesQueryKey,
    queryFn: profileService.listResumes,
    staleTime: queryTimes.medium,
  });

  if (profileQuery.isLoading || evidenceQuery.isLoading || resumesQuery.isLoading) return <ProfileSkeleton />;

  if (profileQuery.isError || evidenceQuery.isError || resumesQuery.isError) {
    return (
      <EmptyState
        title="Profile could not be loaded"
        description="Please check your connection and session, then try again."
        icon={<User className="h-8 w-8" />}
      />
    );
  }

  const profile = profileQuery.data ?? null;
  const evidence = evidenceQuery.data ?? [];
  const resumes = resumesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Student Profile</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">
              {profile?.fullName ?? profile?.user.displayName ?? "Build your student profile"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Manage your personal details, education, target role, skills, evidence, resumes, projects, certificates, and achievements from real backend data.
            </p>
          </div>
          {!editing ? (
            <button type="button" onClick={() => setEditing(true)} className="btn-primary self-start">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {profile ? "Edit profile" : "Create profile"}
            </button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <SectionCard title={editing ? "Edit Profile" : "Profile Details"} icon={User}>
          {editing ? (
            <ProfileEditForm profile={profile} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
          ) : (
            <ProfileView profile={profile} />
          )}
        </SectionCard>
        <CompletionCard value={profile?.profileCompletionPercentage ?? 0} />
      </div>

      <ResumeSection resumes={resumes} />
      <EvidenceSections evidence={evidence} />
    </div>
  );
}
