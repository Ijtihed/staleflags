import type { Language } from '../types.js';

export interface FlagPattern {
  language: Language | Language[];
  /** Glob patterns for files this pattern applies to */
  fileGlobs: string[];
  /** Regex with a named capture group `flagName` for the flag identifier */
  regex: RegExp;
  kind: 'env-read' | 'const-assignment';
}

/**
 * Build env-read patterns for the given prefixes.
 * Each regex uses a named group `flagName` to extract the flag identifier.
 */
export function buildEnvReadPatterns(prefixes: string[]): FlagPattern[] {
  const prefixAlt = prefixes.map(escapeRegex).join('|');

  return [
    {
      language: ['javascript', 'typescript'],
      fileGlobs: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
      regex: new RegExp(
        `process\\.env\\.(?<flagName>(?:${prefixAlt})\\w+)`,
        'g',
      ),
      kind: 'env-read',
    },
    {
      language: ['javascript', 'typescript'],
      fileGlobs: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
      regex: new RegExp(
        `import\\.meta\\.env\\.(?<flagName>(?:${prefixAlt})\\w+)`,
        'g',
      ),
      kind: 'env-read',
    },
    {
      language: 'python',
      fileGlobs: ['**/*.py'],
      regex: new RegExp(
        `os\\.environ(?:\\.get)?\\(\\s*['"](?<flagName>(?:${prefixAlt})\\w+)['"]`,
        'g',
      ),
      kind: 'env-read',
    },
    {
      language: 'go',
      fileGlobs: ['**/*.go'],
      regex: new RegExp(
        `os\\.Getenv\\(\\s*['"](?<flagName>(?:${prefixAlt})\\w+)['"]`,
        'g',
      ),
      kind: 'env-read',
    },
    {
      language: 'ruby',
      fileGlobs: ['**/*.rb'],
      regex: new RegExp(
        `ENV\\[\\s*['"](?<flagName>(?:${prefixAlt})\\w+)['"]\\s*\\]`,
        'g',
      ),
      kind: 'env-read',
    },
  ];
}

/**
 * Build const-assignment patterns for JS/TS hardcoded boolean constants.
 */
export function buildConstPatterns(prefixes: string[]): FlagPattern[] {
  const prefixAlt = prefixes.map(escapeRegex).join('|');

  return [
    {
      language: ['javascript', 'typescript'],
      fileGlobs: ['**/*.{js,jsx,ts,tsx,mjs,cjs}'],
      regex: new RegExp(
        `(?:const|let|var)\\s+(?<flagName>(?:${prefixAlt})\\w+)\\s*=\\s*(?<value>true|false)`,
        'g',
      ),
      kind: 'const-assignment',
    },
  ];
}

/**
 * Build custom user-supplied patterns.
 * Each pattern should have at least one capture group for the flag name.
 */
export function buildCustomPatterns(patterns: string[]): FlagPattern[] {
  return patterns.map((p) => ({
    language: ['javascript', 'typescript', 'python', 'go', 'ruby'] as Language[],
    fileGlobs: ['**/*.{js,jsx,ts,tsx,mjs,cjs,py,go,rb}'],
    regex: new RegExp(p, 'g'),
    kind: 'env-read' as const,
  }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
