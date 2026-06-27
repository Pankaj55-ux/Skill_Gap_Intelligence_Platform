import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  Prisma,
  RecordStatus,
  UserRole,
} from "../../generated/prisma/client.js";
import {
  resumeStructuredDataSchema,
  type ResumeStructuredData,
} from "../resume/ai-resume-extractor.service.js";
import {
  jobDescriptionStructuredDataSchema,
  type JobDescriptionStructuredData,
} from "../job-description/ai-job-description-extractor.service.js";
import { aiMatchSuggestionService } from "./ai-match-suggestion.service.js";
import type { RunResumeJobMatchInput } from "./match.schemas.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

interface NormalizedSkillSnapshot {
  normalizedSkill: string;
  originalSkill: string;
  category: string;
  confidence: number;
}

interface SkillMatchResult {
  matched: string[];
  missing: string[];
  weak: string[];
  strong: string[];
  score: number;
}

const matchSelect = {
  id: true,
  userId: true,
  resumeId: true,
  jobDescriptionId: true,
  matchScore: true,
  matchedSkills: true,
  missingSkills: true,
  weakSkills: true,
  strongSkills: true,
  roleFitSummary: true,
  suggestions: true,
  scoreBreakdown: true,
  generatedAt: true,
  createdAt: true,
} satisfies Prisma.ResumeJobMatchSelect;

const normalizedSkillSelect = {
  originalSkill: true,
  normalizedSkill: true,
  category: true,
  confidence: true,
} satisfies Prisma.NormalizedSkillSelect;

const uniqueStrings = (items: string[]): string[] => Array.from(new Set(
  items.map((item) => item.trim()).filter(Boolean),
));

const normalizeKey = (value: string): string => value.trim().toLocaleLowerCase("en-US");

const asJsonArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
);

const toSnapshot = (skill: {
  originalSkill: string;
  normalizedSkill: string;
  category: string;
  confidence: Prisma.Decimal | number;
}): NormalizedSkillSnapshot => ({
  originalSkill: skill.originalSkill,
  normalizedSkill: skill.normalizedSkill,
  category: skill.category,
  confidence: Number(skill.confidence),
});

const pickSkillsByCategory = (
  skills: NormalizedSkillSnapshot[],
  categories: string[],
): string[] => uniqueStrings(
  skills
    .filter((skill) => categories.includes(skill.category))
    .map((skill) => skill.normalizedSkill),
);

const ratioScore = (matchedCount: number, totalCount: number): number => {
  if (totalCount === 0) return 100;
  return Math.round((matchedCount / totalCount) * 10000) / 100;
};

const compareSkills = (
  targetSkills: string[],
  resumeSkills: NormalizedSkillSnapshot[],
): SkillMatchResult => {
  const candidateByKey = new Map<string, NormalizedSkillSnapshot>();
  for (const skill of resumeSkills) {
    const key = normalizeKey(skill.normalizedSkill);
    const existing = candidateByKey.get(key);
    if (!existing || skill.confidence > existing.confidence) candidateByKey.set(key, skill);
  }

  const uniqueTargets = uniqueStrings(targetSkills);
  const matched: string[] = [];
  const missing: string[] = [];
  const weak: string[] = [];
  const strong: string[] = [];

  for (const target of uniqueTargets) {
    const candidate = candidateByKey.get(normalizeKey(target));
    if (!candidate) {
      missing.push(target);
      continue;
    }

    matched.push(target);
    if (candidate.confidence < 0.9) weak.push(target);
    else strong.push(target);
  }

  return {
    matched,
    missing,
    weak,
    strong,
    score: ratioScore(matched.length, uniqueTargets.length),
  };
};

const objectListText = (items: unknown[]): string => items
  .map((item) => JSON.stringify(item))
  .join(" ")
  .toLocaleLowerCase("en-US");

const projectInternshipScore = (
  resumeData: ResumeStructuredData,
  jobData: JobDescriptionStructuredData,
  requiredSkills: string[],
  preferredSkills: string[],
): { score: number; matchedTerms: string[] } => {
  const projectText = objectListText([...resumeData.projects, ...resumeData.internships]);
  if (!projectText.trim()) return { score: 0, matchedTerms: [] };

  const terms = uniqueStrings([
    ...jobData.keywords,
    ...jobData.tools,
    ...requiredSkills,
    ...preferredSkills,
  ]);
  const matchedTerms = terms.filter((term) => projectText.includes(term.toLocaleLowerCase("en-US")));

  if (matchedTerms.length === 0) return { score: 50, matchedTerms: [] };
  return {
    score: Math.min(100, 60 + matchedTerms.length * 10),
    matchedTerms,
  };
};

const certificationEducationScore = (
  resumeData: ResumeStructuredData,
  jobData: JobDescriptionStructuredData,
): { score: number; evidence: string[] } => {
  const evidence: string[] = [];
  if (resumeData.certifications.length > 0) evidence.push("certifications");
  if (resumeData.education.length > 0) evidence.push("education");
  if (jobData.educationRequirements.length === 0 && evidence.length > 0) {
    return { score: 85, evidence };
  }
  if (jobData.educationRequirements.length === 0) {
    return { score: 70, evidence: ["no explicit education requirement"] };
  }
  if (resumeData.education.length > 0 && resumeData.certifications.length > 0) {
    return { score: 100, evidence };
  }
  if (resumeData.education.length > 0) return { score: 80, evidence };
  if (resumeData.certifications.length > 0) return { score: 55, evidence };
  return { score: 0, evidence };
};

const recencyConfidenceScore = (input: {
  resumeUploadedAt: Date;
  resumeConfidence: number;
  jobConfidence: number;
}): number => {
  const ageMs = Date.now() - input.resumeUploadedAt.getTime();
  const ageDays = Math.max(0, ageMs / (1000 * 60 * 60 * 24));
  const recency = ageDays <= 180 ? 100 : ageDays <= 365 ? 80 : ageDays <= 730 ? 55 : 30;
  const confidence = (input.resumeConfidence + input.jobConfidence) / 2;
  return Math.round(((confidence * 0.8) + (recency * 0.2)) * 100) / 100;
};

const summarizeFit = (score: number, roleTitle: string, matchedCount: number, missingCount: number): string => {
  if (score >= 80) {
    return `Strong fit for ${roleTitle}: ${matchedCount} key skills matched and only ${missingCount} core gaps remain.`;
  }
  if (score >= 60) {
    return `Moderate fit for ${roleTitle}: the resume shows useful overlap, but ${missingCount} required skills need attention.`;
  }
  return `Early fit for ${roleTitle}: close the required skill gaps first before positioning this resume for the role.`;
};

const suggestionsFor = (input: {
  missingSkills: string[];
  weakSkills: string[];
  projectScore: number;
  certificationScore: number;
}): string[] => {
  const suggestions: string[] = [];
  if (input.missingSkills.length > 0) {
    suggestions.push(`Add evidence for missing required skills: ${input.missingSkills.slice(0, 5).join(", ")}.`);
  }
  if (input.weakSkills.length > 0) {
    suggestions.push(`Strengthen proof for weakly matched skills: ${input.weakSkills.slice(0, 5).join(", ")}.`);
  }
  if (input.projectScore < 70) {
    suggestions.push("Add projects or internship bullets that explicitly demonstrate the role's core tools and responsibilities.");
  }
  if (input.certificationScore < 70) {
    suggestions.push("Add relevant certifications or education details if they are available and applicable.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Keep the resume concise and emphasize measurable impact for the matched role requirements.");
  }
  return suggestions;
};

const jobDescriptionSummaryForSuggestions = (
  jobData: JobDescriptionStructuredData,
  company: string,
): string => {
  const parts = [
    `Role: ${jobData.roleTitle}`,
    `Company: ${jobData.company ?? company}`,
    jobData.responsibilities.length > 0
      ? `Responsibilities: ${jobData.responsibilities.slice(0, 8).join("; ")}`
      : "",
    jobData.educationRequirements.length > 0
      ? `Education: ${jobData.educationRequirements.slice(0, 5).join("; ")}`
      : "",
    jobData.tools.length > 0
      ? `Tools: ${jobData.tools.slice(0, 10).join(", ")}`
      : "",
    jobData.keywords.length > 0
      ? `Keywords: ${jobData.keywords.slice(0, 15).join(", ")}`
      : "",
  ];

  return parts.filter(Boolean).join("\n");
};

const auditData = (
  context: AuditContext,
  options: {
    actorId: string;
    userId: string;
    matchId: string;
    resumeId: string;
    jobDescriptionId: string;
    matchScore: number;
  },
): Prisma.AuditEventCreateInput => ({
  action: "resume_job_match_completed",
  entityType: "ResumeJobMatch",
  entityId: options.matchId,
  payload: {
    resumeId: options.resumeId,
    jobDescriptionId: options.jobDescriptionId,
    matchScore: options.matchScore,
  },
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.actorId,
  updatedBy: options.actorId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.actorId } },
});

export const runResumeJobMatch = async (
  actor: { id: string; role: UserRole },
  input: RunResumeJobMatchInput,
  context: AuditContext,
) => {
  const resume = await database.resume.findFirst({
    where: {
      id: input.resumeId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      uploadedAt: true,
      analyses: {
        where: { status: RecordStatus.ACTIVE, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          structuredData: true,
          confidence: true,
        },
      },
      normalizedSkills: {
        where: { status: RecordStatus.ACTIVE, deletedAt: null },
        select: normalizedSkillSelect,
      },
    },
  });

  if (!resume) {
    throw new AppError(404, "RESUME_NOT_FOUND", "Resume was not found");
  }

  if (actor.role === UserRole.STUDENT && resume.userId !== actor.id) {
    throw new AppError(403, "RESUME_ACCESS_DENIED", "Students can only match their own resume");
  }

  if (actor.role !== UserRole.STUDENT
    && actor.role !== UserRole.ADMIN
    && actor.role !== UserRole.PLACEMENT_OFFICER) {
    throw new AppError(403, "MATCH_ACCESS_DENIED", "You are not permitted to run resume-job matching");
  }

  const jobDescription = await database.jobDescription.findFirst({
    where: {
      id: input.jobDescriptionId,
      status: RecordStatus.ACTIVE,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      company: true,
      requiredSkills: true,
      preferredSkills: true,
      analyses: {
        where: { status: RecordStatus.ACTIVE, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          structuredData: true,
          confidence: true,
        },
      },
      normalizedSkills: {
        where: { status: RecordStatus.ACTIVE, deletedAt: null },
        select: normalizedSkillSelect,
      },
    },
  });

  if (!jobDescription) {
    throw new AppError(404, "JOB_DESCRIPTION_NOT_FOUND", "Job description was not found");
  }

  const latestResumeAnalysis = resume.analyses[0];
  if (!latestResumeAnalysis) {
    throw new AppError(400, "RESUME_ANALYSIS_REQUIRED", "Analyze the resume before running a job match");
  }

  const latestJobAnalysis = jobDescription.analyses[0];
  if (!latestJobAnalysis) {
    throw new AppError(400, "JOB_DESCRIPTION_ANALYSIS_REQUIRED", "Analyze the job description before running a job match");
  }

  const resumeData = resumeStructuredDataSchema.parse(latestResumeAnalysis.structuredData);
  const jobData = jobDescriptionStructuredDataSchema.parse(latestJobAnalysis.structuredData);
  const resumeSkills = resume.normalizedSkills.map(toSnapshot);
  const jobSkills = jobDescription.normalizedSkills.map(toSnapshot);

  if (resumeSkills.length === 0) {
    throw new AppError(400, "RESUME_SKILLS_REQUIRED", "Resume has no normalized skills to match");
  }

  const requiredSkills = uniqueStrings([
    ...jobData.requiredSkills,
    ...asJsonArray(jobDescription.requiredSkills),
    ...pickSkillsByCategory(jobSkills, ["requiredSkills"]),
  ]);
  const preferredSkills = uniqueStrings([
    ...jobData.preferredSkills,
    ...asJsonArray(jobDescription.preferredSkills),
    ...pickSkillsByCategory(jobSkills, ["preferredSkills"]),
  ]);

  if (requiredSkills.length === 0 && preferredSkills.length === 0) {
    throw new AppError(
      400,
      "JOB_DESCRIPTION_SKILLS_REQUIRED",
      "Job description has no extracted skills to match",
    );
  }

  const required = compareSkills(requiredSkills, resumeSkills);
  const preferred = compareSkills(preferredSkills, resumeSkills);
  const project = projectInternshipScore(resumeData, jobData, requiredSkills, preferredSkills);
  const certification = certificationEducationScore(resumeData, jobData);
  const recencyConfidence = recencyConfidenceScore({
    resumeUploadedAt: resume.uploadedAt,
    resumeConfidence: Number(latestResumeAnalysis.confidence),
    jobConfidence: Number(latestJobAnalysis.confidence),
  });

  const matchScore = Math.round((
    required.score * 0.45
    + preferred.score * 0.2
    + project.score * 0.2
    + certification.score * 0.1
    + recencyConfidence * 0.05
  ) * 100) / 100;

  const matchedSkills = uniqueStrings([...required.matched, ...preferred.matched]);
  const missingSkills = required.missing;
  const weakSkills = uniqueStrings([...required.weak, ...preferred.weak]);
  const strongSkills = uniqueStrings([...required.strong, ...preferred.strong]);
  const roleTitle = jobData.roleTitle || jobDescription.title;
  const roleFitSummary = summarizeFit(matchScore, roleTitle, matchedSkills.length, missingSkills.length);
  const improvementSuggestions = suggestionsFor({
    missingSkills,
    weakSkills,
    projectScore: project.score,
    certificationScore: certification.score,
  });

  const scoreBreakdown = {
    requiredSkillsMatch: {
      weight: 45,
      score: required.score,
      matched: required.matched.length,
      total: requiredSkills.length,
    },
    preferredSkillsMatch: {
      weight: 20,
      score: preferred.score,
      matched: preferred.matched.length,
      total: preferredSkills.length,
    },
    projectInternshipRelevance: {
      weight: 20,
      score: project.score,
      matchedTerms: project.matchedTerms,
    },
    certificationEducationSupport: {
      weight: 10,
      score: certification.score,
      evidence: certification.evidence,
    },
    recencyConfidence: {
      weight: 5,
      score: recencyConfidence,
      resumeAnalysisConfidence: Number(latestResumeAnalysis.confidence),
      jobDescriptionAnalysisConfidence: Number(latestJobAnalysis.confidence),
    },
  };

  const saved = await database.$transaction(async (transaction) => {
    const match = await transaction.resumeJobMatch.create({
      data: {
        userId: resume.userId,
        resumeId: resume.id,
        jobDescriptionId: jobDescription.id,
        matchScore,
        matchedSkills: matchedSkills as Prisma.InputJsonValue,
        missingSkills: missingSkills as Prisma.InputJsonValue,
        weakSkills: weakSkills as Prisma.InputJsonValue,
        strongSkills: strongSkills as Prisma.InputJsonValue,
        roleFitSummary,
        suggestions: improvementSuggestions as Prisma.InputJsonValue,
        scoreBreakdown: scoreBreakdown as Prisma.InputJsonValue,
        createdBy: actor.id,
        updatedBy: actor.id,
        metadata: {
          resumeAnalysisId: latestResumeAnalysis.id,
          jobDescriptionAnalysisId: latestJobAnalysis.id,
        },
      },
      select: matchSelect,
    });

    await transaction.auditEvent.create({
      data: auditData(context, {
        actorId: actor.id,
        userId: resume.userId,
        matchId: match.id,
        resumeId: resume.id,
        jobDescriptionId: jobDescription.id,
        matchScore,
      }),
    });

    return match;
  });
  const aiSuggestion = await aiMatchSuggestionService.generateAndStore({
    actorId: actor.id,
    userId: resume.userId,
    matchId: saved.id,
    matchScore,
    matchedSkills,
    missingSkills,
    weakSkills,
    targetRole: roleTitle,
    jobDescriptionSummary: jobDescriptionSummaryForSuggestions(jobData, jobDescription.company),
    context,
  });

  return {
    id: saved.id,
    resumeId: saved.resumeId,
    jobDescriptionId: saved.jobDescriptionId,
    matchScore: Number(saved.matchScore),
    matchedSkills: saved.matchedSkills,
    missingSkills: saved.missingSkills,
    weakSkills: saved.weakSkills,
    strongSkills: saved.strongSkills,
    roleFitSummary: saved.roleFitSummary,
    improvementSuggestions: saved.suggestions,
    aiImprovementSuggestions: aiSuggestion.suggestion,
    aiSuggestionMetadata: {
      id: aiSuggestion.id,
      model: aiSuggestion.aiModel,
      promptVersion: aiSuggestion.promptVersion,
      confidence: aiSuggestion.confidence,
      executionTimeMs: aiSuggestion.executionTimeMs,
      fallbackUsed: aiSuggestion.fallbackUsed,
      generatedAt: aiSuggestion.generatedAt,
    },
    scoreBreakdown: saved.scoreBreakdown,
    generatedAt: saved.generatedAt,
  };
};
