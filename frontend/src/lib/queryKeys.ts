import type { AdminListParams, AdminResourceKey } from "../features/admin/admin.types";
import type { CareerRoleQuery } from "../features/jobs/jobs.types";
import type { ListNotificationsParams } from "../features/notifications/notifications.types";

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => ["auth", "me"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    student: () => ["dashboard", "student"] as const,
  },
  profile: {
    all: ["profile"] as const,
    me: () => ["profile", "me"] as const,
    evidence: () => ["profile", "evidence"] as const,
    resumes: () => ["profile", "resumes"] as const,
  },
  resume: {
    all: ["resume"] as const,
    list: () => ["resume", "list"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    careerRoles: (query: Partial<CareerRoleQuery>) => ["jobs", "career-roles", query] as const,
    careerRole: (id: string | undefined) => ["jobs", "career-role", id] as const,
    jobDescriptions: () => ["jobs", "job-descriptions"] as const,
    jobDescription: (id: string | undefined) => ["jobs", "job-description", id] as const,
    relatedJobDescriptions: (roleTitle: string) => ["jobs", "job-descriptions", "related", roleTitle] as const,
  },
  gapAnalysis: {
    all: ["gap-analysis"] as const,
    latestResult: () => ["gap-analysis", "latest-result"] as const,
    history: (page: number | string) => ["gap-analysis", "history", page] as const,
    careerRoles: (search: string) => ["gap-analysis", "career-roles", search] as const,
  },
  roadmap: {
    all: ["roadmap"] as const,
    list: () => ["roadmap", "list"] as const,
    detail: (id: string | undefined) => ["roadmap", "detail", id] as const,
    progressList: () => ["roadmap", "progress"] as const,
    progress: (id: string | undefined) => ["roadmap", "progress", id] as const,
  },
  projects: {
    all: ["projects"] as const,
    roadmaps: () => ["projects", "roadmaps"] as const,
  },
  courses: {
    all: ["courses"] as const,
    roadmaps: () => ["courses", "roadmaps"] as const,
    recommendations: () => ["courses", "recommendations"] as const,
  },
  interview: {
    all: ["interview"] as const,
    setupResumes: () => ["interview", "setup", "resumes"] as const,
    setupJobs: () => ["interview", "setup", "job-descriptions"] as const,
    sessions: () => ["interview", "sessions"] as const,
    session: (id: string | undefined) => ["interview", "session", id] as const,
    report: (id: string | undefined) => ["interview", "session", id, "report"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (params: ListNotificationsParams) => ["notifications", "list", params] as const,
    detail: (id: string | undefined) => ["notifications", "detail", id] as const,
  },
  admin: {
    all: ["admin"] as const,
    resources: () => ["admin", "resources"] as const,
    resource: (resource: AdminResourceKey, params: AdminListParams) => ["admin", "resource", resource, params] as const,
  },
} as const;
