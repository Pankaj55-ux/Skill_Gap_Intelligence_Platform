import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/70">
      {icon ? <div className="mb-3 flex justify-center text-slate-400">{icon}</div> : null}
      <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
      {description ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
    </div>
  );
}
