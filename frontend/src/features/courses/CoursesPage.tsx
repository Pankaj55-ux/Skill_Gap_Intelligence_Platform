import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, CheckCircle2, Clock, ExternalLink, Filter, GraduationCap, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { courseKeyFor, coursesService } from "./courses.service";
import type { CourseLevel, CourseProvider, CourseRecommendationItem, CourseRecommendationRecord } from "./courses.types";

const recommendationsKey = queryKeys.courses.recommendations();
const courseProviders: Array<CourseProvider | ""> = ["", "YouTube", "Coursera", "Udemy", "freeCodeCamp", "NPTEL", "Microsoft Learn", "AWS Skill Builder", "Google Cloud Skills Boost"];
const levels: Array<CourseLevel | ""> = ["", "BEGINNER", "INTERMEDIATE", "ADVANCED"];

interface FlatCourse {
  recommendation: CourseRecommendationRecord;
  course: CourseRecommendationItem;
  key: string;
}

function CourseCard({
  item,
  onBookmark,
  onComplete,
  onProgress,
  updating,
}: {
  item: FlatCourse;
  onBookmark: (item: FlatCourse) => void;
  onComplete: (item: FlatCourse) => void;
  onProgress: (item: FlatCourse, progressPercentage: number) => void;
  updating: boolean;
}) {
  const state = item.recommendation.itemStates[item.key] ?? {};
  const progress = state.completed ? 100 : state.progressPercentage ?? 0;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">{item.course.provider}</p>
          <h2 className="mt-2 text-xl font-extrabold text-slate-950 dark:text-white">{item.course.title}</h2>
        </div>
        <button type="button" onClick={() => onBookmark(item)} disabled={updating} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-blue-600 dark:border-slate-800 dark:text-slate-300 dark:hover:text-blue-300" aria-label="Bookmark course">
          {state.bookmarked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.course.level}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">
          <Clock className="h-3.5 w-3.5" />
          {item.course.duration}
        </span>
        {state.completed ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">COMPLETED</span> : null}
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.course.reason}</p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Skills Covered</p>
        <div className="flex flex-wrap gap-2">
          {item.course.skillsCovered.map((skill) => (
            <span key={skill} className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">{skill}</span>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={progress}
          disabled={updating}
          onChange={(event) => onProgress(item, Number(event.target.value))}
          className="mt-3 w-full accent-blue-600"
          aria-label={`Progress for ${item.course.title}`}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <a href={item.course.url} target="_blank" rel="noreferrer" className="btn-primary flex-1">
          Open Course
          <ExternalLink className="h-4 w-4" />
        </a>
        <button type="button" onClick={() => onComplete(item)} disabled={updating || state.completed} className="btn-secondary flex-1">
          <CheckCircle2 className="h-4 w-4" />
          {state.completed ? "Completed" : "Mark Complete"}
        </button>
      </div>
    </article>
  );
}

export function CoursesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState<CourseProvider | "">("");
  const [level, setLevel] = useState<CourseLevel | "">("");
  const [selectedRoadmapId, setSelectedRoadmapId] = useState("");

  const recommendationsQuery = useQuery({
    queryKey: recommendationsKey,
    queryFn: coursesService.listRecommendations,
    staleTime: queryTimes.short,
  });
  const roadmapsQuery = useQuery({
    queryKey: queryKeys.courses.roadmaps(),
    queryFn: coursesService.listRoadmaps,
    staleTime: queryTimes.medium,
  });

  const generate = useMutation({
    mutationFn: coursesService.generate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recommendationsKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap.list() });
      toast.success("Course recommendations generated");
    },
  });

  const updateState = useMutation({
    mutationFn: coursesService.updateItemState,
    onSuccess: (updated) => {
      queryClient.setQueryData<CourseRecommendationRecord[]>(recommendationsKey, (current) => (
        current?.map((item) => item.id === updated.id ? updated : item) ?? [updated]
      ));
    },
  });

  const courses = useMemo<FlatCourse[]>(() => {
    const flat = (recommendationsQuery.data ?? []).flatMap((recommendation) => (
      recommendation.recommendations.recommendations.map((course) => ({
        recommendation,
        course,
        key: courseKeyFor(course),
      }))
    ));
    return flat.filter((item) => {
      const text = `${item.course.title} ${item.course.reason} ${item.course.skillsCovered.join(" ")}`.toLowerCase();
      return (!search || text.includes(search.toLowerCase()))
        && (!provider || item.course.provider === provider)
        && (!level || item.course.level === level);
    });
  }, [recommendationsQuery.data, search, provider, level]);

  const selectedRoadmap = roadmapsQuery.data?.find((roadmap) => roadmap.id === selectedRoadmapId) ?? roadmapsQuery.data?.[0];

  if (recommendationsQuery.isLoading || roadmapsQuery.isLoading) {
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
  }

  if (recommendationsQuery.isError || roadmapsQuery.isError) {
    return <EmptyState title="Course recommendations could not be loaded" description="Please check your session and try again." />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">Course Recommendations</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-950 sm:text-4xl dark:text-white">Learn the skills your roadmap needs.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Generate and track backend-stored course recommendations based on your roadmap and skill gaps.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className="input min-w-64" value={selectedRoadmapId || selectedRoadmap?.id || ""} onChange={(event) => setSelectedRoadmapId(event.target.value)}>
              {(roadmapsQuery.data ?? []).map((roadmap) => <option key={roadmap.id} value={roadmap.id}>{roadmap.title}</option>)}
            </select>
            <button type="button" className="btn-primary" disabled={!selectedRoadmap || generate.isPending} onClick={() => selectedRoadmap && generate.mutate(selectedRoadmap.id)}>
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-blue-600 dark:text-blue-300" />
          <h2 className="font-bold text-slate-950 dark:text-white">Search & Filters</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_220px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, reason, skills..." />
          </label>
          <select className="input" value={provider} onChange={(event) => setProvider(event.target.value as CourseProvider | "")}>
            {courseProviders.map((item) => <option key={item || "all"} value={item}>{item || "All providers"}</option>)}
          </select>
          <select className="input" value={level} onChange={(event) => setLevel(event.target.value as CourseLevel | "")}>
            {levels.map((item) => <option key={item || "all"} value={item}>{item || "All difficulties"}</option>)}
          </select>
          <button type="button" onClick={() => recommendationsQuery.refetch()} className="btn-secondary" disabled={recommendationsQuery.isFetching}>
            <RefreshCw className={cn("h-4 w-4", recommendationsQuery.isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </section>

      {courses.length === 0 ? (
        <EmptyState
          title={(recommendationsQuery.data ?? []).length === 0 ? "No course recommendations yet" : "No courses match your filters"}
          description={(recommendationsQuery.data ?? []).length === 0 ? "Choose a roadmap and generate recommendations to populate this page." : "Try changing search, provider, or difficulty filters."}
          icon={<GraduationCap className="h-8 w-8" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((item) => (
            <CourseCard
              key={`${item.recommendation.id}-${item.key}`}
              item={item}
              updating={updateState.isPending}
              onBookmark={(course) => updateState.mutate({
                recommendationId: course.recommendation.id,
                courseKey: course.key,
                bookmarked: !(course.recommendation.itemStates[course.key]?.bookmarked ?? false),
              })}
              onComplete={(course) => updateState.mutate({
                recommendationId: course.recommendation.id,
                courseKey: course.key,
                completed: true,
                progressPercentage: 100,
              })}
              onProgress={(course, progressPercentage) => updateState.mutate({
                recommendationId: course.recommendation.id,
                courseKey: course.key,
                progressPercentage,
                completed: progressPercentage === 100,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
