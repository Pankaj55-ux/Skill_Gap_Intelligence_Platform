import { database } from "../../database/index.js";
import { Prisma, RecordStatus } from "../../generated/prisma/client.js";
import type { ResumeStructuredData } from "./ai-resume-extractor.service.js";

export interface SkillDictionaryEntry {
  canonical: string;
  category: string;
  aliases: string[];
}

export interface SkillNormalizationInput {
  originalSkill: string;
  category: string;
}

export interface NormalizedSkillResult {
  originalSkill: string;
  normalizedSkill: string;
  category: string;
  confidence: number;
}

const MASTER_SKILL_DICTIONARY: SkillDictionaryEntry[] = [
  { canonical: "Node.js", category: "frameworks", aliases: ["node", "nodejs", "node.js", "node js"] },
  { canonical: "React", category: "frameworks", aliases: ["react", "reactjs", "react.js", "react js"] },
  { canonical: "MongoDB", category: "databases", aliases: ["mongo", "mongodb", "mongo db"] },
  { canonical: "C++", category: "programmingLanguages", aliases: ["c++", "cpp", "c plus plus", "cplusplus"] },
  { canonical: "JavaScript", category: "programmingLanguages", aliases: ["javascript", "js", "ecmascript"] },
  { canonical: "TypeScript", category: "programmingLanguages", aliases: ["typescript", "ts"] },
  { canonical: "Python", category: "programmingLanguages", aliases: ["python"] },
  { canonical: "Java", category: "programmingLanguages", aliases: ["java"] },
  { canonical: "C#", category: "programmingLanguages", aliases: ["c#", "c sharp"] },
  { canonical: "Go", category: "programmingLanguages", aliases: ["golang"] },
  { canonical: "PostgreSQL", category: "databases", aliases: ["postgresql", "postgres", "postgre sql"] },
  { canonical: "MySQL", category: "databases", aliases: ["mysql", "my sql"] },
  { canonical: "SQL", category: "technicalSkills", aliases: ["sql"] },
  { canonical: "Express", category: "frameworks", aliases: ["express", "expressjs", "express.js"] },
  { canonical: "Next.js", category: "frameworks", aliases: ["next", "nextjs", "next.js", "next js"] },
  { canonical: "Angular", category: "frameworks", aliases: ["angular", "angularjs"] },
  { canonical: "Spring Boot", category: "frameworks", aliases: ["spring boot", "springboot"] },
  { canonical: "Django", category: "frameworks", aliases: ["django"] },
  { canonical: "Flask", category: "frameworks", aliases: ["flask"] },
  { canonical: "AWS", category: "cloud", aliases: ["aws", "amazon web services"] },
  { canonical: "Azure", category: "cloud", aliases: ["azure", "microsoft azure"] },
  { canonical: "Google Cloud", category: "cloud", aliases: ["gcp", "google cloud", "google cloud platform"] },
  { canonical: "Docker", category: "tools", aliases: ["docker"] },
  { canonical: "Kubernetes", category: "tools", aliases: ["kubernetes", "k8s"] },
  { canonical: "Git", category: "tools", aliases: ["git"] },
  { canonical: "Linux", category: "tools", aliases: ["linux"] },
  { canonical: "Postman", category: "tools", aliases: ["postman"] },
  { canonical: "REST API", category: "technicalSkills", aliases: ["rest", "rest api", "restful api", "restful apis"] },
  { canonical: "GraphQL", category: "technicalSkills", aliases: ["graphql", "graph ql"] },
];

const normalizeKey = (skill: string): string => skill
  .trim()
  .toLocaleLowerCase("en-US")
  .replace(/\./g, "")
  .replace(/#/g, " sharp")
  .replace(/\s+/g, " ");

const aliasLookup = new Map<string, SkillDictionaryEntry>();
for (const entry of MASTER_SKILL_DICTIONARY) {
  aliasLookup.set(normalizeKey(entry.canonical), entry);
  for (const alias of entry.aliases) {
    aliasLookup.set(normalizeKey(alias), entry);
  }
}

const titleCaseFallback = (skill: string): string => skill.trim().replace(/\s+/g, " ");

const collectStructuredSkills = (data: ResumeStructuredData): SkillNormalizationInput[] => [
  ...data.technicalSkills.map((skill) => ({ originalSkill: skill, category: "technicalSkills" })),
  ...data.frameworks.map((skill) => ({ originalSkill: skill, category: "frameworks" })),
  ...data.databases.map((skill) => ({ originalSkill: skill, category: "databases" })),
  ...data.cloud.map((skill) => ({ originalSkill: skill, category: "cloud" })),
  ...data.tools.map((skill) => ({ originalSkill: skill, category: "tools" })),
  ...data.programmingLanguages.map((skill) => ({ originalSkill: skill, category: "programmingLanguages" })),
  ...data.softSkills.map((skill) => ({ originalSkill: skill, category: "softSkills" })),
  ...data.certifications.map((skill) => ({ originalSkill: skill, category: "certifications" })),
];

export class SkillNormalizerService {
  getDictionary(): readonly SkillDictionaryEntry[] {
    return MASTER_SKILL_DICTIONARY;
  }

  normalizeSkill(input: SkillNormalizationInput): NormalizedSkillResult {
    const key = normalizeKey(input.originalSkill);
    const dictionaryEntry = aliasLookup.get(key);

    if (dictionaryEntry) {
      return {
        originalSkill: input.originalSkill,
        normalizedSkill: dictionaryEntry.canonical,
        category: dictionaryEntry.category,
        confidence: dictionaryEntry.aliases.some((alias) => normalizeKey(alias) === key) ? 0.98 : 1,
      };
    }

    return {
      originalSkill: input.originalSkill,
      normalizedSkill: titleCaseFallback(input.originalSkill),
      category: input.category,
      confidence: 0.7,
    };
  }

  normalizeSkills(inputs: SkillNormalizationInput[]): NormalizedSkillResult[] {
    const normalized = inputs
      .map((input) => this.normalizeSkill(input))
      .filter((item) => item.normalizedSkill.length > 0);
    const deduped = new Map<string, NormalizedSkillResult>();

    for (const item of normalized) {
      const key = `${item.category}:${normalizeKey(item.normalizedSkill)}`;
      const existing = deduped.get(key);
      if (!existing || item.confidence > existing.confidence) {
        deduped.set(key, item);
      }
    }

    return Array.from(deduped.values());
  }

  normalizeResumeAnalysis(data: ResumeStructuredData): NormalizedSkillResult[] {
    return this.normalizeSkills(collectStructuredSkills(data));
  }

  async saveResumeNormalizedSkills(input: {
    resumeId: string;
    userId: string;
    structuredData: ResumeStructuredData;
    transaction?: Prisma.TransactionClient;
  }) {
    const transaction = input.transaction ?? database;
    const normalizedSkills = this.normalizeResumeAnalysis(input.structuredData);

    await transaction.normalizedSkill.updateMany({
      where: {
        resumeId: input.resumeId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
      },
      data: {
        status: RecordStatus.ARCHIVED,
        deletedAt: new Date(),
        updatedBy: input.userId,
      },
    });

    for (const skill of normalizedSkills) {
      await transaction.normalizedSkill.upsert({
        where: {
          resumeId_normalizedSkill_category: {
            resumeId: input.resumeId,
            normalizedSkill: skill.normalizedSkill,
            category: skill.category,
          },
        },
        create: {
          resumeId: input.resumeId,
          originalSkill: skill.originalSkill,
          normalizedSkill: skill.normalizedSkill,
          category: skill.category,
          confidence: skill.confidence,
          createdBy: input.userId,
          updatedBy: input.userId,
        },
        update: {
          originalSkill: skill.originalSkill,
          confidence: skill.confidence,
          status: RecordStatus.ACTIVE,
          deletedAt: null,
          updatedBy: input.userId,
        },
      });
    }

    return normalizedSkills;
  }

  async saveJobDescriptionNormalizedSkills(input: {
    jobDescriptionId: string;
    userId: string;
    skills: SkillNormalizationInput[];
    transaction?: Prisma.TransactionClient;
  }) {
    const transaction = input.transaction ?? database;
    const normalizedSkills = this.normalizeSkills(input.skills);

    await transaction.normalizedSkill.updateMany({
      where: {
        jobDescriptionId: input.jobDescriptionId,
        status: RecordStatus.ACTIVE,
        deletedAt: null,
      },
      data: {
        status: RecordStatus.ARCHIVED,
        deletedAt: new Date(),
        updatedBy: input.userId,
      },
    });

    for (const skill of normalizedSkills) {
      await transaction.normalizedSkill.upsert({
        where: {
          jobDescriptionId_normalizedSkill_category: {
            jobDescriptionId: input.jobDescriptionId,
            normalizedSkill: skill.normalizedSkill,
            category: skill.category,
          },
        },
        create: {
          jobDescriptionId: input.jobDescriptionId,
          originalSkill: skill.originalSkill,
          normalizedSkill: skill.normalizedSkill,
          category: skill.category,
          confidence: skill.confidence,
          createdBy: input.userId,
          updatedBy: input.userId,
        },
        update: {
          originalSkill: skill.originalSkill,
          confidence: skill.confidence,
          status: RecordStatus.ACTIVE,
          deletedAt: null,
          updatedBy: input.userId,
        },
      });
    }

    return normalizedSkills;
  }
}

export const skillNormalizerService = new SkillNormalizerService();
