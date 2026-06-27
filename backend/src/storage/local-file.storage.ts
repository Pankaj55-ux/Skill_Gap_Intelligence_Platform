import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/environment.js";
import type { FileStorage, StoredFile } from "./storage.service.js";

const RESUME_FOLDER = "resumes";

const assertInsideDirectory = (rootDirectory: string, absolutePath: string): void => {
  const relativePath = path.relative(rootDirectory, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Refusing to access a file outside the configured upload directory");
  }
};

export class LocalFileStorage implements FileStorage {
  private readonly rootDirectory: string;

  constructor(rootDirectory = env.UPLOADS_DIR) {
    this.rootDirectory = path.resolve(process.cwd(), rootDirectory);
  }

  async save(input: {
    buffer: Buffer;
    originalFileName: string;
    mimeType: string;
    extension: string;
  }): Promise<StoredFile> {
    const storedFileName = `${randomUUID()}${input.extension}`;
    const directory = path.join(this.rootDirectory, RESUME_FOLDER);
    const absolutePath = path.join(directory, storedFileName);
    assertInsideDirectory(this.rootDirectory, absolutePath);

    await mkdir(directory, { recursive: true });
    await writeFile(absolutePath, input.buffer, { flag: "wx" });

    const storageKey = path.posix.join(RESUME_FOLDER, storedFileName);
    return {
      storedFileName,
      storageKey,
      fileUrl: `/uploads/${storageKey}`,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = path.resolve(this.rootDirectory, storageKey);
    assertInsideDirectory(this.rootDirectory, absolutePath);

    await rm(absolutePath, { force: true });
  }
}

export const localFileStorage = new LocalFileStorage();
