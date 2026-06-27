import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArchiveRestore,
  BookOpenCheck,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Megaphone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useState, type ComponentType, type ReactNode } from "react";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { adminService } from "./admin.service";
import type { AdminItem, AdminResourceKey, AdminRole, AdminStatus } from "./admin.types";

type FieldKind = "text" | "textarea" | "number" | "select" | "json" | "date";

interface FieldConfig {
  key: string;
  label: string;
  kind?: FieldKind;
  options?: string[];
  required?: boolean;
}

interface ResourceUiConfig {
  key: AdminResourceKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  columns: string[];
  fields: FieldConfig[];
  readonly?: boolean;
  canCreate?: boolean;
}

const statuses: AdminStatus[] = ["DRAFT", "ACTIVE", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "SUSPENDED"];
const roles: AdminRole[] = ["STUDENT", "MENTOR", "PLACEMENT_OFFICER", "ADMIN"];
const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const difficulties = ["EASY", "MEDIUM", "HARD", "BEGINNER", "INTERMEDIATE", "ADVANCED"];
const pageSize = 10;

const resourceConfigs: ResourceUiConfig[] = [
  {
    key: "users",
    label: "Users",
    icon: Users,
    description: "Manage platform users, roles, and account status.",
    canCreate: false,
    columns: ["displayName", "email", "role", "status", "createdAt"],
    fields: [
      { key: "displayName", label: "Display Name", required: true },
      { key: "role", label: "Role", kind: "select", options: roles },
      { key: "status", label: "Status", kind: "select", options: statuses },
      { key: "metadata", label: "Metadata", kind: "json" },
    ],
  },
  {
    key: "career-roles",
    label: "Career Roles",
    icon: BriefcaseBusiness,
    description: "Maintain role catalogs and skill requirements.",
    columns: ["title", "level", "industry", "status", "createdAt"],
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "level", label: "Level", kind: "select", options: levels },
      { key: "requiredSkills", label: "Required Skills", kind: "json" },
      { key: "niceToHaveSkills", label: "Nice To Have Skills", kind: "json" },
      { key: "minExperience", label: "Minimum Experience", kind: "number" },
      { key: "roadmapTags", label: "Roadmap Tags", kind: "json" },
      { key: "industry", label: "Industry" },
      { key: "status", label: "Status", kind: "select", options: statuses },
    ],
  },
  {
    key: "skill-dictionary",
    label: "Skill Dictionary",
    icon: GraduationCap,
    description: "Curate canonical skills used by normalization and matching.",
    columns: ["name", "normalizedName", "category", "status", "createdAt"],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "normalizedName", label: "Normalized Name", required: true },
      { key: "category", label: "Category" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "status", label: "Status", kind: "select", options: statuses },
    ],
  },
  {
    key: "job-descriptions",
    label: "Job Descriptions",
    icon: FileText,
    description: "Manage imported and manually entered job descriptions.",
    columns: ["title", "company", "employmentType", "status", "createdAt"],
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "company", label: "Company", required: true },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "requiredSkills", label: "Required Skills", kind: "json" },
      { key: "preferredSkills", label: "Preferred Skills", kind: "json" },
      { key: "experience", label: "Experience" },
      { key: "location", label: "Location" },
      { key: "employmentType", label: "Employment Type" },
      { key: "uploadedBy", label: "Uploaded By User ID" },
      { key: "status", label: "Status", kind: "select", options: statuses },
    ],
  },
  {
    key: "courses",
    label: "Courses",
    icon: BookOpenCheck,
    description: "Maintain reusable course catalog entries.",
    columns: ["title", "provider", "level", "status", "createdAt"],
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "provider", label: "Provider", required: true },
      { key: "level", label: "Level", kind: "select", options: levels },
      { key: "duration", label: "Duration" },
      { key: "url", label: "URL" },
      { key: "skillsCovered", label: "Skills Covered", kind: "json" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "status", label: "Status", kind: "select", options: statuses },
    ],
  },
  {
    key: "projects",
    label: "Projects",
    icon: ClipboardList,
    description: "Maintain project recommendations and practice catalog items.",
    columns: ["title", "difficulty", "estimatedWeeks", "status", "createdAt"],
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "difficulty", label: "Difficulty", kind: "select", options: difficulties },
      { key: "estimatedWeeks", label: "Estimated Weeks", kind: "number" },
      { key: "skillsCovered", label: "Skills Covered", kind: "json" },
      { key: "githubTopics", label: "GitHub Topics", kind: "json" },
      { key: "learningOutcome", label: "Learning Outcome", kind: "textarea" },
      { key: "status", label: "Status", kind: "select", options: statuses },
    ],
  },
  {
    key: "announcements",
    label: "Announcements",
    icon: Megaphone,
    description: "Publish admin announcements by role and time window.",
    columns: ["title", "targetRole", "status", "startsAt", "createdAt"],
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "message", label: "Message", kind: "textarea", required: true },
      { key: "targetRole", label: "Target Role", kind: "select", options: roles },
      { key: "startsAt", label: "Starts At", kind: "date" },
      { key: "expiresAt", label: "Expires At", kind: "date" },
      { key: "status", label: "Status", kind: "select", options: statuses },
    ],
  },
  {
    key: "interview-templates",
    label: "Interview Templates",
    icon: Settings2,
    description: "Manage reusable interview templates, questions, and expected topics.",
    columns: ["title", "targetRole", "difficulty", "status", "createdAt"],
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "targetRole", label: "Target Role", required: true },
      { key: "difficulty", label: "Difficulty", kind: "select", options: difficulties },
      { key: "questions", label: "Questions", kind: "json" },
      { key: "expectedTopics", label: "Expected Topics", kind: "json" },
      { key: "status", label: "Status", kind: "select", options: statuses },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: LayoutDashboard,
    description: "Review generated reports. Reports are read-only in this console.",
    columns: ["id", "readinessScore", "status", "createdAt"],
    fields: [],
    readonly: true,
  },
  {
    key: "audit-history",
    label: "Audit Logs",
    icon: History,
    description: "Inspect administrative and system audit history.",
    columns: ["action", "entityType", "entityId", "createdAt"],
    fields: [],
    readonly: true,
  },
];

const configByKey = Object.fromEntries(resourceConfigs.map((config) => [config.key, config])) as Record<AdminResourceKey, ResourceUiConfig>;

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const isDeleted = (item: AdminItem) => Boolean(item.deletedAt) || item.status === "ARCHIVED";

const initialFormState = (config: ResourceUiConfig, item?: AdminItem | null) => Object.fromEntries(
  config.fields.map((field) => {
    const value = item?.[field.key];
    if (field.kind === "json") return [field.key, value === undefined ? "" : JSON.stringify(value, null, 2)];
    if (field.kind === "date" && typeof value === "string") return [field.key, value.slice(0, 16)];
    return [field.key, value === undefined || value === null ? "" : String(value)];
  }),
) as Record<string, string>;

const parseForm = (config: ResourceUiConfig, values: Record<string, string>) => {
  const body: Record<string, unknown> = {};
  for (const field of config.fields) {
    const raw = values[field.key];
    if (raw === undefined || raw === "") continue;
    if (field.kind === "number") body[field.key] = Number(raw);
    else if (field.kind === "json") body[field.key] = JSON.parse(raw);
    else if (field.kind === "date") body[field.key] = new Date(raw).toISOString();
    else body[field.key] = raw;
  }
  return body;
};

export function AdminPage() {
  const queryClient = useQueryClient();
  const [resource, setResource] = useState<AdminResourceKey>("users");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminStatus | "">("");
  const [role, setRole] = useState<AdminRole | "">("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: "delete" | "restore"; item: AdminItem } | null>(null);
  const config = configByKey[resource];

  const listParams = useMemo(() => ({
    page,
    limit: pageSize,
    search,
    status: status || undefined,
    role: resource === "users" && role ? role : undefined,
    includeDeleted,
  }), [includeDeleted, page, resource, role, search, status]);

  const resourcesQuery = useQuery({
    queryKey: queryKeys.admin.resources(),
    queryFn: adminService.listResources,
    staleTime: queryTimes.long,
  });

  const listQuery = useQuery({
    queryKey: queryKeys.admin.resource(resource, listParams),
    queryFn: () => adminService.list(resource, listParams),
    staleTime: queryTimes.short,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });

  const createItem = useMutation({
    mutationFn: (body: Record<string, unknown>) => adminService.create(resource, body),
    onSuccess: () => {
      toast.success("Item created");
      setCreating(false);
      invalidate();
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => adminService.update(resource, id, body),
    onSuccess: () => {
      toast.success("Item updated");
      setEditingItem(null);
      invalidate();
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, nextRole }: { id: string; nextRole: AdminRole }) => adminService.updateUserRole(id, nextRole),
    onSuccess: () => {
      toast.success("User role updated");
      invalidate();
    },
  });

  const softDelete = useMutation({
    mutationFn: ({ id }: { id: string }) => adminService.softDelete(resource, id),
    onSuccess: () => {
      toast.success("Item archived");
      setConfirmAction(null);
      invalidate();
    },
  });

  const restore = useMutation({
    mutationFn: ({ id }: { id: string }) => adminService.restore(resource, id),
    onSuccess: () => {
      toast.success("Item restored");
      setConfirmAction(null);
      invalidate();
    },
  });

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const selectResource = (next: AdminResourceKey) => {
    setResource(next);
    setPage(1);
    setSearch("");
    setSearchInput("");
    setStatus("");
    setRole("");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Admin Console</p>
            <h1 className="mt-2 text-3xl font-extrabold">Platform operations dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Manage platform resources through admin-only backend APIs. Server authorization remains enforced on every request.
            </p>
          </div>
          {!config.readonly && config.canCreate !== false ? (
            <button type="button" className="btn bg-white text-slate-950 hover:bg-blue-50" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Create {config.label}
            </button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Database className="h-4 w-4" /> Modules
          </div>
          {resourcesQuery.isLoading ? <CardSkeleton /> : (
            <nav className="space-y-1">
              {resourceConfigs.map((item) => {
                const Icon = item.icon;
                const supported = !resourcesQuery.data || resourcesQuery.data.some((backendResource) => backendResource.key === item.key);
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={!supported}
                    onClick={() => selectResource(item.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition",
                      resource === item.key ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-950",
                      !supported && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.readonly ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">Read</span> : null}
                  </button>
                );
              })}
            </nav>
          )}
        </aside>

        <main className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950 dark:text-white">{config.label}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{config.description}</p>
              </div>
              <form onSubmit={submitSearch} className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className="input pl-9" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search records" />
                </div>
                <button type="submit" className="btn-primary">Search</button>
              </form>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <select className="input" value={status} onChange={(event) => { setStatus(event.target.value as AdminStatus | ""); setPage(1); }}>
                <option value="">All statuses</option>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              {resource === "users" ? (
                <select className="input" value={role} onChange={(event) => { setRole(event.target.value as AdminRole | ""); setPage(1); }}>
                  <option value="">All roles</option>
                  {roles.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              ) : <div />}
              <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                <input type="checkbox" checked={includeDeleted} onChange={(event) => { setIncludeDeleted(event.target.checked); setPage(1); }} />
                Include deleted
              </label>
              <button type="button" className="btn-secondary justify-center" onClick={() => { setSearch(""); setSearchInput(""); setStatus(""); setRole(""); setIncludeDeleted(false); setPage(1); }}>
                Clear filters
              </button>
            </div>
          </section>

          <ResourceTable
            config={config}
            items={listQuery.data?.items ?? []}
            isLoading={listQuery.isLoading}
            isError={listQuery.isError}
            onEdit={setEditingItem}
            onDelete={(item) => setConfirmAction({ action: "delete", item })}
            onRestore={(item) => setConfirmAction({ action: "restore", item })}
            onRoleChange={(item, nextRole) => item.id && updateRole.mutate({ id: item.id, nextRole })}
            onStatusChange={(item, nextStatus) => item.id && updateItem.mutate({ id: item.id, body: { status: nextStatus } })}
            busy={updateItem.isPending || updateRole.isPending || softDelete.isPending || restore.isPending}
          />

          {listQuery.data ? (
            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Page {listQuery.data.pagination.page} of {Math.max(1, listQuery.data.pagination.totalPages)} · {listQuery.data.pagination.total} records
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button type="button" className="btn-secondary" disabled={page >= listQuery.data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      {(creating || editingItem) ? (
        <AdminFormModal
          title={creating ? `Create ${config.label}` : `Edit ${config.label}`}
          config={config}
          item={editingItem}
          isSubmitting={createItem.isPending || updateItem.isPending}
          onClose={() => { setCreating(false); setEditingItem(null); }}
          onSubmit={(body) => {
            if (editingItem?.id) updateItem.mutate({ id: editingItem.id, body });
            else createItem.mutate(body);
          }}
        />
      ) : null}

      {confirmAction ? (
        <ConfirmModal
          title={confirmAction.action === "delete" ? "Archive this record?" : "Restore this record?"}
          description={confirmAction.action === "delete" ? "This performs a backend soft delete and keeps audit history intact." : "This restores the record to ACTIVE status."}
          confirmLabel={confirmAction.action === "delete" ? "Archive" : "Restore"}
          danger={confirmAction.action === "delete"}
          isSubmitting={softDelete.isPending || restore.isPending}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            const id = confirmAction.item.id;
            if (!id) return;
            if (confirmAction.action === "delete") softDelete.mutate({ id });
            else restore.mutate({ id });
          }}
        />
      ) : null}
    </div>
  );
}

function ResourceTable({
  config,
  items,
  isLoading,
  isError,
  onEdit,
  onDelete,
  onRestore,
  onRoleChange,
  onStatusChange,
  busy,
}: {
  config: ResourceUiConfig;
  items: AdminItem[];
  isLoading: boolean;
  isError: boolean;
  onEdit: (item: AdminItem) => void;
  onDelete: (item: AdminItem) => void;
  onRestore: (item: AdminItem) => void;
  onRoleChange: (item: AdminItem, nextRole: AdminRole) => void;
  onStatusChange: (item: AdminItem, nextStatus: AdminStatus) => void;
  busy: boolean;
}) {
  if (isLoading) return <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>;
  if (isError) return <EmptyState title="Admin records could not be loaded" description="The backend rejected or failed this request. Server authorization is still enforced." />;
  if (items.length === 0) return <EmptyState title={`No ${config.label.toLowerCase()} records found`} description={config.canCreate === false ? "Try clearing the current filters." : "Try clearing filters or create a new record if this resource supports creation."} />;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950">
            <tr>
              {config.columns.map((column) => <th key={column} className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">{column}</th>)}
              <th className="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item) => (
              <tr key={String(item.id)} className={cn(isDeleted(item) && "bg-amber-50/40 dark:bg-amber-950/10")}>
                {config.columns.map((column) => (
                  <td key={column} className="max-w-64 px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                    {column === "role" && item.id ? (
                      <select className="input min-w-44" value={String(item.role ?? "")} disabled={busy || config.key !== "users"} onChange={(event) => onRoleChange(item, event.target.value as AdminRole)}>
                        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    ) : column === "status" && item.id && !config.readonly ? (
                      <select className="input min-w-40" value={String(item.status ?? "")} disabled={busy} onChange={(event) => onStatusChange(item, event.target.value as AdminStatus)}>
                        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    ) : (
                      <span className="line-clamp-2 break-words">{formatValue(item[column])}</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-right align-top">
                  <div className="flex flex-wrap justify-end gap-2">
                    {!config.readonly ? <button type="button" className="btn-secondary" onClick={() => onEdit(item)} disabled={busy}>Edit</button> : null}
                    {!config.readonly && !isDeleted(item) ? (
                      <button type="button" className="btn-secondary text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40" onClick={() => onDelete(item)} disabled={busy}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    ) : null}
                    {!config.readonly && isDeleted(item) ? (
                      <button type="button" className="btn-secondary" onClick={() => onRestore(item)} disabled={busy}>
                        <ArchiveRestore className="h-4 w-4" /> Restore
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminFormModal({
  title,
  config,
  item,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  title: string;
  config: ResourceUiConfig;
  item: AdminItem | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => initialFormState(config, item));
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      setError(null);
      onSubmit(parseForm(config, values));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid form data");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">{title}</h2>
          <button type="button" className="btn-secondary px-3" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {config.fields.map((field) => (
            <label key={field.key} className={cn("block", (field.kind === "textarea" || field.kind === "json") && "md:col-span-2")}>
              <span className="label">{field.label}{field.required ? " *" : ""}</span>
              <FieldInput field={field} value={values[field.key] ?? ""} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
            </label>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldConfig; value: string; onChange: (value: string) => void }) {
  if (field.kind === "select") {
    return (
      <select className="input mt-1" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  if (field.kind === "textarea" || field.kind === "json") {
    return <textarea className="input mt-1 min-h-32 font-mono text-sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.kind === "json" ? "[ ] or { }" : undefined} />;
  }
  return <input className="input mt-1" type={field.kind === "number" ? "number" : field.kind === "date" ? "datetime-local" : "text"} value={value} onChange={(event) => onChange(event.target.value)} />;
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className={cn("rounded-2xl p-3", danger ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-200" : "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-200")}>
            {danger ? <Trash2 className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-slate-950 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={danger ? "btn bg-red-600 text-white hover:bg-red-700" : "btn-primary"} onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
