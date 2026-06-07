import * as fs from 'fs';
import * as path from 'path';

export async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readJsonFile<T = Record<string, unknown>>(
  filePath: string
): Promise<T | null> {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function listDir(dirPath: string): Promise<fs.Dirent[]> {
  try {
    return await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

export async function fileExistsIn(dir: string, filename: string): Promise<boolean> {
  return pathExists(path.join(dir, filename));
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function now(): string {
  return new Date().toISOString();
}
