import * as path from 'path';
import * as fs from 'fs/promises';
import { pathExists } from '../utils/fs';

export interface ExtractedEnvVar {
  key: string;
  value: string;
  sourceFile: string;
}

const SUPPORTED_DOC_FILES = ['README.md', 'CONTRIBUTING.md'];

// Regex to capture key-value pairs like KEY=VALUE or KEY=
const ENV_VAR_REGEX = /^\s*([A-Z0-9_]{2,})\s*=\s*(.*)$/;

function parseEnvLines(text: string, fileName: string): ExtractedEnvVar[] {
  const vars: ExtractedEnvVar[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(ENV_VAR_REGEX);
    if (match) {
      const [, key, value] = match;
      vars.push({
        key: key.trim(),
        value: value.trim(),
        sourceFile: fileName,
      });
    }
  }

  return vars;
}

/**
  * Parses fenced code blocks and plain text lines in Markdown files
  * to extract environment variable definitions.
  */
export async function extractEnvVarsFromDocs(rootPath: string): Promise<ExtractedEnvVar[]> {
  const extractedVars: ExtractedEnvVar[] = [];
  const seenKeys = new Set<string>();

  for (const docFile of SUPPORTED_DOC_FILES) {
    const filePath = path.join(rootPath, docFile);
    if (!(await pathExists(filePath))) continue;

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // 1. Extract from fenced code blocks (```env, ```bash, ```sh, or generic ```)
      const codeBlockRegex = /```(?:env|bash|sh|shell)?\r?\n([\s\S]*?)```/gi;
      let match: RegExpExecArray | null;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        const blockContent = match[1];
        const vars = parseEnvLines(blockContent, docFile);
        for (const v of vars) {
          if (!seenKeys.has(v.key)) {
            seenKeys.add(v.key);
            extractedVars.push(v);
          }
        }
      }

      // 2. Fallback: Parse non-fenced environment variable declarations
      const fallbackVars = parseEnvLines(content, docFile);
      for (const v of fallbackVars) {
        if (!seenKeys.has(v.key)) {
          seenKeys.add(v.key);
          extractedVars.push(v);
        }
      }
    } catch {
      // Gracefully handle file read errors without throwing
    }
  }

  return extractedVars;
}
