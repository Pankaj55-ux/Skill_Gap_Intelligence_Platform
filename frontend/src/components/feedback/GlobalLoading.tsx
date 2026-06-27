import { Loader2 } from "lucide-react";

export function GlobalLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-200">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
        <span className="text-sm font-medium">Loading workspace…</span>
      </div>
    </div>
  );
}
