import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DeadBranch, FlagReport, FlagLocation } from '../types.js';
import { findDeadBranches } from './branch-finder.js';
import { measureDeadCode } from './branch-measurer.js';

/**
 * Run dead code analysis for a single dead flag.
 *
 * Reads each source file where the flag is used, parses it,
 * finds dead branches, and attaches them to the report.
 */
export function analyzeDeadCodeForFlag(
  repoPath: string,
  report: FlagReport,
): void {
  if (report.classification.status !== 'dead') return;

  const flagAlwaysTrue = report.classification.value === true;
  const flagName = report.name;

  // Only analyze JS/TS source files (not config files)
  const sourceLocations = report.locations.filter(
    (loc) => loc.language === 'typescript' || loc.language === 'javascript',
  );

  // Deduplicate by file — a flag may be referenced multiple times in one file
  const fileSet = new Set(sourceLocations.map((loc) => loc.file));

  const allBranches: DeadBranch[] = [];

  for (const relFile of fileSet) {
    const absPath = path.join(repoPath, relFile);
    let content: string;
    try {
      content = fs.readFileSync(absPath, 'utf-8');
    } catch {
      continue;
    }

    try {
      const branches = findDeadBranches(relFile, content, flagName, flagAlwaysTrue);
      allBranches.push(...branches);
    } catch {
      // Parse error or unexpected AST — skip this file
    }
  }

  report.deadBranches = allBranches;
  report.totalDeadLines = allBranches.reduce((sum, b) => sum + b.lineCount, 0);
}

/**
 * Run dead code analysis for all dead flags in a scan result.
 * Returns global totals after deduplication across all flags.
 */
export function analyzeAllDeadCode(
  repoPath: string,
  reports: FlagReport[],
): { totalDeadLines: number; totalDeadFiles: number } {
  const deadReports = reports.filter((r) => r.classification.status === 'dead');

  for (const report of deadReports) {
    analyzeDeadCodeForFlag(repoPath, report);
  }

  const allBranches = deadReports.flatMap((r) => r.deadBranches);
  return measureDeadCode(allBranches);
}
