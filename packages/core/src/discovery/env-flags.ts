import * as fs from 'node:fs';
import * as path from 'node:path';
import fg from 'fast-glob';
import type { DiscoveredFlag, FlagLocation, Language, StaleflagsConfig } from '../types.js';
import { buildEnvReadPatterns, buildCustomPatterns, type FlagPattern } from './patterns.js';

/**
 * Scan source files for environment-variable-based feature flag reads.
 * Returns one DiscoveredFlag per unique flag name, with all locations merged.
 */
export async function discoverEnvFlags(
  repoPath: string,
  config: StaleflagsConfig,
): Promise<Map<string, DiscoveredFlag>> {
  const patterns = [
    ...buildEnvReadPatterns(config.envPrefixes),
    ...buildCustomPatterns(config.customPatterns),
  ];

  const flags = new Map<string, DiscoveredFlag>();

  for (const pattern of patterns) {
    const files = await findFiles(repoPath, pattern.fileGlobs, config.exclude);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(repoPath, file);
      const lang = detectLanguage(file);
      scanFileForPattern(content, relPath, lang, pattern, flags);
    }
  }

  return flags;
}

function scanFileForPattern(
  content: string,
  relPath: string,
  lang: Language | 'config',
  pattern: FlagPattern,
  flags: Map<string, DiscoveredFlag>,
): void {
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      const flagName = match.groups?.flagName ?? match[1];
      if (!flagName) continue;

      const location: FlagLocation = {
        file: relPath,
        line: i + 1,
        column: match.index + 1,
        snippet: line.trim(),
        language: lang,
        kind: pattern.kind,
      };

      const existing = flags.get(flagName);
      if (existing) {
        const isDuplicate = existing.locations.some(
          (loc) => loc.file === relPath && loc.line === location.line,
        );
        if (!isDuplicate) {
          existing.locations.push(location);
        }
      } else {
        flags.set(flagName, {
          name: flagName,
          source: 'env',
          locations: [location],
        });
      }
    }
  }
}

async function findFiles(
  repoPath: string,
  globs: string[],
  exclude: string[],
): Promise<string[]> {
  return fg(globs, {
    cwd: repoPath,
    absolute: true,
    ignore: exclude.map((e) => `**/${e}/**`),
    dot: false,
  });
}

function detectLanguage(filePath: string): Language | 'config' {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
    case '.mts':
    case '.cts':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.py':
      return 'python';
    case '.go':
      return 'go';
    case '.rb':
      return 'ruby';
    default:
      return 'config';
  }
}

export { findFiles, detectLanguage };
