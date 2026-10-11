import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./env";

/** Resolves a path relative to DATA_DIR and refuses anything that escapes it. */
export function dataPath(relative: string): string {
  const root = config.dataDir;
  const full = path.resolve(root, relative);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return full;
}

export async function writeBlob(relative: string, data: Buffer | Uint8Array, mode = 0o600): Promise<string> {
  const full = dataPath(relative);
  await fs.mkdir(path.dirname(full), { recursive: true, mode: 0o700 });
  const tmp = `${full}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, data, { mode });
  await fs.rename(tmp, full); // atomic replace: a half-written file is never served
  return relative;
}

export async function readBlob(relative: string): Promise<Buffer> {
  return fs.readFile(dataPath(relative));
}

export async function blobExists(relative: string): Promise<boolean> {
  try {
    await fs.access(dataPath(relative));
    return true;
  } catch {
    return false;
  }
}

export async function removeBlob(relative: string): Promise<void> {
  await fs.rm(dataPath(relative), { force: true });
}

/** A private scratch directory for signing. Caller must call removeDir in a finally block. */
export async function createPrivateTempDir(): Promise<string> {
  const dir = dataPath(`tmp/${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export async function removeDir(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}
