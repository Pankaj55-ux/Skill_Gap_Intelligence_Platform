import { Prisma } from "../../generated/prisma/client.js";

type TranscriptTurn = {
  turnNumber: number;
  question: string;
  answerText: string | null;
  answerMode: string | null;
  evaluation?: {
    score: Prisma.Decimal | number;
    summary: string;
  } | null;
};

export class TranscriptService {
  buildTranscript(turns: TranscriptTurn[]): string {
    return turns
      .sort((a, b) => a.turnNumber - b.turnNumber)
      .map((turn) => [
        `Question ${turn.turnNumber}: ${turn.question}`,
        turn.answerText ? `Student (${turn.answerMode ?? "TEXT"}): ${turn.answerText}` : "Student: [not answered yet]",
        turn.evaluation ? `Evaluation: ${Number(turn.evaluation.score)}/100 - ${turn.evaluation.summary}` : null,
      ].filter(Boolean).join("\n"))
      .join("\n\n");
  }
}

export const transcriptService = new TranscriptService();
