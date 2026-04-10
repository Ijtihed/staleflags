import type { DiscoveredFlag } from '../types.js';
import { gitPickaxeLog, type GitLogEntry } from './git.js';

export interface FlagAgeResult {
  flagName: string;
  introducedAt: Date | null;
  introducedBy: string | null;
  introducedIn: string | null;
  ageInDays: number | null;
}

/**
 * Determine when a flag was first introduced by searching git history.
 *
 * Uses `git log -S` (pickaxe) to find the earliest commit that added
 * the flag string. Checks across env files, source files, and config files
 * depending on the flag's source type.
 */
export async function getFlagAge(
  repoPath: string,
  flag: DiscoveredFlag,
): Promise<FlagAgeResult> {
  const filePatterns = getFilePatterns(flag);
  const entries = await gitPickaxeLog(repoPath, flag.name, filePatterns);

  // Entries are in chronological order (--reverse). Find the first commit
  // where the flag was actually ADDED (line starts with +).
  const introEntry = findIntroductionCommit(entries, flag.name);

  if (!introEntry) {
    return {
      flagName: flag.name,
      introducedAt: null,
      introducedBy: null,
      introducedIn: null,
      ageInDays: null,
    };
  }

  const now = new Date();
  const ageMs = now.getTime() - introEntry.authorDate.getTime();
  const ageInDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  return {
    flagName: flag.name,
    introducedAt: introEntry.authorDate,
    introducedBy: introEntry.authorEmail,
    introducedIn: introEntry.hash,
    ageInDays,
  };
}

/**
 * Scan the chronological list of commits for the first one that actually
 * adds (not removes) the flag name in a diff.
 */
function findIntroductionCommit(
  entries: GitLogEntry[],
  flagName: string,
): GitLogEntry | null {
  for (const entry of entries) {
    if (diffAddsFlag(entry.diff, flagName)) {
      return entry;
    }
  }
  // If we can't confirm an addition, fall back to the earliest pickaxe hit
  return entries.length > 0 ? entries[0] : null;
}

/**
 * Check whether a diff contains an added line (starting with +) that
 * includes the flag name. Ignores diff headers (+++).
 */
function diffAddsFlag(diff: string, flagName: string): boolean {
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++') && line.includes(flagName)) {
      return true;
    }
  }
  return false;
}

function getFilePatterns(flag: DiscoveredFlag): string[] {
  switch (flag.source) {
    case 'env':
      return ['.env*', '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rb'];
    case 'const':
      return ['*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'];
    case 'config':
      return ['*.json', '*.yaml', '*.yml'];
    default:
      return ['.env*', '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rb', '*.json', '*.yaml', '*.yml'];
  }
}
