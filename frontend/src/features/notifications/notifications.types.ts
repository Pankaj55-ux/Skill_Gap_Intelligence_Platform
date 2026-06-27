export type NotificationType =
  | "ROADMAP_UPDATED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "RESUME_PROCESSED"
  | "PROJECT_RECOMMENDATION_READY"
  | "COURSE_RECOMMENDATION_READY"
  | "GAP_ANALYSIS_COMPLETED"
  | "ADMIN_ANNOUNCEMENT";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  targetRole: string | null;
  createdAt: string;
  metadata: unknown;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListNotificationsParams {
  page: number;
  limit: number;
  type?: NotificationType;
  search?: string;
  unreadOnly?: boolean;
}

export interface ListNotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  pagination: NotificationPagination;
}
