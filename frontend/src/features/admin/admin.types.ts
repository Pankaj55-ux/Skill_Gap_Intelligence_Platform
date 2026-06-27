export type AdminResourceKey =
  | "users"
  | "career-roles"
  | "skill-dictionary"
  | "job-descriptions"
  | "courses"
  | "projects"
  | "announcements"
  | "interview-templates"
  | "reports"
  | "audit-history";

export type AdminRole = "STUDENT" | "MENTOR" | "PLACEMENT_OFFICER" | "ADMIN";
export type AdminStatus = "DRAFT" | "ACTIVE" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED" | "SUSPENDED";

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminListParams {
  page: number;
  limit: number;
  search?: string;
  status?: AdminStatus;
  includeDeleted?: boolean;
  role?: AdminRole;
  type?: string;
  level?: string;
  provider?: string;
  targetRole?: string;
}

export type AdminItem = Record<string, unknown> & {
  id?: string;
  title?: string;
  name?: string;
  email?: string;
  displayName?: string;
  status?: AdminStatus;
  role?: AdminRole;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export interface AdminListResponse {
  items: AdminItem[];
  pagination: AdminPagination;
}

export interface AdminResourceSummary {
  key: string;
  label: string;
  readonly: boolean;
}
