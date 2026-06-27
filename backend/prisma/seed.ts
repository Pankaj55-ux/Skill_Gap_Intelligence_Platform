import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  ProficiencyLevel,
  RecordStatus,
  UserRole,
} from "../src/generated/prisma/client.js";

const databaseUrl = process.env.DATABASE_URL
  ?? "postgresql://sgip:sgip@localhost:5432/sgip?schema=public";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const demoPasswordHash = await bcrypt.hash("Password123!", 12);

const demoUsers = [
  { email: "student@sgip.local", displayName: "Demo Student", role: UserRole.STUDENT },
  { email: "mentor@sgip.local", displayName: "Demo Mentor", role: UserRole.MENTOR },
  { email: "placement@sgip.local", displayName: "Demo Placement Officer", role: UserRole.PLACEMENT_OFFICER },
  { email: "admin@sgip.local", displayName: "Demo Administrator", role: UserRole.ADMIN },
] as const;

const skillDefinitions = [
  { name: "TypeScript", category: "Programming" },
  { name: "React", category: "Frontend" },
  { name: "Node.js", category: "Backend" },
  { name: "PostgreSQL", category: "Database" },
  { name: "REST API Design", category: "Architecture" },
  { name: "Data Structures and Algorithms", category: "Computer Science" },
] as const;

const roleDefinitions = [
  {
    slug: "full-stack-developer",
    title: "Full-Stack Developer",
    description: "Builds reliable web applications across frontend, backend, and data layers.",
    level: ProficiencyLevel.INTERMEDIATE,
    requiredSkills: ["TypeScript", "React", "Node.js", "PostgreSQL", "REST API Design"],
    niceToHaveSkills: ["Testing", "Docker", "Cloud Deployment"],
    minExperience: 1,
    roadmapTags: ["frontend", "backend", "apis"],
    industry: "Software Engineering",
    requirements: [
      ["typescript", ProficiencyLevel.ADVANCED, 1.25],
      ["react", ProficiencyLevel.INTERMEDIATE, 1],
      ["node.js", ProficiencyLevel.ADVANCED, 1.25],
      ["postgresql", ProficiencyLevel.INTERMEDIATE, 1],
      ["rest api design", ProficiencyLevel.INTERMEDIATE, 1],
    ],
  },
  {
    slug: "backend-developer",
    title: "Backend Developer",
    description: "Designs secure APIs, services, and persistence layers.",
    level: ProficiencyLevel.ADVANCED,
    requiredSkills: ["TypeScript", "Node.js", "PostgreSQL", "REST API Design", "Data Structures and Algorithms"],
    niceToHaveSkills: ["Distributed Systems", "Docker", "Observability"],
    minExperience: 2,
    roadmapTags: ["backend", "databases", "system-design"],
    industry: "Software Engineering",
    requirements: [
      ["typescript", ProficiencyLevel.ADVANCED, 1.25],
      ["node.js", ProficiencyLevel.ADVANCED, 1.5],
      ["postgresql", ProficiencyLevel.ADVANCED, 1.25],
      ["rest api design", ProficiencyLevel.ADVANCED, 1.25],
      ["data structures and algorithms", ProficiencyLevel.INTERMEDIATE, 1],
    ],
  },
] as const;

const seed = async (): Promise<void> => {
  const users = await Promise.all(demoUsers.map((user) => prisma.user.upsert({
    where: { email: user.email },
    create: { ...user, passwordHash: demoPasswordHash, status: RecordStatus.ACTIVE },
    update: {
      displayName: user.displayName,
      role: user.role,
      passwordHash: demoPasswordHash,
      status: RecordStatus.ACTIVE,
    },
  })));

  const student = users.find((user) => user.role === UserRole.STUDENT);
  if (!student) throw new Error("Demo student could not be seeded");

  const skills = new Map<string, { id: string }>();
  for (const definition of skillDefinitions) {
    const normalizedName = definition.name.toLocaleLowerCase("en-US");
    const skill = await prisma.skill.upsert({
      where: { normalizedName },
      update: { name: definition.name, category: definition.category, status: RecordStatus.ACTIVE },
      create: { ...definition, normalizedName, status: RecordStatus.ACTIVE },
      select: { id: true },
    });
    skills.set(normalizedName, skill);
  }

  let firstRoleId: string | undefined;
  for (const definition of roleDefinitions) {
    const role = await prisma.careerRole.upsert({
      where: { slug: definition.slug },
      update: {
        title: definition.title,
        description: definition.description,
        level: definition.level,
        requiredSkills: definition.requiredSkills,
        niceToHaveSkills: definition.niceToHaveSkills,
        minExperience: definition.minExperience,
        roadmapTags: definition.roadmapTags,
        industry: definition.industry,
        status: RecordStatus.ACTIVE,
      },
      create: {
        slug: definition.slug,
        title: definition.title,
        description: definition.description,
        level: definition.level,
        requiredSkills: definition.requiredSkills,
        niceToHaveSkills: definition.niceToHaveSkills,
        minExperience: definition.minExperience,
        roadmapTags: definition.roadmapTags,
        industry: definition.industry,
        status: RecordStatus.ACTIVE,
      },
    });
    firstRoleId ??= role.id;

    for (const [normalizedSkillName, requiredLevel, weight] of definition.requirements) {
      const skill = skills.get(normalizedSkillName);
      if (!skill) throw new Error(`Seed skill ${normalizedSkillName} was not found`);

      await prisma.roleRequirement.upsert({
        where: {
          careerRoleId_skillId: { careerRoleId: role.id, skillId: skill.id },
        },
        update: { requiredLevel, weight, status: RecordStatus.ACTIVE },
        create: {
          careerRoleId: role.id,
          skillId: skill.id,
          requiredLevel,
          weight,
          status: RecordStatus.ACTIVE,
        },
      });
    }
  }

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      fullName: "Demo Student",
      college: "Demo Institute of Technology",
      branch: "Computer Science",
      graduationYear: 2027,
      targetRole: "Full-Stack Developer",
      currentSkills: ["TypeScript", "React", "Node.js"],
      preferredCompanies: ["TCS", "Infosys", "Zoho"],
      profileCompletionPercentage: 88,
      targetCareerRoleId: firstRoleId,
      status: RecordStatus.ACTIVE,
    },
    create: {
      userId: student.id,
      fullName: "Demo Student",
      college: "Demo Institute of Technology",
      branch: "Computer Science",
      graduationYear: 2027,
      targetRole: "Full-Stack Developer",
      currentSkills: ["TypeScript", "React", "Node.js"],
      preferredCompanies: ["TCS", "Infosys", "Zoho"],
      profileCompletionPercentage: 88,
      headline: "Aspiring software engineer",
      institution: "Demo Institute of Technology",
      targetCareerRoleId: firstRoleId,
      status: RecordStatus.ACTIVE,
    },
  });

  console.info(`Seeded ${users.length} users, ${skills.size} skills, and ${roleDefinitions.length} career roles.`);
};

seed()
  .catch((error: unknown) => {
    console.error("Database seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
