import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden p-10 lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb_0,transparent_35%),radial-gradient(circle_at_bottom_right,#14b8a6_0,transparent_30%)] opacity-70" />
          <div className="relative z-10 flex h-full flex-col justify-between rounded-[2rem] border border-white/10 bg-white/10 p-10 shadow-2xl backdrop-blur">
            <div>
              <div className="inline-flex rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">
                Skill Gap Intelligence
              </div>
              <h1 className="mt-8 max-w-xl text-5xl font-black leading-tight">
                Turn career gaps into measurable progress.
              </h1>
              <p className="mt-5 max-w-lg text-base text-blue-50/85">
                Secure access for students, mentors, placement teams, and administrators.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm text-blue-50/85">
              <div className="rounded-2xl bg-white/10 p-4">AI roadmap</div>
              <div className="rounded-2xl bg-white/10 p-4">Resume intelligence</div>
              <div className="rounded-2xl bg-white/10 p-4">Interview readiness</div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-400">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">{title}</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            <div className="mt-8">{children}</div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}
