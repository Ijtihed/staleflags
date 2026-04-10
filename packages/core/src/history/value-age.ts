import type { DiscoveredFlag } from '../types.js';
import { gitGrepLog, type GitLogEntry } from './git.js';

export interface ValueAgeResult {
  flagName: string;
  currentValue: string;
  valueUnchangedSince: Date | null;
  valueAgeInDays: number | null;
  lastChangedBy: string | null;
  lastChangedIn: string | null;
}

/**
 * Determine how long a flag's value has been at its current setting.
 *
 * For dead flags (same value everywhere), this answers: "when was the last
 * time this flag had a DIFFERENT value?" That's the moment it became stuck.
 */
export async function getValueAge(
  repoPath: string,
  flag: DiscoveredFlag,
  currentValue: string,
): Promise<ValueAgeResult> {
  const filePatterns = getFilePatterns(flag);
  // Use -G (grep) not -S (pickaxe): -S only finds commits where the string
  // count changes. When a value flips (ENABLE_X=false → ENABLE_X=true), the
  // string "ENABLE_X" count stays 1→1, so -S misses the commit. -G finds
  // any commit whose diff lines match the pattern.
  const entries = await gitGrepLog(repoPath, flag.name, filePatterns);

  // Entries are chronological (oldest first). We want the most recent commit
  // where the value was actually changed (not just reformatted), so walk
  // backwards to find where the value was SET to currentValue.
  const changeEntry = findLastValueChange(entries, flag.name, currentValue);

  if (!changeEntry) {
    return {
      flagName: flag.name,
      currentValue,
      valueUnchangedSince: null,
      valueAgeInDays: null,
      lastChangedBy: null,
      lastChangedIn: null,
    };
  }

  const now = new Date();
  const ageMs = now.getTime() - changeEntry.authorDate.getTime();
  const ageInDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  return {
    flagName: flag.name,
    currentValue,
    valueUnchangedSince: changeEntry.authorDate,
    valueAgeInDays: ageInDays,
    lastChangedBy: changeEntry.authorEmail,
    lastChangedIn: changeEntry.hash,
  };
}

/**
 * Walk commits (newest last thanks to --reverse, so we reverse-iterate) and
 * find the most recent commit where the flag's value was SET TO `currentValue`.
 *
 * We check diffs for:
 * - Added line (+) containing the flag with currentValue
 * - Removed line (-) containing the flag with a DIFFERENT value
 *
 * This catches both:
 * - Value flips: `-ENABLE_X=false` / `+ENABLE_X=true`
 * - Introduction: `+ENABLE_X=true` with no corresponding removal
 */
function findLastValueChange(
  entries: GitLogEntry[],
  flagName: string,
  currentValue: string,
): GitLogEntry | null {
  // Walk from newest to oldest
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const change = parseDiffForValueChange(entry.diff, flagName, currentValue);
    if (change === 'set-to-current') {
      return entry;
    }
  }

  // If no explicit value change found, the flag may have always had this
  // value. Fall back to the first commit that added the flag.
  for (const entry of entries) {
    if (diffContainsAddedFlag(entry.diff, flagName)) {
      return entry;
    }
  }

  return null;
}

type DiffChangeType = 'set-to-current' | 'removed' | 'formatting-only' | 'none';

/**
 * Parse a diff to determine if this commit changed the flag's value
 * to the current value.
 */
function parseDiffForValueChange(
  diff: string,
  flagName: string,
  currentValue: string,
): DiffChangeType {
  const lines = diff.split('\n');

  let hasAddedWithCurrent = false;
  let hasRemovedWithDifferent = false;
  let hasRemovedWithSame = false;

  for (const line of lines) {
    if (!line.includes(flagName)) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      const val = extractValue(line, flagName);
      if (val !== null && normalizeBool(val) === normalizeBool(currentValue)) {
        hasAddedWithCurrent = true;
      }
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      const val = extractValue(line, flagName);
      if (val !== null) {
        if (normalizeBool(val) === normalizeBool(currentValue)) {
          hasRemovedWithSame = true;
        } else {
          hasRemovedWithDifferent = true;
        }
      }
    }
  }

  // Value was flipped from something else to current
  if (hasAddedWithCurrent && hasRemovedWithDifferent) {
    return 'set-to-current';
  }

  // Value was introduced (added for the first time)
  if (hasAddedWithCurrent && !hasRemovedWithSame) {
    return 'set-to-current';
  }

  // Both added and removed with same value → formatting/whitespace change
  if (hasAddedWithCurrent && hasRemovedWithSame) {
    return 'formatting-only';
  }

  return 'none';
}

/**
 * Extract the value assigned to a flag from a diff line.
 *
 * Handles:
 * - `ENABLE_X=true`             → "true"
 * - `const ENABLE_X = true`     → "true"
 * - `"ENABLE_X": true`          → "true"  (JSON)
 * - `ENABLE_X: true`            → "true"  (YAML)
 */
function extractValue(line: string, flagName: string): string | null {
  const flagIdx = line.indexOf(flagName);
  if (flagIdx === -1) return null;

  const afterFlag = line.slice(flagIdx + flagName.length);

  // Env file format: ENABLE_X=value
  const envMatch = afterFlag.match(/^[=]\s*"?([^"\s#]*)"?/);
  if (envMatch) return envMatch[1];

  // Const format: = true/false
  const constMatch = afterFlag.match(/^\s*=\s*(true|false)\b/);
  if (constMatch) return constMatch[1];

  // JSON format: ": true" or ": false"
  const jsonMatch = afterFlag.match(/^["']?\s*:\s*(true|false)\b/);
  if (jsonMatch) return jsonMatch[1];

  // YAML format: ": true" (same as JSON essentially)
  // Already covered by jsonMatch

  return null;
}

function normalizeBool(value: string): string {
  const lower = value.toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(lower)) return 'true';
  if (['false', '0', 'no', 'off', ''].includes(lower)) return 'false';
  return lower;
}

function diffContainsAddedFlag(diff: string, flagName: string): boolean {
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
