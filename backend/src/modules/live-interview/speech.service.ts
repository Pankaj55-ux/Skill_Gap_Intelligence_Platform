import type { Express } from "express";
import { AppError } from "../../errors/app-error.js";

export interface SpeechSynthesisResult {
  text: string;
  audioUrl: string | null;
  provider: string;
  status: "TEXT_ONLY" | "GENERATED";
  mimeType: string | null;
}

export interface SpeechTranscriptionResult {
  text: string;
  provider: string;
  confidence: number | null;
  durationMs: number | null;
}

export class SpeechService {
  async synthesizeQuestion(text: string): Promise<SpeechSynthesisResult> {
    return {
      text,
      audioUrl: null,
      provider: "text-only-development-provider",
      status: "TEXT_ONLY",
      mimeType: null,
    };
  }

  async transcribeAnswer(_file: Express.Multer.File): Promise<SpeechTranscriptionResult> {
    throw new AppError(
      503,
      "SPEECH_TO_TEXT_PROVIDER_NOT_CONFIGURED",
      "Voice answers are wired through SpeechService, but no speech-to-text provider is configured yet",
    );
  }
}

export const speechService = new SpeechService();
