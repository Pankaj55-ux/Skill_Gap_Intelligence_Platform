import { z } from "zod";
import { env } from "../../config/environment.js";
import { AppError } from "../../errors/app-error.js";
import { type LiveQuestion, liveQuestionSchema } from "./live-interview.schemas.js";

const DEFAULT_AI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_AI_MODEL}:generateContent`;

interface AIProviderResult {
  text: string;
  model: string;
}

interface QuestionProvider {
  generateJson(prompt: string): Promise<AIProviderResult>;
}

class GeminiQuestionProvider implements QuestionProvider {
  async generateJson(prompt: string): Promise<AIProviderResult> {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        "Live interview question generation requires GEMINI_API_KEY",
      );
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
        },
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!response.ok) {
      throw new AppError(502, "AI_PROVIDER_FAILED", "AI provider failed to generate the interview question");
    }

    const json = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AppError(502, "AI_PROVIDER_EMPTY_RESPONSE", "AI provider returned an empty response");

    return { text, model: DEFAULT_AI_MODEL };
  }
}

const parseJsonOnly = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new AppError(422, "AI_RESPONSE_NOT_JSON", "AI response was not valid JSON");
    return JSON.parse(match[0]);
  }
};

const createPrompt = (input: {
  targetRole: string;
  expectedTopics: string[];
  resumeContext: string | null;
  transcript: string;
  previousAnswer: string | null;
  questionCount: number;
  retry: boolean;
}): string => `
You are conducting a realistic live technical interview.
Return JSON only. Do not include markdown, comments, explanation, or extra keys.
Use exactly this schema:
{
  "question": "",
  "expectedTopics": [],
  "difficulty": "INTERMEDIATE"
}

Rules:
- Ask exactly one question.
- The next question should adapt to the previous answer when available.
- Avoid repeating earlier questions from the transcript.
- Keep questions concise but interview-realistic.
- expectedTopics must contain concepts a good answer should cover.
- difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED.
${input.retry ? "- Previous response failed validation. Return only valid JSON matching the schema." : ""}

Context:
{
  "targetRole": ${JSON.stringify(input.targetRole)},
  "expectedTopics": ${JSON.stringify(input.expectedTopics)},
  "resumeContext": ${JSON.stringify(input.resumeContext?.slice(0, 8_000) ?? null)},
  "transcript": ${JSON.stringify(input.transcript.slice(-8_000))},
  "previousAnswer": ${JSON.stringify(input.previousAnswer)},
  "questionCount": ${input.questionCount}
}
`;

type QuestionGenerationInput = Omit<Parameters<typeof createPrompt>[0], "retry">;

const difficultyFor = (expectedTopics: string[]): LiveQuestion["difficulty"] => {
  const configuredDifficulty = expectedTopics.find((topic) => topic.toLocaleLowerCase("en-US").startsWith("difficulty:"));
  if (/hard/i.test(configuredDifficulty ?? "")) return "ADVANCED";
  if (/easy/i.test(configuredDifficulty ?? "")) return "BEGINNER";
  return "INTERMEDIATE";
};

const usableTopics = (expectedTopics: string[]): string[] => expectedTopics.filter((topic) => (
  !/^(interview type|difficulty|question count target|job description):/i.test(topic)
));

export const generateDeterministicQuestion = (
  input: QuestionGenerationInput,
): LiveQuestion & { aiModel: string } => {
  const topics = usableTopics(input.expectedTopics);
  const primaryTopic = topics[input.questionCount % Math.max(1, topics.length)] ?? "technical fundamentals";
  const previousAnswerFollowUp = input.previousAnswer?.trim()
    ? `You mentioned "${input.previousAnswer.trim().slice(0, 80)}${input.previousAnswer.trim().length > 80 ? "…" : ""}". What trade-off or limitation would you consider in that approach?`
    : null;
  const resumeProjectQuestion = input.resumeContext && /projects?/i.test(input.resumeContext)
    ? `Choose one project from your resume and explain the architecture, your contribution, and one difficult trade-off you made.`
    : null;

  const candidates: Array<{ question: string; expectedTopics: string[] }> = [
    {
      question: `Tell me about yourself and explain why your experience is relevant to a ${input.targetRole} role.`,
      expectedTopics: ["relevant experience", "role motivation", "clear communication"],
    },
    {
      question: resumeProjectQuestion
        ?? `Describe a project that best demonstrates your readiness for a ${input.targetRole} role.`,
      expectedTopics: ["project context", "personal contribution", "technical decisions", "outcome"],
    },
    {
      question: `Explain ${primaryTopic} as you would in a technical interview, including a practical example and a key trade-off.`,
      expectedTopics: [primaryTopic, "practical application", "trade-offs"],
    },
    {
      question: `A production system for a ${input.targetRole} is failing intermittently. How would you investigate and resolve the issue?`,
      expectedTopics: ["problem solving", "debugging", "observability", "root-cause analysis"],
    },
    {
      question: `Describe a time you received difficult feedback or disagreed with a teammate. How did you handle it?`,
      expectedTopics: ["communication", "collaboration", "reflection", "outcome"],
    },
  ];

  if (previousAnswerFollowUp) {
    candidates.splice(0, 0, {
      question: previousAnswerFollowUp,
      expectedTopics: ["trade-offs", "limitations", "reasoning"],
    });
  }

  const unused = candidates.find((candidate) => !input.transcript.toLocaleLowerCase("en-US").includes(
    candidate.question.toLocaleLowerCase("en-US").slice(0, 60),
  ));
  const selected = unused ?? candidates[input.questionCount % candidates.length];

  return {
    ...selected,
    difficulty: difficultyFor(input.expectedTopics),
    aiModel: "deterministic-interview-v1",
  };
};

export class QuestionGeneratorService {
  constructor(private readonly provider: QuestionProvider = new GeminiQuestionProvider()) {}

  async generateNextQuestion(input: {
    targetRole: string;
    expectedTopics: string[];
    resumeContext: string | null;
    transcript: string;
    previousAnswer: string | null;
    questionCount: number;
  }): Promise<LiveQuestion & { aiModel: string }> {
    try {
      const firstAttempt = await this.tryGenerate({ ...input, retry: false });
      const result = firstAttempt.success
        ? firstAttempt
        : await this.tryGenerate({ ...input, retry: true });

      if (result.success) {
        return { ...result.data, aiModel: result.model };
      }

      return generateDeterministicQuestion(input);
    } catch (error) {
      if (error instanceof AppError && error.statusCode < 500) throw error;
      return generateDeterministicQuestion(input);
    }
  }

  private async tryGenerate(input: Parameters<typeof createPrompt>[0]): Promise<
    | { success: true; data: LiveQuestion; model: string }
    | { success: false; details: unknown }
  > {
    try {
      const response = await this.provider.generateJson(createPrompt(input));
      const parsed = parseJsonOnly(response.text);
      const validated = liveQuestionSchema.parse(parsed);
      return {
        success: true,
        data: validated,
        model: response.model,
      };
    } catch (error) {
      if (error instanceof AppError && error.statusCode >= 500) throw error;
      if (error instanceof z.ZodError) return { success: false, details: error.flatten() };
      return { success: false, details: null };
    }
  }
}

export const questionGeneratorService = new QuestionGeneratorService();
