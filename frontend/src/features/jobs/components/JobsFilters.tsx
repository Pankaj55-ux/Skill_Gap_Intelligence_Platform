import { Search, SlidersHorizontal, X } from "lucide-react";
import type { CareerRoleLevel } from "../jobs.types";

interface JobsFiltersProps {
  search: string;
  level: string;
  skill: string;
  sort: string;
  onChange: (next: { search?: string; level?: CareerRoleLevel | ""; skill?: string; sort?: string }) => void;
  onReset: () => void;
}

export function JobsFilters({ search, level, skill, sort, onChange, onReset }: JobsFiltersProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
        <h2 className="font-bold text-slate-950 dark:text-white">Search & Filters</h2>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.9fr_0.8fr_auto]">
        <label className="relative block">
          <span className="sr-only">Search roles</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            className="input pl-9"
            value={search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Search by role title"
          />
        </label>

        <label className="block">
          <span className="sr-only">Filter by level</span>
          <select className="input" value={level} onChange={(event) => onChange({ level: event.target.value as CareerRoleLevel | "" })}>
            <option value="">All levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </label>

        <label className="block">
          <span className="sr-only">Filter by skill</span>
          <input
            className="input"
            value={skill}
            onChange={(event) => onChange({ skill: event.target.value })}
            placeholder="Skill filter"
          />
        </label>

        <label className="block">
          <span className="sr-only">Sort roles</span>
          <select className="input" value={sort} onChange={(event) => onChange({ sort: event.target.value })}>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
            <option value="newest">Newest</option>
            <option value="experience-asc">Experience low-high</option>
          </select>
        </label>

        <button type="button" onClick={onReset} className="btn-secondary">
          <X className="h-4 w-4" aria-hidden="true" />
          Reset
        </button>
      </div>
    </section>
  );
}
