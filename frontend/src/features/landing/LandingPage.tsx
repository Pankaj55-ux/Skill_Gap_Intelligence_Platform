import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  GraduationCap,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Workflow,
} from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "../../constants/routes";
import { useUiStore } from "../../store/ui.store";

const features = [
  {
    title: "Skill gap intelligence",
    description: "Compare verified skills, target roles, resumes, and job descriptions with explainable scoring.",
    icon: Target,
  },
  {
    title: "Resume intelligence pipeline",
    description: "Upload, parse, analyze, normalize, and match resumes through a structured backend workflow.",
    icon: FileSearch,
  },
  {
    title: "Personalized roadmaps",
    description: "Turn gap reports into prioritized learning phases with progress tracking and readiness updates.",
    icon: Workflow,
  },
  {
    title: "Interview readiness",
    description: "Prepare with answer evaluation, interview history, and a backend-ready voice interview architecture.",
    icon: BrainCircuit,
  },
];

const steps = [
  "Create a secure student profile",
  "Add resume, skill evidence, and target role",
  "Run deterministic gap analysis and matching",
  "Follow a personalized roadmap and track progress",
];

const benefits = [
  "Explainable readiness scoring instead of black-box advice",
  "Role-aware access for students, mentors, placement teams, and admins",
  "Reusable services for skills, resumes, jobs, analytics, and notifications",
  "Built for real institutional workflows without dashboard clutter on the landing page",
];

const platformMetrics = [
  { label: "Readiness score", value: "Calculated from student data" },
  { label: "Roadmap progress", value: "Updated from completion logs" },
  { label: "Resume match score", value: "Generated per selected job" },
  { label: "Interview trend", value: "Available after evaluations" },
];

const faqs = [
  {
    question: "Does the platform use fake benchmark data?",
    answer: "No. Landing-page metrics are intentionally descriptive. Product analytics are calculated only from real database records.",
  },
  {
    question: "Can students register directly?",
    answer: "Yes. Student registration is supported. Mentor, placement officer, and admin accounts are managed through privileged workflows.",
  },
  {
    question: "Is AI used for every score?",
    answer: "No. Core scores are deterministic and explainable. AI is reserved for structured extraction, suggestions, and evaluation support.",
  },
  {
    question: "Is this page connected to dashboard components?",
    answer: "No. This is a public marketing page with CTAs into authentication routes only.",
  },
];

function SeoMetadata() {
  useEffect(() => {
    document.title = "Skill Gap Intelligence Platform | Career Readiness SaaS";

    const description = "A premium Skill Gap Intelligence Platform for resume analysis, career role matching, learning roadmaps, and placement readiness.";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, []);

  return null;
}

function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const darkNext = theme !== "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(darkNext ? "dark" : "light")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-200 dark:hover:border-blue-800 dark:hover:text-blue-300 dark:focus:ring-blue-950"
      aria-label={darkNext ? "Switch to dark mode" : "Switch to light mode"}
    >
      {darkNext ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">{title}</h2>
      <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <SeoMetadata />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,1))] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_32%),radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.18),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(2,6,23,1))]" />

      <header className="sticky top-0 z-30 border-b border-white/50 bg-white/75 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/75">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <Link to={routePaths.home} className="flex items-center gap-3 font-extrabold tracking-tight text-slate-950 dark:text-white">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>SGIP</span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex dark:text-slate-300">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-300">Features</a>
            <a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-300">How it works</a>
            <a href="#faq" className="hover:text-blue-600 dark:hover:text-blue-300">FAQ</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link to={routePaths.login} className="btn-secondary hidden sm:inline-flex">Login</Link>
            <Link to={routePaths.register} className="btn-primary">Register</Link>
          </div>
        </nav>
      </header>

      <section className="relative px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8" aria-labelledby="hero-title">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Career readiness intelligence for modern placement teams
            </div>
            <h1 id="hero-title" className="mt-8 max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl dark:text-white">
              Turn skill gaps into a measurable path to placement readiness.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              SGIP brings profiles, resumes, role requirements, roadmaps, interview readiness, and analytics into one structured SaaS experience.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to={routePaths.register} className="btn-primary px-6 py-3 text-base">
                Register <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to={routePaths.login} className="btn-secondary px-6 py-3 text-base">
                Login
              </Link>
              <a href="#features" className="btn rounded-xl border border-transparent px-6 py-3 text-base text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-slate-900">
                Explore Features <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
            aria-label="Platform capability preview"
          >
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-blue-500/20 via-cyan-400/10 to-indigo-500/20 blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/70 bg-white/80 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/30">
              <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white dark:bg-black">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-blue-300">Readiness workspace</p>
                    <p className="mt-1 text-xl font-bold">Explainable pipeline</p>
                  </div>
                  <ShieldCheck className="h-8 w-8 text-emerald-300" aria-hidden="true" />
                </div>
                <div className="space-y-3">
                  {["Profile signals", "Verified evidence", "Role requirements", "Roadmap progress"].map((item, index) => (
                    <div key={item} className="flex items-center justify-between rounded-2xl bg-white/8 p-4">
                      <span className="flex items-center gap-3 text-sm font-semibold">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-500/20 text-blue-200">{index + 1}</span>
                        {item}
                      </span>
                      <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="features-title">
        <SectionHeading
          eyebrow="Features"
          title="A complete backend-ready career readiness platform"
          description="Designed around real product modules: authentication, profiles, skill evidence, gap analysis, roadmaps, resumes, jobs, matching, analytics, and notifications."
        />
        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="card group hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/5 dark:hover:shadow-black/30"
              >
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/60 dark:text-blue-200">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.description}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="how-title">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-card sm:p-10 dark:border-slate-800 dark:bg-slate-900">
          <SectionHeading
            eyebrow="How it works"
            title="From profile to placement signals"
            description="The platform follows a structured, auditable workflow so students and teams can understand how readiness is improving."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="relative rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <span className="mb-5 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white">{index + 1}</span>
                <p className="font-bold text-slate-950 dark:text-white">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="benefits-title">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">Benefits</p>
            <h2 id="benefits-title" className="mt-4 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">Built for serious placement operations.</h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              SGIP favors accountable workflows, server-side authorization, and explainable outputs over superficial dashboards.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="statistics-title">
        <SectionHeading
          eyebrow="Statistics"
          title="No vanity numbers. Only metrics calculated from real usage."
          description="This public page does not invent adoption, placement, or satisfaction statistics. Once users create records, the product dashboard calculates metrics directly from the database."
        />
        <div className="mx-auto mt-12 grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {platformMetrics.map((metric) => (
            <div key={metric.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <BarChart3 className="mb-5 h-7 w-7 text-blue-600 dark:text-blue-300" aria-hidden="true" />
              <h3 className="font-bold text-slate-950 dark:text-white">{metric.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="testimonials-title">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-8 text-center shadow-card dark:border-blue-950 dark:from-blue-950/40 dark:to-slate-900">
          <BookOpenCheck className="mx-auto h-10 w-10 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">Testimonials</p>
          <h2 id="testimonials-title" className="mt-4 text-3xl font-extrabold text-slate-950 dark:text-white">No public testimonials yet.</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">
            Testimonials will appear here only after real users or institutions provide permission to publish them.
          </p>
        </div>
      </section>

      <section id="faq" className="px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="faq-title">
        <SectionHeading
          eyebrow="FAQ"
          title="Clear answers before you sign in"
          description="A few practical notes about registration, scoring, data honesty, and the current landing page scope."
        />
        <div className="mx-auto mt-10 max-w-4xl space-y-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <summary className="cursor-pointer list-none font-bold text-slate-950 outline-none focus-visible:ring-4 focus-visible:ring-blue-100 dark:text-white dark:focus-visible:ring-blue-950">
                <span className="flex items-center justify-between gap-4">
                  {faq.question}
                  <ChevronRight className="h-5 w-5 text-slate-400 transition group-open:rotate-90" aria-hidden="true" />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 px-4 py-10 sm:px-6 lg:px-8 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-extrabold text-slate-950 dark:text-white">Skill Gap Intelligence Platform</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Career readiness workflows without invented metrics.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={routePaths.login} className="btn-secondary">Login</Link>
            <Link to={routePaths.register} className="btn-primary">Register</Link>
            <a href="#features" className="btn-secondary">Explore Features</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
