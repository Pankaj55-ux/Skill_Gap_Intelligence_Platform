import { expect, test, type Page, type Route } from "@playwright/test";

const user = {
  id: "user-1",
  email: "student@example.com",
  displayName: "Demo Student",
  role: "STUDENT",
  status: "ACTIVE",
};

const now = "2026-06-26T10:00:00.000Z";

const resume = {
  id: "resume-1",
  userId: user.id,
  originalFileName: "resume.pdf",
  storedFileName: "resume.pdf",
  mimeType: "application/pdf",
  fileSize: 1024,
  fileUrl: "https://example.com/resume.pdf",
  uploadedAt: now,
  parsingStatus: "COMPLETED",
  createdAt: now,
  updatedAt: now,
};

const roadmap = {
  id: "roadmap-1",
  userId: user.id,
  careerRoleId: "role-1",
  gapReportId: "gap-1",
  title: "Frontend Developer Roadmap",
  description: "A focused readiness plan.",
  plan: {
    difficulty: "PLACEMENT_READY",
    readinessScore: 72,
    phases: [{
      title: "Practice component testing",
      description: "Write tests for forms and dashboard views.",
      priority: "HIGH",
      estimatedWeeks: 1,
      estimatedHours: 6,
      skillsCovered: ["React Testing Library"],
      completionStatus: "IN_PROGRESS",
      orderNumber: 1,
      recommendedProjects: ["Testing dashboard"],
      practiceGoals: ["Build coverage"],
    }],
  },
  startsAt: now,
  targetDate: now,
  completedAt: null,
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  careerRole: { id: "role-1", title: "Frontend Developer", level: "ENTRY" },
  gapReport: { id: "gap-1", readinessScore: 72, generatedAt: now },
};

const dashboard = {
  profile: {
    id: "profile-1",
    email: user.email,
    displayName: user.displayName,
    profile: {
      fullName: "Demo Student",
      college: "SGIP College",
      branch: "Computer Science",
      graduationYear: 2026,
      targetRole: "Frontend Developer",
      profileCompletionPercentage: 100,
    },
  },
  currentReadinessScore: 72,
  roadmapProgress: {
    roadmapId: roadmap.id,
    title: roadmap.title,
    status: "ACTIVE",
    totalItems: 1,
    completedItems: 0,
    overallCompletionPercentage: 40,
    projectedReadinessScore: 86,
  },
  completedSkills: ["React"],
  pendingSkills: [],
  verifiedSkills: [{ skillName: "React", category: "Frontend", verifiedStatus: "VERIFIED" }],
  gapAnalysisSummary: {
    reportId: "gap-1",
    readinessScore: 72,
    matchedSkillsCount: 4,
    weakSkillsCount: 2,
    missingSkillsCount: 1,
    explanation: "Good progress.",
    generatedAt: now,
  },
  recentActivities: [{ id: "activity-1", action: "GAP_ANALYSIS_RUN", entityType: "GapReport", entityId: "gap-1", createdAt: now }],
  latestNotifications: [{ id: "notification-1", type: "INFO", message: "Roadmap updated", createdAt: now }],
  upcomingGoals: [{ roadmapItemId: "item-1", title: "Practice component testing", priority: "HIGH", estimatedWeeks: 1, estimatedHours: 6, skillsCovered: ["Testing"], practiceGoals: ["Write tests"] }],
  weeklyProgress: [{ date: "2026-06-26", completedItems: 1, averageCompletionPercentage: 40 }],
  careerRole: { id: "role-1", title: "Frontend Developer", level: "ENTRY" },
  profileCompletion: 100,
  analytics: {
    metrics: {
      currentReadiness: 72,
      averageInterviewScore: 74,
      latestInterviewScore: 78,
      resumeScore: 80,
      roadmapProgress: 40,
      projectsCompleted: 1,
      coursesCompleted: 1,
      verifiedSkillsCount: 3,
      weakSkillsCount: 2,
      strongSkillsCount: 4,
      monthlyImprovement: 12,
      weeklyImprovement: 5,
    },
    skillDistribution: [{ category: "Frontend", count: 4 }],
    weakSkills: ["Testing"],
    strongSkills: ["React"],
    trends: {
      monthlyImprovement: [{ month: "2026-06", readinessScore: 72 }],
      weeklyImprovement: [{ week: "2026-06-26", averageInterviewScore: 74, roadmapCompletion: 40 }],
      placementReadiness: [{ date: "2026-06-26", score: 72, source: "gap-analysis" }],
    },
    charts: {
      progress: [{ label: "Readiness", value: 72 }],
      interviewPerformance: [{ date: "2026-06-26", score: 78, technicalScore: 80, communicationScore: 76, confidenceScore: 74 }],
      skillCategories: [{ category: "Frontend", count: 4 }],
      roadmapCompletion: [{ roadmapItemId: "item-1", title: "Practice component testing", completionPercentage: 40, completed: false }],
    },
  },
};

const session = {
  id: "session-1",
  userId: user.id,
  resumeId: resume.id,
  targetRole: "Frontend Developer",
  status: "ACTIVE",
  durationMinutes: 30,
  startedAt: now,
  pausedAt: null,
  resumedAt: null,
  endedAt: null,
  elapsedSeconds: 0,
  remainingSeconds: 1800,
  expectedTopics: ["Question count target: 2", "technical fundamentals"],
  finalReport: null,
  createdAt: now,
  turns: [{
    id: "turn-1",
    turnNumber: 1,
    question: "Explain how you test a React form.",
    expectedTopics: ["React Testing Library"],
    answerText: null,
    answerMode: null,
    transcript: null,
    askedAt: now,
    answeredAt: null,
    evaluation: null,
  }],
};

const profile = {
  id: "profile-1",
  userId: user.id,
  fullName: "Demo Student",
  college: "SGIP College",
  branch: "Computer Science",
  graduationYear: 2026,
  targetRole: "Frontend Developer",
  currentSkills: ["React", "TypeScript"],
  preferredCompanies: ["OpenAI"],
  resumeUrl: "https://example.com/resume.pdf",
  profileCompletionPercentage: 100,
  user,
};

const envelope = (data: unknown) => ({
  data,
  error: null,
  meta: {
    requestId: "e2e-request",
    timestamp: now,
  },
});

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(envelope(data)),
  });
}

async function mockApi(page: Page) {
  await page.route("**/api/v1/sgip/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1/sgip", "");
    const method = request.method();

    if (path === "/auth/register" || path === "/auth/login") {
      return fulfillJson(route, { user, accessToken: "e2e-token", tokenType: "Bearer" }, path.endsWith("register") ? 201 : 200);
    }
    if (path === "/me") return fulfillJson(route, { user });
    if (path === "/dashboard") return fulfillJson(route, { dashboard });
    if (path === "/student-profile/me") return fulfillJson(route, { profile });
    if (path === "/student-profile") return fulfillJson(route, { profile }, 201);
    if (path === "/skill-evidence/me") return fulfillJson(route, { evidence: [] });
    if (path === "/resume/me") return fulfillJson(route, { resumes: [resume] });
    if (path === "/resume/upload") return fulfillJson(route, { resume }, 201);
    if (path === "/resume/resume-1/analyze") {
      return fulfillJson(route, {
        analysis: {
          id: "analysis-1",
          resumeId: resume.id,
          structuredData: {
            technicalSkills: ["React"],
            frameworks: ["React"],
            databases: [],
            cloud: [],
            tools: ["Vitest"],
            programmingLanguages: ["TypeScript"],
            softSkills: [],
            certifications: [],
            projects: [],
            internships: [],
            education: [],
            achievements: [],
          },
          aiModel: "mock-ai",
          promptVersion: "e2e",
          executionTimeMs: 1,
          confidence: 0.9,
          createdAt: now,
          updatedAt: now,
        },
        normalizedSkills: [{ id: "skill-1", resumeId: resume.id, originalSkill: "React", normalizedSkill: "React", category: "Frontend", confidence: 0.9 }],
      });
    }
    if (path === "/career-roles") return fulfillJson(route, { roles: [{ id: "role-1", title: "Frontend Developer", level: "ENTRY", requiredSkills: ["React"] }] });
    if (path === "/gap-analysis/run") {
      return fulfillJson(route, {
        report: { id: "gap-1", userId: user.id, careerRoleId: "role-1", readinessScore: 72, evidenceCoverage: 80, matchedSkills: [], weakSkills: [], missingSkills: [], explanation: "Good progress.", recommendations: [], generatedAt: now, createdAt: now, careerRole: roadmap.careerRole },
        analysis: { targetCareerRole: { id: "role-1", title: "Frontend Developer" }, matchedSkills: [], missingSkills: [], weakSkills: [], readinessScore: 72, evidenceCoverage: 80, explanation: "Good progress.", componentScores: { profileCompletion: 100, requiredSkillMatch: 70, evidenceStrength: 80, skillLevelCompatibility: 75 }, weights: { profileCompletion: 0.2, requiredSkillMatch: 0.4, evidenceStrength: 0.2, skillLevelCompatibility: 0.2 } },
      }, 201);
    }
    if (path === "/search") return fulfillJson(route, { items: [], metadata: { page: 1, limit: 8, total: 0, totalPages: 0 }, resources: ["gapReports"] });
    if (path === "/roadmap/generate") return fulfillJson(route, { roadmap }, 201);
    if (path === "/roadmap") return fulfillJson(route, { roadmaps: [roadmap] });
    if (path === "/progress") return fulfillJson(route, { progress: [{ roadmapId: roadmap.id, title: roadmap.title, status: "ACTIVE", progress: [], summary: { totalItems: 1, completedItems: 0, overallCompletionPercentage: 40, baseReadinessScore: 72, projectedReadinessScore: 86 } }] });
    if (path === "/projects/recommend") return fulfillJson(route, { beginnerProjects: [], intermediateProjects: [], advancedProjects: [], generatedAt: now, model: "mock-ai" });
    if (path === "/courses/recommendations") return fulfillJson(route, { recommendations: [] });
    if (path === "/courses/recommend") return fulfillJson(route, { recommendations: [] });
    if (path === "/job-description") return fulfillJson(route, { jobDescriptions: [{ id: "job-1", title: "Frontend Developer", company: "SGIP", requiredSkills: ["React"], preferredSkills: ["Testing"] }] });
    if (path === "/interview/sessions" && method === "POST") return fulfillJson(route, { session }, 201);
    if (path === "/interview/sessions") return fulfillJson(route, { sessions: [session] });
    if (path === "/interview/sessions/session-1") return fulfillJson(route, { session });
    if (path === "/interview/sessions/session-1/answer") return fulfillJson(route, { session: { ...session, turns: [{ ...session.turns[0], answerText: "I use accessible queries and user events.", evaluation: { id: "eval-1", score: 80, strengths: ["Clear"], weaknesses: [], missingConcepts: [], communicationScore: 78, technicalScore: 82, confidenceScore: 80, improvementPlan: [], summary: "Good answer" } }] }, nextQuestion: null });
    if (path === "/interview/sessions/session-1/end") return fulfillJson(route, { session: { ...session, status: "ENDED" }, report: { averageScore: 80 } });
    if (path === "/interview/sessions/session-1/report") return fulfillJson(route, { report: { targetRole: "Frontend Developer", status: "ENDED", totalQuestions: 1, answeredQuestions: 1, averageScore: 80, strengths: ["Clear"], weaknesses: [], missingConcepts: [], summary: "Good interview", transcript: "Answer" } });
    if (path === "/notifications") return fulfillJson(route, { notifications: [], metadata: { page: 1, limit: 10, total: 0, totalPages: 0 } });

    return fulfillJson(route, {});
  });
}

test("student registration to analytics journey", async ({ page }) => {
  await mockApi(page);

  await test.step("Student Registration", async () => {
    await page.goto("/register");
    await page.getByLabel("Full name").fill(user.displayName);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("StrongPass123!");
    await page.getByLabel("Confirm password").fill("StrongPass123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/Welcome, Demo Student/i)).toBeVisible();
  });

  await test.step("Login", async () => {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill("StrongPass123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  await test.step("Complete Profile", async () => {
    await page.goto("/profile");
    await expect(page.getByText(/Profile Details/i)).toBeVisible();
    await expect(page.getByText(/Demo Student/i)).toBeVisible();
  });

  await test.step("Upload Resume and Run Resume Analysis", async () => {
    await page.goto("/resume");
    await expect(page.getByText(/Upload, parse, and analyze resumes/i)).toBeVisible();
    await expect(page.getByText(/resume.pdf/i)).toBeVisible();
    await page.getByRole("button", { name: /Analyze Resume/i }).click();
    await expect(page.getByText(/React/i)).toBeVisible();
  });

  await test.step("Gap Analysis", async () => {
    await page.goto("/gap-analysis");
    await page.getByRole("button", { name: /Frontend Developer/i }).first().click();
    await page.getByRole("button", { name: /^Run Analysis$/i }).click();
    await expect(page).toHaveURL(/\/gap-analysis\/report/);
  });

  await test.step("Generate Roadmap", async () => {
    await page.goto("/roadmap");
    await expect(page.getByText(/Frontend Developer Roadmap/i)).toBeVisible();
  });

  await test.step("Generate Projects and Courses", async () => {
    await page.goto("/projects");
    await expect(page.getByText(/Portfolio project recommendations/i)).toBeVisible();
    await page.goto("/courses");
    await expect(page.getByText(/Course recommendations/i)).toBeVisible();
  });

  await test.step("Start Interview and Complete Interview", async () => {
    await page.goto("/interview");
    await page.getByLabel("Target role").fill("Frontend Developer");
    await page.getByRole("button", { name: /Next/i }).click();
    await page.getByRole("button", { name: /Next/i }).click();
    await page.getByRole("button", { name: /Next/i }).click();
    await page.getByRole("button", { name: /Start Interview/i }).click();
    await expect(page).toHaveURL(/\/interview\/sessions\/session-1\/arena/);
    await page.getByLabel(/Your answer/i).fill("I use accessible queries and user events.");
    await page.getByRole("button", { name: /Submit Answer/i }).click();
    await page.getByRole("button", { name: /End Interview/i }).click();
  });

  await test.step("View Analytics", async () => {
    await page.goto("/analytics");
    await expect(page.getByText(/Placement readiness intelligence/i)).toBeVisible();
  });

  await test.step("Logout", async () => {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
