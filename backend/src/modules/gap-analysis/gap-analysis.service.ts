import { database } from "../../database/index.js";
import { AppError } from "../../errors/app-error.js";
import {
  EvidenceVerifiedStatus,
  Prisma,
  ProficiencyLevel,
  RecordStatus,
} from "../../generated/prisma/client.js";
import type { RunGapAnalysisInput } from "./gap-analysis.schemas.js";

export interface AuditContext {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
}

const SCORE_WEIGHTS = {
  profileCompletion: 15,
  requiredSkillMatch: 40,
  evidenceStrength: 25,
  skillLevelCompatibility: 20,
} as const;

const levelRank: Record<ProficiencyLevel, number> = {
  [ProficiencyLevel.BEGINNER]: 1,
  [ProficiencyLevel.INTERMEDIATE]: 2,
  [ProficiencyLevel.ADVANCED]: 3,
};

interface RequiredSkillInput {
  skillId?: string;
  skillName: string;
  requiredLevel: ProficiencyLevel;
  weight: number;
  isMandatory: boolean;
}

interface SkillAnalysisEntry {
  skillId?: string;
  skillName: string;
  requiredLevel: ProficiencyLevel;
  currentLevel: ProficiencyLevel | "MISSING";
  evidenceStatus: EvidenceVerifiedStatus | "NONE";
  weight: number;
  isMandatory: boolean;
  levelCompatibility: number;
  status: "matched" | "weak" | "missing";
}

const gapReportSelect = {
  id: true,
  userId: true,
  careerRoleId: true,
  readinessScore: true,
  evidenceCoverage: true,
  matchedSkills: true,
  weakSkills: true,
  missingSkills: true,
  explanation: true,
  recommendations: true,
  generatedAt: true,
  createdAt: true,
  careerRole: {
    select: {
      id: true,
      title: true,
      level: true,
    },
  },
} satisfies Prisma.GapReportSelect;

type SelectedGapReport = Prisma.GapReportGetPayload<{ select: typeof gapReportSelect }>;

const normalizeSkillName = (skillName: string): string => skillName.trim().toLocaleLowerCase("en-US");

const roundScore = (score: number): number => Math.round(score * 100) / 100;

const toNumber = (value: Prisma.Decimal | number): number => Number(value);

const toJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const nonEmptyJsonArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const hasProfileData = (profile: {
  profileCompletionPercentage: number;
  fullName: string | null;
  college: string | null;
  branch: string | null;
  graduationYear: number | null;
  targetRole: string | null;
  currentSkills: Prisma.JsonValue | null;
}): boolean => profile.profileCompletionPercentage > 0
  || Boolean(profile.fullName)
  || Boolean(profile.college)
  || Boolean(profile.branch)
  || profile.graduationYear !== null
  || Boolean(profile.targetRole)
  || nonEmptyJsonArray(profile.currentSkills).length > 0;

const jsonSkillRequirements = (
  skillNames: string[],
  requiredLevel: ProficiencyLevel,
): RequiredSkillInput[] => skillNames.map((skillName) => ({
  skillName,
  requiredLevel,
  weight: 1,
  isMandatory: true,
}));

const auditData = (
  context: AuditContext,
  options: { userId: string; reportId: string; targetCareerRoleId: string; readinessScore: number },
): Prisma.AuditEventCreateInput => ({
  action: "gap_analysis_completed",
  entityType: "GapReport",
  entityId: options.reportId,
  payload: {
    targetCareerRoleId: options.targetCareerRoleId,
    readinessScore: options.readinessScore,
  },
  ipAddress: context.ipAddress,
  userAgent: context.userAgent,
  metadata: { requestId: context.requestId },
  createdBy: options.userId,
  updatedBy: options.userId,
  user: { connect: { id: options.userId } },
  actor: { connect: { id: options.userId } },
});

const strongestEvidenceBySkill = (evidence: Array<{
  skillId: string;
  proficiency: ProficiencyLevel | null;
  verifiedStatus: EvidenceVerifiedStatus;
  skill: { normalizedName: string; name: string };
}>) => {
  const lookup = new Map<string, {
    skillId: string;
    skillName: string;
    proficiency: ProficiencyLevel;
    verifiedStatus: EvidenceVerifiedStatus;
  }>();

  for (const item of evidence) {
    if (!item.proficiency || item.verifiedStatus === EvidenceVerifiedStatus.REJECTED) continue;

    const keys = [item.skillId, item.skill.normalizedName];
    for (const key of keys) {
      const existing = lookup.get(key);
      const currentIsStronger = !existing
        || levelRank[item.proficiency] > levelRank[existing.proficiency]
        || (
          levelRank[item.proficiency] === levelRank[existing.proficiency]
          && item.verifiedStatus === EvidenceVerifiedStatus.VERIFIED
          && existing.verifiedStatus !== EvidenceVerifiedStatus.VERIFIED
        );

      if (currentIsStronger) {
        lookup.set(key, {
          skillId: item.skillId,
          skillName: item.skill.name,
          proficiency: item.proficiency,
          verifiedStatus: item.verifiedStatus,
        });
      }
    }
  }

  return lookup;
};

export const calculateDeterministicGapAnalysis = (
  input: {
    profileCompletionPercentage: number;
    requiredSkills: RequiredSkillInput[];
    evidence: Array<{
      skillId: string;
      proficiency: ProficiencyLevel | null;
      verifiedStatus: EvidenceVerifiedStatus;
      skill: { normalizedName: string; name: string };
    }>;
  },
) => {
  const evidenceLookup = strongestEvidenceBySkill(input.evidence);
  const totalWeight = input.requiredSkills.reduce((sum, skill) => sum + skill.weight, 0) || 1;

  let matchedWeight = 0;
  let verifiedMatchedWeight = 0;
  let levelCompatibilityWeighted = 0;

  const matchedSkills: SkillAnalysisEntry[] = [];
  const weakSkills: SkillAnalysisEntry[] = [];
  const missingSkills: SkillAnalysisEntry[] = [];

  for (const requirement of input.requiredSkills) {
    const evidence = evidenceLookup.get(requirement.skillId ?? "")
      ?? evidenceLookup.get(normalizeSkillName(requirement.skillName));

    const currentLevel = evidence?.proficiency ?? "MISSING";
    const requiredRank = levelRank[requirement.requiredLevel];
    const currentRank = evidence ? levelRank[evidence.proficiency] : 0;
    const levelCompatibility = evidence ? Math.min(currentRank / requiredRank, 1) : 0;
    const status = !evidence
      ? "missing"
      : currentRank >= requiredRank ? "matched" : "weak";

    if (evidence) matchedWeight += requirement.weight;
    if (evidence?.verifiedStatus === EvidenceVerifiedStatus.VERIFIED) {
      verifiedMatchedWeight += requirement.weight;
    }
    levelCompatibilityWeighted += levelCompatibility * requirement.weight;

    const entry: SkillAnalysisEntry = {
      skillId: requirement.skillId,
      skillName: requirement.skillName,
      requiredLevel: requirement.requiredLevel,
      currentLevel,
      evidenceStatus: evidence?.verifiedStatus ?? "NONE",
      weight: requirement.weight,
      isMandatory: requirement.isMandatory,
      levelCompatibility: roundScore(levelCompatibility * 100),
      status,
    };

    if (status === "matched") matchedSkills.push(entry);
    else if (status === "weak") weakSkills.push(entry);
    else missingSkills.push(entry);
  }

  const componentScores = {
    profileCompletion: roundScore((Math.min(input.profileCompletionPercentage, 100) / 100) * SCORE_WEIGHTS.profileCompletion),
    requiredSkillMatch: roundScore((matchedWeight / totalWeight) * SCORE_WEIGHTS.requiredSkillMatch),
    evidenceStrength: roundScore((verifiedMatchedWeight / totalWeight) * SCORE_WEIGHTS.evidenceStrength),
    skillLevelCompatibility: roundScore((levelCompatibilityWeighted / totalWeight) * SCORE_WEIGHTS.skillLevelCompatibility),
  };

  const readinessScore = roundScore(
    componentScores.profileCompletion
    + componentScores.requiredSkillMatch
    + componentScores.evidenceStrength
    + componentScores.skillLevelCompatibility,
  );

  const evidenceCoverage = roundScore((verifiedMatchedWeight / totalWeight) * 100);
  const explanation = [
    `Readiness score is ${readinessScore}/100.`,
    `Profile completion contributed ${componentScores.profileCompletion}/${SCORE_WEIGHTS.profileCompletion}.`,
    `Required skill match contributed ${componentScores.requiredSkillMatch}/${SCORE_WEIGHTS.requiredSkillMatch}.`,
    `Verified evidence strength contributed ${componentScores.evidenceStrength}/${SCORE_WEIGHTS.evidenceStrength}.`,
    `Skill level compatibility contributed ${componentScores.skillLevelCompatibility}/${SCORE_WEIGHTS.skillLevelCompatibility}.`,
  ].join(" ");

  return {
    readinessScore,
    evidenceCoverage,
    matchedSkills,
    missingSkills,
    weakSkills,
    explanation,
    componentScores,
    weights: SCORE_WEIGHTS,
  };
};

const toApiReport = (report: SelectedGapReport) => ({
  ...report,
  readinessScore: toNumber(report.readinessScore),
  evidenceCoverage: report.evidenceCoverage === null ? null : toNumber(report.evidenceCoverage),
});

export const runGapAnalysis = async (
  userId: string,
  input: RunGapAnalysisInput,
  context: AuditContext,
) => {
  const [profile, careerRole, evidence] = await Promise.all([
    database.studentProfile.findFirst({
      where: { userId, status: RecordStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        college: true,
        branch: true,
        graduationYear: true,
        targetRole: true,
        currentSkills: true,
        profileCompletionPercentage: true,
      },
    }),
    database.careerRole.findFirst({
      where: { id: input.targetCareerRoleId, status: RecordStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        title: true,
        level: true,
        requiredSkills: true,
        requirements: {
          where: { status: RecordStatus.ACTIVE, deletedAt: null },
          select: {
            skillId: true,
            requiredLevel: true,
            weight: true,
            isMandatory: true,
            skill: { select: { name: true } },
          },
        },
      },
    }),
    database.skillEvidence.findMany({
      where: {
        userId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
        verifiedStatus: { not: EvidenceVerifiedStatus.REJECTED },
      },
      select: {
        skillId: true,
        proficiency: true,
        verifiedStatus: true,
        skill: { select: { normalizedName: true, name: true } },
      },
    }),
  ]);

  if (!profile || !hasProfileData(profile)) {
    throw new AppError(
      400,
      "STUDENT_PROFILE_REQUIRED",
      "Complete your student profile before running gap analysis",
    );
  }

  if (!careerRole) {
    throw new AppError(404, "CAREER_ROLE_NOT_FOUND", "Target career role was not found");
  }

  const requiredSkills = careerRole.requirements.length > 0
    ? careerRole.requirements.map((requirement): RequiredSkillInput => ({
      skillId: requirement.skillId,
      skillName: requirement.skill.name,
      requiredLevel: requirement.requiredLevel,
      weight: Number(requirement.weight),
      isMandatory: requirement.isMandatory,
    }))
    : jsonSkillRequirements(nonEmptyJsonArray(careerRole.requiredSkills), careerRole.level);

  if (requiredSkills.length === 0) {
    throw new AppError(
      400,
      "CAREER_ROLE_REQUIREMENTS_REQUIRED",
      "Target career role has no required skills configured",
    );
  }

  if (evidence.length === 0) {
    throw new AppError(
      400,
      "SKILL_EVIDENCE_REQUIRED",
      "Add at least one pending or verified skill evidence item before running gap analysis",
    );
  }

  const result = calculateDeterministicGapAnalysis({
    profileCompletionPercentage: profile.profileCompletionPercentage,
    requiredSkills,
    evidence,
  });

  const recommendations = [...result.missingSkills, ...result.weakSkills]
    .slice(0, 5)
    .map((skill) => ({
      skillName: skill.skillName,
      requiredLevel: skill.requiredLevel,
      reason: skill.status === "missing"
        ? "No evidence found for this required skill"
        : "Evidence exists but proficiency is below the required level",
    }));

  const report = await database.$transaction(async (transaction) => {
    const createdReport = await transaction.gapReport.create({
      data: {
        userId,
        careerRoleId: careerRole.id,
        readinessScore: result.readinessScore,
        evidenceCoverage: result.evidenceCoverage,
        matchedSkills: toJson(result.matchedSkills),
        weakSkills: toJson(result.weakSkills),
        missingSkills: toJson(result.missingSkills),
        explanation: result.explanation,
        recommendations: toJson(recommendations),
        createdBy: userId,
        updatedBy: userId,
        metadata: {
          componentScores: result.componentScores,
          weights: result.weights,
          profileCompletionPercentage: profile.profileCompletionPercentage,
        },
      },
      select: { id: true },
    });

    await transaction.auditEvent.create({
      data: auditData(context, {
        userId,
        reportId: createdReport.id,
        targetCareerRoleId: careerRole.id,
        readinessScore: result.readinessScore,
      }),
    });

    return transaction.gapReport.findUniqueOrThrow({
      where: { id: createdReport.id },
      select: gapReportSelect,
    });
  });

  return {
    report: toApiReport(report),
    analysis: {
      targetCareerRole: {
        id: careerRole.id,
        title: careerRole.title,
      },
      matchedSkills: result.matchedSkills,
      missingSkills: result.missingSkills,
      weakSkills: result.weakSkills,
      readinessScore: result.readinessScore,
      evidenceCoverage: result.evidenceCoverage,
      explanation: result.explanation,
      componentScores: result.componentScores,
      weights: result.weights,
    },
  };
};
