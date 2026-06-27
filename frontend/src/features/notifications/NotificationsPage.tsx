import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpenCheck,
  BriefcaseBusiness,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Megaphone,
  MessageSquareMore,
  Route,
  Search,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { FormEvent, useMemo, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { readPositivePage } from "../../hooks/usePaginationState";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { notificationsService } from "./notifications.service";
import type { ListNotificationsResponse, Notification, NotificationType } from "./notifications.types";

const pageSize = 10;

const typeOptions: Array<{ value: NotificationType; label: string }> = [
  { value: "ROADMAP_UPDATED", label: "Roadmap Updated" },
  { value: "INTERVIEW_COMPLETED", label: "Interview Completed" },
  { value: "RESUME_PROCESSED", label: "Resume Processed" },
  { value: "GAP_ANALYSIS_COMPLETED", label: "Gap Analysis Completed" },
  { value: "PROJECT_RECOMMENDATION_READY", label: "Project Recommendation Ready" },
  { value: "COURSE_RECOMMENDATION_READY", label: "Course Recommendation Ready" },
  { value: "ADMIN_ANNOUNCEMENT", label: "Admin Announcement" },
];

const typeLabels = Object.fromEntries(typeOptions.map((item) => [item.value, item.label])) as Record<NotificationType, string>;

const iconFor = (type: NotificationType): ReactNode => {
  const className = "h-5 w-5";
  switch (type) {
    case "ROADMAP_UPDATED": return <Route className={className} />;
    case "INTERVIEW_COMPLETED": return <MessageSquareMore className={className} />;
    case "RESUME_PROCESSED": return <FileText className={className} />;
    case "GAP_ANALYSIS_COMPLETED": return <Target className={className} />;
    case "PROJECT_RECOMMENDATION_READY": return <Sparkles className={className} />;
    case "COURSE_RECOMMENDATION_READY": return <BookOpenCheck className={className} />;
    case "ADMIN_ANNOUNCEMENT": return <Megaphone className={className} />;
    default: return <Bell className={className} />;
  }
};

const destinationFor = (notification: Notification) => {
  switch (notification.type) {
    case "ROADMAP_UPDATED":
      return { label: "Open roadmap", to: routePaths.roadmap };
    case "INTERVIEW_COMPLETED":
      return { label: "Open interview history", to: `${routePaths.interview}/history` };
    case "RESUME_PROCESSED":
      return { label: "Open resumes", to: routePaths.resume };
    case "GAP_ANALYSIS_COMPLETED":
      return { label: "Open gap report", to: `${routePaths.gapAnalysis}/report` };
    case "PROJECT_RECOMMENDATION_READY":
      return { label: "Open roadmap", to: routePaths.roadmap };
    case "COURSE_RECOMMENDATION_READY":
      return { label: "Open courses", to: routePaths.courses };
    default:
      return null;
  }
};

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const readPage = (params: URLSearchParams) => {
  return readPositivePage(params.get("page"));
};

const readType = (params: URLSearchParams): NotificationType | undefined => {
  const value = params.get("type");
  return typeOptions.some((option) => option.value === value) ? value as NotificationType : undefined;
};

export function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const page = readPage(searchParams);
  const type = readType(searchParams);
  const search = searchParams.get("search") ?? "";
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const [searchInput, setSearchInput] = useState(search);

  const queryParams = useMemo(() => ({ page, limit: pageSize, type, search, unreadOnly }), [page, search, type, unreadOnly]);

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list(queryParams),
    queryFn: () => notificationsService.list(queryParams),
    refetchInterval: 30_000,
    staleTime: queryTimes.realtime,
  });

  const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
  const updateNotificationLists = (updater: (current: ListNotificationsResponse) => ListNotificationsResponse) => {
    queryClient.setQueriesData<ListNotificationsResponse>({ queryKey: queryKeys.notifications.all }, (current) => (
      current ? updater(current) : current
    ));
  };

  const markRead = useMutation({
    mutationFn: notificationsService.markRead,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });
      const previous = queryClient.getQueriesData<ListNotificationsResponse>({ queryKey: queryKeys.notifications.all });
      updateNotificationLists((current) => {
        const wasUnread = current.notifications.some((notification) => notification.id === id && !notification.read);
        return {
          ...current,
          unreadCount: wasUnread ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
          notifications: current.notifications.map((notification) => (
            notification.id === id ? { ...notification, read: true } : notification
          )),
        };
      });
      queryClient.setQueryData(queryKeys.notifications.detail(id), (current: Notification | undefined) => (
        current ? { ...current, read: true } : current
      ));
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
    },
    onSuccess: () => {
      toast.success("Notification marked as read");
      invalidateNotifications();
    },
  });

  const markAllRead = useMutation({
    mutationFn: notificationsService.markAllRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });
      const previous = queryClient.getQueriesData<ListNotificationsResponse>({ queryKey: queryKeys.notifications.all });
      updateNotificationLists((current) => ({
        ...current,
        unreadCount: 0,
        notifications: current.notifications.map((notification) => ({ ...notification, read: true })),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
    },
    onSuccess: (result) => {
      toast.success(result.updatedCount > 0 ? `${result.updatedCount} notification(s) marked as read` : "No unread notifications");
      invalidateNotifications();
    },
  });

  const deleteNotification = useMutation({
    mutationFn: notificationsService.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications.all });
      const previous = queryClient.getQueriesData<ListNotificationsResponse>({ queryKey: queryKeys.notifications.all });
      updateNotificationLists((current) => {
        const deleted = current.notifications.find((notification) => notification.id === id);
        return {
          ...current,
          unreadCount: deleted && !deleted.read ? Math.max(0, current.unreadCount - 1) : current.unreadCount,
          pagination: {
            ...current.pagination,
            total: Math.max(0, current.pagination.total - 1),
          },
          notifications: current.notifications.filter((notification) => notification.id !== id),
        };
      });
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
    },
    onSuccess: () => {
      toast.success("Notification deleted");
      invalidateNotifications();
    },
  });

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    if (!("page" in updates)) next.set("page", "1");
    setSearchParams(next);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ search: searchInput.trim() || undefined });
  };

  if (notificationsQuery.isLoading) {
    return <div className="space-y-6"><CardSkeleton /><div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]"><CardSkeleton /><CardSkeleton /></div><CardSkeleton /></div>;
  }

  if (notificationsQuery.isError) {
    return (
      <EmptyState
        title="Notifications could not be loaded"
        description="The backend did not return notifications successfully. Any server message was shown as a toast."
      />
    );
  }

  const data = notificationsQuery.data;
  if (!data) {
    return <EmptyState title="No notifications data available" description="Notifications will appear here when backend events create them." />;
  }

  const notifications = data.notifications;
  const pagination = data.pagination;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Notifications Center</p>
            <h1 className="mt-2 text-3xl font-extrabold">Stay synced with platform events</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-100">
              Real backend notifications with filters, search, pagination, and read-state actions.
            </p>
          </div>
          <button type="button" className="btn bg-white text-slate-950 hover:bg-blue-50" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || data.unreadCount === 0}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.35fr_0.65fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Unread count</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-950 dark:text-white">{data.unreadCount}</p>
            </div>
            <span className="rounded-2xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200">
              <Bell className="h-6 w-6" />
            </span>
          </div>

          <form onSubmit={submitSearch} className="mt-6">
            <label className="label" htmlFor="notification-search">Search notifications</label>
            <div className="mt-2 flex gap-2">
              <input
                id="notification-search"
                className="input"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search title or message"
              />
              <button type="submit" className="btn-primary px-3" aria-label="Search">
                <Search className="h-4 w-4" />
              </button>
            </div>
          </form>

          <div className="mt-5">
            <label className="label" htmlFor="notification-type">Filter by type</label>
            <select
              id="notification-type"
              className="input mt-2"
              value={type ?? ""}
              onChange={(event) => updateParams({ type: event.target.value || undefined })}
            >
              <option value="">All types</option>
              {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <label className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => updateParams({ unreadOnly: event.target.checked ? "true" : undefined })}
            />
            Show unread only
          </label>

          <button type="button" className="btn-secondary mt-4 w-full justify-center" onClick={() => {
            setSearchInput("");
            setSearchParams(new URLSearchParams());
          }}>
            Clear filters
          </button>
        </aside>

        <section className="space-y-4">
          {notifications.length === 0 ? (
            <EmptyState
              title="No notifications found"
              description="Try clearing filters, or wait for backend events such as resume processing, gap analysis, or interview completion."
            />
          ) : notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={() => markRead.mutate(notification.id)}
              onDelete={() => deleteNotification.mutate(notification.id)}
              busy={markRead.isPending || deleteNotification.isPending}
            />
          ))}

          <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.total} total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={pagination.page <= 1}
                onClick={() => updateParams({ page: String(pagination.page - 1) })}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateParams({ page: String(pagination.page + 1) })}
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  busy,
}: {
  notification: Notification;
  onMarkRead: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const destination = destinationFor(notification);

  return (
    <article className={cn(
      "rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card dark:bg-slate-900",
      notification.read ? "border-slate-200 dark:border-slate-800" : "border-blue-200 ring-2 ring-blue-100 dark:border-blue-800 dark:ring-blue-950/60",
    )}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <span className={cn(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl",
            notification.read ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200",
          )}>
            {iconFor(notification.type)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`${routePaths.notifications}/${notification.id}`} className="text-lg font-extrabold text-slate-950 hover:text-blue-600 dark:text-white dark:hover:text-blue-300">
                {notification.title}
              </Link>
              {!notification.read ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">Unread</span> : null}
            </div>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">{typeLabels[notification.type] ?? notification.type}</p>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{notification.message}</p>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{formatDate(notification.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link to={`${routePaths.notifications}/${notification.id}`} className="btn-secondary">Details</Link>
          {destination ? <Link to={destination.to} className="btn-secondary">{destination.label}</Link> : null}
          {!notification.read ? (
            <button type="button" className="btn-secondary" onClick={onMarkRead} disabled={busy}>
              <CheckCheck className="h-4 w-4" /> Read
            </button>
          ) : null}
          <button type="button" className="btn-secondary text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40" onClick={onDelete} disabled={busy}>
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>
    </article>
  );
}
