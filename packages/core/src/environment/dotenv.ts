import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import type { EnvironmentMap, StaleflagsConfig } from '../types.js';

/**
 * Parse all .env* files in the repo and build a map of
 * flagName → { envFileName: value }.
 *
 * Template files (.env.example, .env.sample, .env.template, etc.) are
 * excluded from the main map — they're templates, not real environments.
 * Only includes keys that match the configured flag prefixes.
 */
export async function parseEnvFiles(
  repoPath: string,
  config: StaleflagsConfig,
): Promise<EnvironmentMap> {
  const envMap: EnvironmentMap = new Map();

  const files = await fg(config.envFiles, {
    cwd: repoPath,
    absolute: true,
    dot: true,
  });

  for (const file of files) {
    const envName = path.basename(file);
    if (isTemplateFile(envName)) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const parsed = parseDotenv(content);

    for (const [key, value] of Object.entries(parsed)) {
      if (!matchesAnyPrefix(key, config.envPrefixes)) continue;

      let flagEnvs = envMap.get(key);
      if (!flagEnvs) {
        flagEnvs = new Map();
        envMap.set(key, flagEnvs);
      }
      flagEnvs.set(envName, value);
    }
  }

  return envMap;
}

/**
 * Minimal .env parser. Handles:
 * - KEY=value
 * - KEY="value" and KEY='value'
 * - KEY="value" # comment (quoted value with inline comment)
 * - # comments
 * - empty lines
 * - empty values (KEY= or KEY="")
 * - export KEY=value
 */
export function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    // Strip optional `export ` prefix
    const stripped = line.startsWith('export ') ? line.slice(7) : line;

    const eqIndex = stripped.indexOf('=');
    if (eqIndex === -1) continue;

    const key = stripped.slice(0, eqIndex).trim();
    const raw = stripped.slice(eqIndex + 1).trim();

    result[key] = parseValue(raw);
  }

  return result;
}

function parseValue(raw: string): string {
  if (raw.startsWith('"')) {
    const closingQuote = raw.indexOf('"', 1);
    if (closingQuote !== -1) return raw.substring(1, closingQuote);
    return raw.substring(1);
  }

  if (raw.startsWith("'")) {
    const closingQuote = raw.indexOf("'", 1);
    if (closingQuote !== -1) return raw.substring(1, closingQuote);
    return raw.substring(1);
  }

  // Unquoted: strip inline comment (space + #)
  const commentIdx = raw.indexOf(' #');
  if (commentIdx !== -1) return raw.substring(0, commentIdx).trim();

  return raw;
}

const TEMPLATE_SUFFIXES = ['example', 'sample', 'template'];

/**
 * Template env files are documentation, not deployed environments.
 * e.g. .env.example, .env.sample, .env.dev.example, .env.template
 */
export function isTemplateFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return TEMPLATE_SUFFIXES.some((s) => lower.endsWith(`.${s}`) || lower === `.env.${s}`);
}

function matchesAnyPrefix(key: string, prefixes: string[]): boolean {
  return prefixes.some((p) => key.startsWith(p));
}
