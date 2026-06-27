import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  BookOpenCheck,
  CheckCheck,
  FileText,
  Megaphone,
  MessageSquareMore,
  Route,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { notificationsService } from "./notifications.service";
import type { Notification, NotificationType } from "./notifications.types";

const typeLabels: Record<NotificationType, string> = {
  ROADMAP_UPDATED: "Roadmap Updated",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_COMPLETED: "Interview Completed",
  RESUME_PROCESSED: "Resume Processed",
  PROJECT_RECOMMENDATION_READY: "Project Recommendation Ready",
  COURSE_RECOMMENDATION_READY: "Course Recommendation Ready",
  GAP_ANALYSIS_COMPLETED: "Gap Analysis Completed",
  ADMIN_ANNOUNCEMENT: "Admin Announcement",
};

const iconFor = (type: NotificationType): ReactNode => {
  const className = "h-6 w-6";
  switch (type) {
    case "ROADMAP_UPDATED": return <Route className={className} />;
    case "INTERVIEW_COMPLETED":
    case "INTERVIEW_SCHEDULED": return <MessageSquareMore className={className} />;
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
    case "INTERVIEW_SCHEDULED":
      return { label: "Open interviews", to: `${routePaths.interview}/history` };
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
  dateStyle: "full",
  timeStyle: "short",
}).format(new Date(value));

export function NotificationDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const notificationQuery = useQuery({
    queryKey: queryKeys.notifications.detail(id),
    queryFn: () => notificationsService.getById(id!),
    enabled: Boolean(id),
    refetchInterval: 30_000,
    staleTime: queryTimes.realtime,
  });

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.notifications.detail(id) });
  };

  const markRead = useMutation({
    mutationFn: notificationsService.markRead,
    onSuccess: () => {
      toast.success("Notification marked as read");
      invalidateNotifications();
    },
  });

  const deleteNotification = useMutation({
    mutationFn: notificationsService.delete,
    onSuccess: () => {
      toast.success("Notification deleted");
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      navigate(routePaths.notifications);
    },
  });

  const notification = notificationQuery.data;

  useEffect(() => {
    if (notification && !notification.read && !markRead.isPending) {
      markRead.mutate(notification.id);
    }
  }, [notification?.id, notification?.read]);

  if (notificationQuery.isLoading) {
    return <div className="space-y-6"><CardSkeleton /><CardSkeleton /></div>;
  }

  if (notificationQuery.isError || !notification) {
    return (
      <EmptyState
        title="Notification could not be loaded"
        description="The notification may have been deleted, archived, or may not be visible to your role."
      />
    );
  }

  const destination = destinationFor(notification);
  const metadataText = notification.metadata ? JSON.stringify(notification.metadata, null, 2) : null;

  return (
    <div className="space-y-6">
      <Link to={routePaths.notifications} className="btn-secondary inline-flex">
        <ArrowLeft className="h-4 w-4" /> Back to notifications
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4">
            <span className={cn(
              "grid h-14 w-14 shrink-0 place-items-center rounded-2xl",
              notification.read ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-200",
            )}>
              {iconFor(notification.type)}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">{typeLabels[notification.type] ?? notification.type}</p>
              <h1 className="mt-2 text-3xl font-extrabold text-slate-950 dark:text-white">{notification.title}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{formatDate(notification.createdAt)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!notification.read ? (
              <button type="button" className="btn-secondary" onClick={() => markRead.mutate(notification.id)} disabled={markRead.isPending}>
                <CheckCheck className="h-4 w-4" /> Mark read
              </button>
            ) : null}
            {destination ? <Link to={destination.to} className="btn-primary">{destination.label}</Link> : null}
            <button
              type="button"
              className="btn-secondary text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
              onClick={() => deleteNotification.mutate(notification.id)}
              disabled={deleteNotification.isPending}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-slate-50 p-5 dark:bg-slate-950">
          <h2 className="font-extrabold text-slate-950 dark:text-white">Message</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300">{notification.message}</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Info label="Status" value={notification.read ? "Read" : "Unread"} />
          <Info label="Target Role" value={notification.targetRole ?? "Personal"} />
          <Info label="Notification ID" value={notification.id} />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-extrabold text-slate-950 dark:text-white">Metadata</h2>
        {metadataText ? (
          <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{metadataText}</pre>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No metadata was attached to this notification.</p>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 break-all text-sm font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
