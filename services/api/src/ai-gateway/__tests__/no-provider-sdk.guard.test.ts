import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';

const API_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const SCAN_DIRS = ['src', 'scripts', 'test'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'generated']);

/** The one file allowed to import the Bedrock runtime SDK (see llm.module.ts). */
const BEDROCK_SDK_ALLOWED_FILE = join('src', 'ai-gateway', 'llm', 'bedrock-llm.client.ts');
/** This file itself — it necessarily contains the literal strings it checks for. */
const SELF = join('src', 'ai-gateway', '__tests__', 'no-provider-sdk.guard.test.ts');

function listTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...listTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const files = SCAN_DIRS.flatMap((dir) => listTsFiles(join(API_ROOT, dir))).filter(
  (file) => relative(API_ROOT, file) !== SELF,
);

/**
 * Keeps Phase 1 of docs/UNIFIED_AI_CHAT_PLAN.md ("single Bedrock entry
 * point") from regressing: every model call must go through
 * `BedrockLlmClient` — nothing else may import a provider SDK or talk to
 * OpenAI directly.
 */
describe('no direct provider SDK or OpenAI calls outside BedrockLlmClient', () => {
  it('only bedrock-llm.client.ts imports @aws-sdk/client-bedrock-runtime', () => {
    const offenders = files.filter((file) => {
      const relPath = relative(API_ROOT, file);
      if (relPath === BEDROCK_SDK_ALLOWED_FILE) return false;
      return readFileSync(file, 'utf8').includes('@aws-sdk/client-bedrock-runtime');
    });
    expect(offenders.map((f) => relative(API_ROOT, f))).toEqual([]);
  });

  it('no file imports the openai package', () => {
    const offenders = files.filter((file) => {
      const content = readFileSync(file, 'utf8');
      return /from ['"]openai(\/|['"])/.test(content) || /require\(['"]openai/.test(content);
    });
    expect(offenders.map((f) => relative(API_ROOT, f))).toEqual([]);
  });

  it('no file talks to api.openai.com', () => {
    const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('api.openai.com'));
    expect(offenders.map((f) => relative(API_ROOT, f))).toEqual([]);
  });
});
