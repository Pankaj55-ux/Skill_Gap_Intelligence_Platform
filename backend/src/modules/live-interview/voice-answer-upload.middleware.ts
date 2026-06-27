import type { RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../../errors/app-error.js";

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;
const allowedAudioMimeTypes = new Set([
  "audio/webm",
  "audio/wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
]);

export const validateAudioSignature = (file: {
  buffer: Buffer;
  mimetype: string;
}): void => {
  const { buffer, mimetype } = file;
  const isWebm = mimetype === "audio/webm"
    && buffer[0] === 0x1a
    && buffer[1] === 0x45
    && buffer[2] === 0xdf
    && buffer[3] === 0xa3;
  const isWav = mimetype === "audio/wav"
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WAVE";
  const isMp3 = mimetype === "audio/mpeg"
    && (buffer.subarray(0, 3).toString("ascii") === "ID3"
      || (buffer[0] === 0xff && [0xe2, 0xe3, 0xea, 0xeb, 0xf2, 0xf3, 0xfa, 0xfb].includes(buffer[1] ?? 0)));
  const isMp4 = mimetype === "audio/mp4" && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  const isOgg = mimetype === "audio/ogg" && buffer.subarray(0, 4).toString("ascii") === "OggS";

  if (!isWebm && !isWav && !isMp3 && !isMp4 && !isOgg) {
    throw new AppError(
      400,
      "INVALID_INTERVIEW_AUDIO_SIGNATURE",
      "Voice answer content does not match the declared audio type",
    );
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_SIZE_BYTES,
    files: 1,
    fields: 10,
    fieldSize: 64 * 1024,
    parts: 11,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedAudioMimeTypes.has(file.mimetype)) {
      callback(new AppError(
        400,
        "UNSUPPORTED_INTERVIEW_AUDIO_TYPE",
        "Only WEBM, WAV, MP3, MP4 audio, and OGG voice answers are supported",
        { allowedMimeTypes: Array.from(allowedAudioMimeTypes) },
      ));
      return;
    }

    callback(null, true);
  },
});

const multerSingleAnswerAudio = upload.single("audio");

export const voiceAnswerUploadMiddleware: RequestHandler = (req, res, next) => {
  multerSingleAnswerAudio(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        next(new AppError(
          413,
          "INTERVIEW_AUDIO_TOO_LARGE",
          "Voice answer audio must not exceed 25 MB",
          { maxBytes: MAX_AUDIO_SIZE_BYTES },
        ));
        return;
      }

      next(new AppError(400, "INTERVIEW_AUDIO_UPLOAD_ERROR", "Voice answer upload failed", { code: error.code }));
      return;
    }

    next(error);
  });
};
