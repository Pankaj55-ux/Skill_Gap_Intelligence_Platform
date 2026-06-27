import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CheckCircle2,
  Clock,
  Expand,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Send,
  SkipForward,
  Square,
  Video,
  Volume2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/common/EmptyState";
import { CardSkeleton } from "../../components/ui/Skeleton";
import { routePaths } from "../../constants/routes";
import { queryTimes } from "../../lib/queryConfig";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../utils/cn";
import { interviewService } from "./interview.service";
import type { InterviewSession, InterviewSessionTurn } from "./interview.types";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const rest = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
};

const averageScore = (session: InterviewSession) => {
  const scores = session.turns.map((turn) => turn.evaluation?.score).filter((score): score is number => typeof score === "number");
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100;
};

const questionTargetFrom = (session: InterviewSession) => {
  const topic = session.expectedTopics.find((item) => item.startsWith("Question count target:"));
  const count = Number(topic?.replace("Question count target:", "").trim());
  return Number.isFinite(count) && count > 0 ? count : Math.max(session.turns.length, 1);
};

const currentTurnFrom = (session: InterviewSession): InterviewSessionTurn | null => (
  session.turns.find((turn) => !turn.answerText) ?? session.turns[session.turns.length - 1] ?? null
);

export function InterviewArenaPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [answer, setAnswer] = useState("");
  const [speechText, setSpeechText] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "recording" | "unsupported">("idle");
  const [cameraStatus, setCameraStatus] = useState<"off" | "starting" | "on" | "blocked">("off");
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);

  const sessionQuery = useQuery({
    queryKey: queryKeys.interview.session(sessionId),
    queryFn: () => interviewService.getSession(sessionId!),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => query.state.data?.status === "ACTIVE" ? 15_000 : false,
    staleTime: queryTimes.realtime,
  });

  const session = sessionQuery.data;
  const currentTurn = session ? currentTurnFrom(session) : null;
  const questionTarget = session ? questionTargetFrom(session) : 1;
  const answeredCount = session?.turns.filter((turn) => Boolean(turn.answerText)).length ?? 0;
  const score = session ? averageScore(session) : null;
  const progress = Math.min(100, Math.round((answeredCount / questionTarget) * 100));

  useEffect(() => {
    if (!session) return;
    setLocalRemaining(session.remainingSeconds);
  }, [session?.id, session?.remainingSeconds, session?.status]);

  useEffect(() => {
    if (!session || session.status !== "ACTIVE") return;
    const timer = window.setInterval(() => {
      setLocalRemaining((current) => {
        if (current === null) return current;
        return Math.max(0, current - 1);
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [session?.status, session?.id]);

  const updateSession = (next: InterviewSession) => {
    if (sessionId) {
      queryClient.setQueryData(queryKeys.interview.session(sessionId), next);
      queryClient.invalidateQueries({ queryKey: queryKeys.interview.sessions() });
    }
  };

  const submitAnswer = useMutation({
    mutationFn: (text: string) => interviewService.submitTextAnswer(sessionId!, text),
    onSuccess: (result) => {
      updateSession(result.session);
      setAnswer("");
      setSpeechText("");
      toast.success("Answer submitted");
    },
  });

  const pauseSession = useMutation({
    mutationFn: () => interviewService.pauseSession(sessionId!),
    onSuccess: (next) => {
      updateSession(next);
      toast.success("Interview paused");
    },
  });

  const resumeSession = useMutation({
    mutationFn: () => interviewService.resumeSession(sessionId!),
    onSuccess: (next) => {
      updateSession(next);
      toast.success("Interview resumed");
    },
  });

  const endSession = useMutation({
    mutationFn: () => interviewService.endSession(sessionId!),
    onSuccess: (result) => {
      updateSession(result.session);
      toast.success("Interview ended");
    },
  });

  const startCamera = useCallback(async () => {
    try {
      setCameraStatus("starting");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraStatus("on");
    } catch {
      setCameraStatus("blocked");
      toast.error("Camera or microphone permission was blocked");
    }
  }, []);

  const stopCamera = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraStatus("off");
  }, []);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("unsupported");
      toast.error("Web Speech API is not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => setVoiceStatus("listening");
    recognition.onend = () => setVoiceStatus("idle");
    recognition.onerror = () => setVoiceStatus("idle");
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setSpeechText(transcript);
      setAnswer(transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopSpeechRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceStatus("idle");
  }, []);

  const toggleRecording = useCallback(async () => {
    if (voiceStatus === "recording" || voiceStatus === "listening") {
      recorderRef.current?.stop();
      recorderRef.current = null;
      stopSpeechRecognition();
      setVoiceStatus("idle");
      return;
    }
    if (!mediaStreamRef.current) await startCamera();
    if (mediaStreamRef.current && typeof MediaRecorder !== "undefined") {
      recorderRef.current = new MediaRecorder(mediaStreamRef.current);
      recorderRef.current.start();
      setVoiceStatus("recording");
    }
    startSpeechRecognition();
  }, [startCamera, startSpeechRecognition, stopSpeechRecognition, voiceStatus]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  };

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        if (answer.trim()) submitAnswer.mutate(answer.trim());
      }
      if (event.key === "Escape") {
        event.preventDefault();
        stopSpeechRecognition();
      }
      if (event.key.toLowerCase() === "f" && event.altKey) {
        event.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [answer, stopSpeechRecognition, submitAnswer]);

  useEffect(() => () => {
    stopCamera();
    stopSpeechRecognition();
  }, [stopCamera, stopSpeechRecognition]);

  if (sessionQuery.isLoading) {
    return <div className="grid gap-4 xl:grid-cols-2"><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
  }

  if (sessionQuery.isError || !session || !currentTurn) {
    return (
      <EmptyState
        title="Interview session could not be loaded"
        description="Start a real interview session from the setup page, then return to the arena."
      />
    );
  }

  const isPaused = session.status === "PAUSED";
  const isEnded = session.status === "ENDED";
  const canSubmit = session.status === "ACTIVE" && answer.trim().length > 0 && !submitAnswer.isPending;

  return (
    <div className="min-h-[calc(100vh-7rem)] space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-blue-200">Live AI Interview Arena</p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{session.targetRole}</h1>
            <p className="mt-2 text-sm text-blue-100">Real backend session · {session.status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isPaused ? (
              <button type="button" className="btn bg-white text-slate-950 hover:bg-blue-50" onClick={() => resumeSession.mutate()} disabled={resumeSession.isPending}>
                <Play className="h-4 w-4" /> Resume
              </button>
            ) : (
              <button type="button" className="btn bg-white/10 text-white hover:bg-white/20" onClick={() => pauseSession.mutate()} disabled={isEnded || pauseSession.isPending}>
                <Pause className="h-4 w-4" /> Pause
              </button>
            )}
            <button type="button" className="btn bg-white/10 text-white hover:bg-white/20" onClick={toggleFullscreen}>
              <Expand className="h-4 w-4" /> Fullscreen
            </button>
            <button type="button" className="btn bg-red-500 text-white hover:bg-red-600" onClick={() => endSession.mutate()} disabled={isEnded || endSession.isPending}>
              <Square className="h-4 w-4" /> End Interview
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-300">Question {currentTurn.turnNumber} of {questionTarget}</p>
              <h2 className="mt-3 text-2xl font-extrabold leading-tight text-slate-950 dark:text-white">{currentTurn.question}</h2>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-950">
              <Clock className="mx-auto h-5 w-5 text-blue-600 dark:text-blue-300" />
              <p className="mt-2 text-2xl font-extrabold text-slate-950 dark:text-white">{formatTime(localRemaining ?? session.remainingSeconds)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Status label="Difficulty" value={currentTurn.expectedTopics[0] ?? "Backend generated"} />
            <Status label="Voice" value={voiceStatus} />
            <Status label="Camera" value={cameraStatus} />
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
            <p className="mb-2 text-sm font-bold text-slate-950 dark:text-white">Hints / Expected Topics</p>
            {currentTurn.expectedTopics.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No hints returned for this question.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentTurn.expectedTopics.map((topic) => (
                  <span key={topic} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-200">{topic}</span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-950 p-3">
            <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" aria-label="Camera preview" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={cameraStatus === "on" ? stopCamera : startCamera}>
                <Camera className="h-4 w-4" /> {cameraStatus === "on" ? "Stop Camera" : "Start Camera"}
              </button>
              <button type="button" className="btn-secondary" onClick={toggleRecording}>
                {voiceStatus === "recording" || voiceStatus === "listening" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {voiceStatus === "recording" || voiceStatus === "listening" ? "Stop Voice" : "Record Voice"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Your Answer</h2>
            <span className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold", voiceStatus === "idle" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200")}>
              <Volume2 className="h-3.5 w-3.5" /> {voiceStatus}
            </span>
          </div>

          <textarea
            className="input mt-4 min-h-56 resize-y"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={isPaused || isEnded}
            placeholder="Type your answer here, or use voice recording to fill this box with speech-to-text..."
            aria-label="Interview answer"
          />

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
            <p className="text-sm font-bold text-slate-950 dark:text-white">Speech-to-Text Output</p>
            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600 dark:text-slate-300">{speechText || "Speech transcript will appear here while listening."}</p>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-primary flex-1" disabled={!canSubmit} onClick={() => submitAnswer.mutate(answer.trim())}>
              {submitAnswer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Answer
            </button>
            <button type="button" className="btn-secondary flex-1" disabled={isPaused || isEnded || submitAnswer.isPending} onClick={() => submitAnswer.mutate("Skipped by candidate.")}>
              <SkipForward className="h-4 w-4" />
              Skip
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Shortcuts: Ctrl/⌘ + Enter submits, Esc stops voice, Alt + F toggles fullscreen.
          </p>
        </section>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Transcript</h2>
          <div className="mt-4 max-h-96 space-y-3 overflow-auto pr-1">
            {session.turns.map((turn) => (
              <div key={turn.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-sm font-bold text-blue-600 dark:text-blue-300">Q{turn.turnNumber}: {turn.question}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{turn.answerText || "Awaiting answer..."}</p>
                {turn.evaluation ? <p className="mt-2 text-xs font-bold text-emerald-600">Score: {turn.evaluation.score}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">Interview Progress</h2>
          <div className="mt-5 grid gap-3">
            <Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Answered" value={`${answeredCount}/${questionTarget}`} />
            <Metric icon={<Clock className="h-5 w-5" />} label="Current Score" value={score === null ? "Pending" : String(score)} />
            <Metric icon={<Video className="h-5 w-5" />} label="Session" value={session.status} />
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          {isEnded ? (
            <div className="mt-5 grid gap-2">
              <Link to={`${routePaths.interview}/sessions/${session.id}/results`} className="btn-primary w-full">
                View Results
              </Link>
              <Link to={routePaths.interview} className="btn-secondary w-full">
                Start Another Interview
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
      <span className="text-blue-600 dark:text-blue-300">{icon}</span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-extrabold text-slate-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
