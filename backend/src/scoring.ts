type Level = "Beginner" | "Intermediate" | "Advanced";
const levelScore: Record<Level, number> = { Beginner: 0.3, Intermediate: 0.7, Advanced: 1 };
const rank: Record<Level, number> = { Beginner: 1, Intermediate: 2, Advanced: 3 };

export interface RequiredSkill { skillName: string; weight: number; requiredLevel: Level; importance?: string }
export interface StudentSkill { _id?: unknown; name: string; proficiency: Level; verified?: boolean }

export function calculateGap(required: RequiredSkill[], student: StudentSkill[], evidenceSkillIds: string[] = []) {
  const lookup = new Map(student.map(skill => [skill.name.trim().toLowerCase(), skill]));
  const totalWeight = required.reduce((sum, item) => sum + item.weight, 0) || 1;
  let earned = 0;
  const matchedSkills: any[] = [], missingSkills: any[] = [], weakSkills: any[] = [], strongSkills: any[] = [];
  const skillBreakdown = required.map(req => {
    const current = lookup.get(req.skillName.toLowerCase());
    const contribution = current ? req.weight * levelScore[current.proficiency] : 0;
    earned += contribution;
    const entry = {
      skill: req.skillName, requiredLevel: req.requiredLevel,
      currentLevel: current?.proficiency ?? "Missing",
      weight: req.weight, score: Math.round((current ? levelScore[current.proficiency] : 0) * 100),
      status: !current ? "missing" : rank[current.proficiency] < rank[req.requiredLevel] ? "weak" : "matched"
    };
    if (!current) missingSkills.push(entry);
    else if (entry.status === "weak") weakSkills.push(entry);
    else { matchedSkills.push(entry); if (current.proficiency === "Advanced") strongSkills.push(entry); }
    return entry;
  });
  const relevant = student.filter(s => required.some(r => r.skillName.toLowerCase() === s.name.toLowerCase()));
  const evidenced = relevant.filter(s => evidenceSkillIds.includes(String(s._id))).length;
  return {
    readinessScore: Math.round((earned / totalWeight) * 100),
    matchedSkills, missingSkills, weakSkills, strongSkills, skillBreakdown,
    evidenceCoverage: relevant.length ? Math.round((evidenced / relevant.length) * 100) : 0
  };
}
