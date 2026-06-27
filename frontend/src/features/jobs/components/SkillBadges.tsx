interface SkillBadgesProps {
  skills: string[];
  tone?: "blue" | "slate" | "emerald";
  limit?: number;
}

export function SkillBadges({ skills, tone = "blue", limit }: SkillBadgesProps) {
  const visible = typeof limit === "number" ? skills.slice(0, limit) : skills;
  const remaining = typeof limit === "number" ? Math.max(0, skills.length - limit) : 0;
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-900",
    slate: "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-900",
  }[tone];

  if (skills.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No skills listed.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((skill) => (
        <span key={skill} className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${toneClass}`}>
          {skill}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          +{remaining} more
        </span>
      ) : null}
    </div>
  );
}
