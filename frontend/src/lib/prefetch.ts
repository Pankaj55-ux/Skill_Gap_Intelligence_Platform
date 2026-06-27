import type { QueryClient } from "@tanstack/react-query";
import { dashboardService } from "../features/dashboard/dashboard.service";
import { jobsService } from "../features/jobs/jobs.service";
import { notificationsService } from "../features/notifications/notifications.service";
import { profileService } from "../features/profile/profile.service";
import { roadmapService } from "../features/roadmap/roadmap.service";
import { queryTimes } from "./queryConfig";
import { queryKeys } from "./queryKeys";

export const prefetchStudentHome = (queryClient: QueryClient) => {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.dashboard.student(),
    queryFn: dashboardService.getStudentDashboard,
    staleTime: queryTimes.short,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: profileService.getOwnProfile,
    staleTime: queryTimes.medium,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.roadmap.list(),
    queryFn: roadmapService.listRoadmaps,
    staleTime: queryTimes.short,
  });
};

export const prefetchCatalog = (queryClient: QueryClient) => {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.jobs.careerRoles({ page: 1, pageSize: 12 }),
    queryFn: () => jobsService.listCareerRoles({ page: 1, pageSize: 12 }),
    staleTime: queryTimes.long,
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.jobs.jobDescriptions(),
    queryFn: jobsService.listJobDescriptions,
    staleTime: queryTimes.long,
  });
};

export const prefetchNotifications = (queryClient: QueryClient) => {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.notifications.list({ page: 1, limit: 10, unreadOnly: false }),
    queryFn: () => notificationsService.list({ page: 1, limit: 10, unreadOnly: false }),
    staleTime: queryTimes.realtime,
  });
};
