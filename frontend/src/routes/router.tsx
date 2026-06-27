import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { EmptyState } from "../components/common/EmptyState";
import { AppLayout } from "../components/layouts/AppLayout";
import { ProtectedRoute } from "../components/layouts/ProtectedRoute";
import { CardSkeleton } from "../components/ui/Skeleton";
import { routePaths } from "../constants/routes";
import type { UserRole } from "../types/auth";

const lazyPage = <T extends ComponentType<object>>(
  importer: () => Promise<Record<string, T>>,
  exportName: string,
) => lazy(async () => {
  const module = await importer();
  return { default: module[exportName] };
});

const LandingPage = lazyPage(() => import("../features/landing"), "LandingPage");
const LoginPage = lazyPage(() => import("../features/auth"), "LoginPage");
const RegisterPage = lazyPage(() => import("../features/auth"), "RegisterPage");
const ForgotPasswordPage = lazyPage(() => import("../features/auth"), "ForgotPasswordPage");
const ResetPasswordPage = lazyPage(() => import("../features/auth"), "ResetPasswordPage");
const DashboardPage = lazyPage(() => import("../features/dashboard"), "DashboardPage");
const ProfilePage = lazyPage(() => import("../features/profile"), "ProfilePage");
const ResumePage = lazyPage(() => import("../features/resume"), "ResumePage");
const CareerRolesListPage = lazyPage(() => import("../features/jobs"), "CareerRolesListPage");
const CareerRoleDetailsPage = lazyPage(() => import("../features/jobs"), "CareerRoleDetailsPage");
const JobDescriptionPage = lazyPage(() => import("../features/jobs"), "JobDescriptionPage");
const RunGapAnalysisPage = lazyPage(() => import("../features/gap-analysis"), "RunGapAnalysisPage");
const GapReportPage = lazyPage(() => import("../features/gap-analysis"), "GapReportPage");
const RoadmapPage = lazyPage(() => import("../features/roadmap"), "RoadmapPage");
const RoadmapDetailsPage = lazyPage(() => import("../features/roadmap"), "RoadmapDetailsPage");
const ProgressTrackingPage = lazyPage(() => import("../features/roadmap"), "ProgressTrackingPage");
const ProjectsPage = lazyPage(() => import("../features/projects"), "ProjectsPage");
const CoursesPage = lazyPage(() => import("../features/courses"), "CoursesPage");
const InterviewSetupPage = lazyPage(() => import("../features/interview"), "InterviewSetupPage");
const InterviewArenaPage = lazyPage(() => import("../features/interview"), "InterviewArenaPage");
const InterviewResultsPage = lazyPage(() => import("../features/interview"), "InterviewResultsPage");
const InterviewHistoryPage = lazyPage(() => import("../features/interview"), "InterviewHistoryPage");
const AnalyticsPage = lazyPage(() => import("../features/analytics"), "AnalyticsPage");
const NotificationsPage = lazyPage(() => import("../features/notifications"), "NotificationsPage");
const NotificationDetailsPage = lazyPage(() => import("../features/notifications"), "NotificationDetailsPage");
const AdminPage = lazyPage(() => import("../features/admin"), "AdminPage");

function RouteFallback() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CardSkeleton />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function pageElement(Page: ComponentType<object>, roles?: UserRole[]) {
  const element = (
    <LazyRoute>
      <Page />
    </LazyRoute>
  );

  return roles ? <ProtectedRoute roles={roles}>{element}</ProtectedRoute> : element;
}

function FoundationPlaceholder({ name }: { name: string }) {
  return (
    <EmptyState
      title={`${name} module is ready for page implementation`}
      description="Routing, providers, state, API access, theme, loading, and error handling are configured."
    />
  );
}

export const router = createBrowserRouter([
  {
    path: routePaths.home,
    element: pageElement(LandingPage),
  },
  {
    path: routePaths.login,
    element: pageElement(LoginPage),
  },
  {
    path: routePaths.register,
    element: pageElement(RegisterPage),
  },
  {
    path: routePaths.forgotPassword,
    element: pageElement(ForgotPasswordPage),
  },
  {
    path: routePaths.resetPassword,
    element: pageElement(ResetPasswordPage),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: routePaths.dashboard, element: pageElement(DashboardPage, ["STUDENT"]) },
          { path: routePaths.profile, element: pageElement(ProfilePage, ["STUDENT"]) },
          { path: routePaths.resume, element: pageElement(ResumePage, ["STUDENT"]) },
          { path: routePaths.gapAnalysis, element: pageElement(RunGapAnalysisPage, ["STUDENT"]) },
          { path: `${routePaths.gapAnalysis}/report`, element: pageElement(GapReportPage, ["STUDENT"]) },
          { path: routePaths.roadmap, element: pageElement(RoadmapPage, ["STUDENT"]) },
          { path: `${routePaths.roadmap}/:id`, element: pageElement(RoadmapDetailsPage, ["STUDENT"]) },
          { path: `${routePaths.roadmap}/:id/progress`, element: pageElement(ProgressTrackingPage, ["STUDENT"]) },
          { path: routePaths.projects, element: pageElement(ProjectsPage, ["STUDENT"]) },
          { path: routePaths.courses, element: pageElement(CoursesPage, ["STUDENT"]) },
          { path: routePaths.interview, element: pageElement(InterviewSetupPage, ["STUDENT"]) },
          { path: `${routePaths.interview}/sessions/:sessionId/arena`, element: pageElement(InterviewArenaPage, ["STUDENT"]) },
          { path: `${routePaths.interview}/sessions/:sessionId/results`, element: pageElement(InterviewResultsPage, ["STUDENT"]) },
          { path: `${routePaths.interview}/history`, element: pageElement(InterviewHistoryPage, ["STUDENT"]) },
          { path: routePaths.analytics, element: pageElement(AnalyticsPage, ["STUDENT", "ADMIN"]) },
          { path: routePaths.notifications, element: pageElement(NotificationsPage) },
          { path: `${routePaths.notifications}/:id`, element: pageElement(NotificationDetailsPage) },
          { path: routePaths.jobs, element: pageElement(CareerRolesListPage) },
          { path: `${routePaths.jobs}/career-roles/:id`, element: pageElement(CareerRoleDetailsPage) },
          { path: `${routePaths.jobs}/job-descriptions/:id`, element: pageElement(JobDescriptionPage) },
          { path: routePaths.admin, element: pageElement(AdminPage, ["ADMIN"]) },
          { path: "foundation", element: <FoundationPlaceholder name="Foundation" /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to={routePaths.dashboard} replace />,
  },
]);
