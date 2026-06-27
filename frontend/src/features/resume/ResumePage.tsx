import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FileUp,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton, Skeleton } from "../../components/ui/Skeleton";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { resumeService } from "./resume.service";
import type { NormalizedSkill, Resume, ResumeAnalysisResult, ResumeStructuredData } from "./resume.types";
import { validateResumeFile } from "./resume.validation";

const resumesQueryKey = queryKeys.resume.list();
const analysisQueryKey = (resumeId: string) => ["resume", "analysis", resumeId] as const;

const formatFileSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));

function ResumeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  );
}

function Panel({ title, icon: Icon, children, action }: { title: string; icon: typeof FileText; children: ReactNode; action?: ReactNode }) {
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

function UploadZone({
  selectedFile,
  onFileSelected,
  onClear,
  uploadProgress,
  uploading,
}: {
  selectedFile: File | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  uploadProgress: number;
  uploading: boolean;
}) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      className={cn(
        "block cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition",
        dragActive
          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
          : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-blue-800 dark:hover:bg-blue-950/20",
      )}
    >
      <input
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelected(file);
          event.target.value = "";
        }}
      />
      <UploadCloud className="mx-auto h-12 w-12 text-blue-600 dark:text-blue-300" aria-hidden="true" />
      <p className="mt-4 text-lg font-extrabold text-slate-950 dark:text-white">Drag & drop your resume</p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">PDF or DOCX only. Maximum file size: 10 MB.</p>

      {selectedFile ? (
        <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-slate-950 dark:text-white">{selectedFile.name}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedFile.type || "Unknown type"} · {formatFileSize(selectedFile.size)}</p>
            </div>
            <button type="button" onClick={(event) => { event.preventDefault(); onClear(); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Clear selected file">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {uploading ? (
            <div className="mt-4">
              <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Uploading</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </label>
  );
}

function ResumeStatusBadge({ status }: { status: Resume["parsingStatus"] }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
      status === "COMPLETED" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
      status === "FAILED" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
      (status === "PENDING" || status === "PROCESSING") && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200",
    )}>
      {status === "COMPLETED" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock className="h-3.5 w-3.5" aria-hidden="true" />}
      {status}
    </span>
  );
}

function ResumeHistory({
  resumes,
  selectedResumeId,
  onSelect,
  onDelete,
  deletingId,
}: {
  resumes: Resume[];
  selectedResumeId: string | null;
  onSelect: (resume: Resume) => void;
  onDelete: (resume: Resume) => void;
  deletingId: string | null;
}) {
  if (resumes.length === 0) {
    return <EmptyState title="No resume history yet" description="Upload a resume to start parsing and analysis." icon={<FileText className="h-8 w-8" />} />;
  }

  return (
    <div className="space-y-3">
      {resumes.map((resume) => {
        const selected = resume.id === selectedResumeId;
        return (
          <article key={resume.id} className={cn(
            "rounded-2xl border p-4 transition",
            selected ? "border-blue-300 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/30" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950",
          )}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <button type="button" onClick={() => onSelect(resume)} className="min-w-0 text-left">
                <p className="truncate font-bold text-slate-950 dark:text-white">{resume.originalFileName}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatFileSize(resume.fileSize)} · Uploaded {formatDate(resume.uploadedAt)}
                </p>
                <div className="mt-3"><ResumeStatusBadge status={resume.parsingStatus} /></div>
              </button>

              <div className="flex flex-wrap gap-2">
                <a href={resume.fileUrl} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-2">
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  View
                </a>
                <a href={resume.fileUrl} download className="btn-secondary px-3 py-2">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download
                </a>
                <button type="button" onClick={() => onDelete(resume)} className="btn-secondary px-3 py-2 text-red-600 hover:text-red-700" disabled={deletingId === resume.id}>
                  {deletingId === resume.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                  Delete
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MetadataPreview({ resume }: { resume: Resume | null }) {
  if (!resume) {
    return <EmptyState title="No resume selected" description="Select a resume from history to preview metadata." />;
  }

  const fields = [
    ["File name", resume.originalFileName],
    ["MIME type", resume.mimeType],
    ["File size", formatFileSize(resume.fileSize)],
    ["Uploaded", formatDate(resume.uploadedAt)],
    ["Parsing status", resume.parsingStatus],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
      ))}
    </div>
  );
}

function SkillCloud({ skills }: { skills: NormalizedSkill[] }) {
  if (skills.length === 0) {
    return <EmptyState title="No extracted skills yet" description="Run AI analysis after upload to view normalized skills." />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <span key={skill.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200" title={`Original: ${skill.originalSkill}`}>
          {skill.normalizedSkill}
          <span className="ml-1 text-xs font-medium text-slate-400">({Math.round(skill.confidence * 100)}%)</span>
        </span>
      ))}
    </div>
  );
}

function StructuredList({ title, items }: { title: string; items: unknown[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      <h3 className="font-bold text-slate-950 dark:text-white">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No data extracted.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.slice(0, 5).map((item, index) => (
            <pre key={index} className="overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-200">
              {typeof item === "string" ? item : JSON.stringify(item, null, 2)}
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumeSummary({ data }: { data: ResumeStructuredData }) {
  const summaryItems = [
    ["Programming Languages", data.programmingLanguages],
    ["Frameworks", data.frameworks],
    ["Databases", data.databases],
    ["Cloud", data.cloud],
    ["Tools", data.tools],
    ["Soft Skills", data.softSkills],
    ["Certifications", data.certifications],
    ["Achievements", data.achievements],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {summaryItems.map(([title, values]) => (
        <div key={title as string} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="font-bold text-slate-950 dark:text-white">{title as string}</h3>
          {(values as string[]).length === 0 ? (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No data extracted.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {(values as string[]).map((item) => (
                <span key={item} className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">{item}</span>
              ))}
            </div>
          )}
        </div>
      ))}
      <StructuredList title="Projects" items={data.projects} />
      <StructuredList title="Internships" items={data.internships} />
      <StructuredList title="Education" items={data.education} />
    </div>
  );
}

function AnalysisPanel({
  resume,
  analysis,
  analyzing,
  onAnalyze,
}: {
  resume: Resume | null;
  analysis: ResumeAnalysisResult | undefined;
  analyzing: boolean;
  onAnalyze: () => void;
}) {
  return (
    <Panel
      title="Resume Analysis"
      icon={BrainCircuit}
      action={resume ? (
        <button type="button" onClick={onAnalyze} className="btn-primary" disabled={analyzing}>
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <WandSparkles className="h-4 w-4" aria-hidden="true" />}
          {analysis ? "Re-run analysis" : "Run analysis"}
        </button>
      ) : null}
    >
      {!resume ? (
        <EmptyState title="Select a resume to analyze" description="Upload or select a resume from history first." />
      ) : !analysis ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <EmptyState title="No analysis loaded" description="Run AI extraction to view structured resume data." />
          <EmptyState title="No AI summary available yet" description="The current backend returns structured extraction, not a generated prose summary." />
          <EmptyState title="No improvement suggestions yet" description="Suggestions are generated after resume-to-job matching, not from resume upload alone." />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Confidence</p>
              <p className="mt-1 text-xl font-extrabold">{Math.round(analysis.analysis.confidence)}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Model</p>
              <p className="mt-1 break-words text-sm font-bold">{analysis.analysis.aiModel}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prompt</p>
              <p className="mt-1 text-sm font-bold">{analysis.analysis.promptVersion}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Runtime</p>
              <p className="mt-1 text-sm font-bold">{analysis.analysis.executionTimeMs}ms</p>
            </div>
          </div>

          <Panel title="Extracted Skills" icon={Sparkles}>
            <SkillCloud skills={analysis.normalizedSkills} />
          </Panel>

          <Panel title="AI Structured Output" icon={FileCheck2}>
            <ResumeSummary data={analysis.analysis.structuredData} />
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Resume Summary" icon={BrainCircuit}>
              <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">
                {analysis.analysis.structuredData.summary || "No summary could be generated."}
              </p>
            </Panel>
            <Panel title="Improvement Suggestions" icon={WandSparkles}>
              {analysis.analysis.structuredData.improvementSuggestions.length > 0 ? (
                <ul className="space-y-3">
                  {analysis.analysis.structuredData.improvementSuggestions.map((suggestion) => (
                    <li key={suggestion} className="flex gap-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No improvement suggestions generated.</p>
              )}
            </Panel>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function ResumePage() {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resumesQuery = useQuery({
    queryKey: resumesQueryKey,
    queryFn: resumeService.listResumes,
    staleTime: queryTimes.medium,
  });

  const resumes = resumesQuery.data ?? [];
  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === selectedResumeId) ?? resumes[0] ?? null,
    [resumes, selectedResumeId],
  );
  const activeAnalysisQueryKey = selectedResume ? analysisQueryKey(selectedResume.id) : ["resume", "analysis", "none"];
  const analysisQuery = useQuery({
    queryKey: activeAnalysisQueryKey,
    queryFn: () => resumeService.getLatestAnalysis(selectedResume!.id),
    enabled: Boolean(selectedResume),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const analysis = analysisQuery.data ?? undefined;

  const handleFileSelected = (file: File) => {
    const result = validateResumeFile(file);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Invalid resume file");
      return;
    }
    setSelectedFile(file);
    setUploadProgress(0);
  };

  const uploadResume = useMutation({
    mutationFn: (file: File) => resumeService.uploadResume(file, (event) => {
      if (!event.total) return;
      setUploadProgress(Math.round((event.loaded * 100) / event.total));
    }),
    onSuccess: (resume) => {
      queryClient.invalidateQueries({ queryKey: resumesQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.resumes() });
      setSelectedResumeId(resume.id);
      setSelectedFile(null);
      setUploadProgress(100);
      toast.success("Resume uploaded");
    },
  });

  const deleteResume = useMutation({
    mutationFn: resumeService.deleteResume,
    onMutate: (id) => setDeletingId(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: resumesQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.resumes() });
      if (selectedResumeId === id) setSelectedResumeId(null);
      toast.success("Resume deleted");
    },
    onSettled: () => setDeletingId(null),
  });

  const analyzeResume = useMutation({
    mutationFn: (id: string) => resumeService.analyzeResume(id),
    onSuccess: (result, id) => {
      queryClient.setQueryData(analysisQueryKey(id), result);
      toast.success("Resume analysis completed");
    },
  });

  if (resumesQuery.isLoading) return <ResumeSkeleton />;

  if (resumesQuery.isError) {
    return (
      <EmptyState
        title="Resume module could not be loaded"
        description="Please check your session and try again."
        icon={<AlertTriangle className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Resume Module</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">Upload, parse, and analyze resumes.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Manage resume history, validate files before upload, run AI extraction, and review normalized skills from backend data.
            </p>
          </div>
          <button type="button" onClick={() => resumesQuery.refetch()} className="btn-secondary self-start" disabled={resumesQuery.isFetching}>
            <RefreshCw className={cn("h-4 w-4", resumesQuery.isFetching && "animate-spin")} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Resume Upload" icon={FileUp}>
          <UploadZone
            selectedFile={selectedFile}
            onFileSelected={handleFileSelected}
            onClear={() => setSelectedFile(null)}
            uploadProgress={uploadProgress}
            uploading={uploadResume.isPending}
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-primary" disabled={!selectedFile || uploadResume.isPending} onClick={() => selectedFile && uploadResume.mutate(selectedFile)}>
              {uploadResume.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
              Upload Resume
            </button>
            <button type="button" className="btn-secondary" disabled={!selectedFile || uploadResume.isPending} onClick={() => selectedFile && uploadResume.mutate(selectedFile)}>
              Replace Resume
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Replace uploads a new resume version while preserving history. Delete old versions from Resume History when needed.
          </p>
        </Panel>

        <Panel title="Preview Resume Metadata" icon={FileText}>
          <MetadataPreview resume={selectedResume} />
        </Panel>
      </div>

      <Panel title="Resume History" icon={Clock}>
        <ResumeHistory
          resumes={resumes}
          selectedResumeId={selectedResume?.id ?? null}
          onSelect={(resume) => setSelectedResumeId(resume.id)}
          onDelete={(resume) => deleteResume.mutate(resume.id)}
          deletingId={deletingId}
        />
      </Panel>

      <AnalysisPanel
        resume={selectedResume}
        analysis={analysis}
        analyzing={analyzeResume.isPending}
        onAnalyze={() => selectedResume && analyzeResume.mutate(selectedResume.id)}
      />
    </div>
  );
}
