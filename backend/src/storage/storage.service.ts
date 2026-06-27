export interface StoredFile {
  storedFileName: string;
  fileUrl: string;
  storageKey: string;
}

export interface FileStorage {
  save(input: {
    buffer: Buffer;
    originalFileName: string;
    mimeType: string;
    extension: string;
  }): Promise<StoredFile>;
  delete(storageKey: string): Promise<void>;
}
