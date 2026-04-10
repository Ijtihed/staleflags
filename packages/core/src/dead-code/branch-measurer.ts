import type { DeadBranch } from '../types.js';

/**
 * Deduplicate overlapping dead branches and compute aggregated line counts.
 *
 * If the same lines are flagged by two different dead flags (nested conditionals),
 * they're counted only once. Returns:
 *   - deduplicated branches (unchanged — dedup only affects totals)
 *   - total unique dead lines
 *   - total unique dead files
 */
export function measureDeadCode(branches: DeadBranch[]): {
  totalDeadLines: number;
  totalDeadFiles: number;
} {
  // Track every unique file:line pair to avoid double-counting overlaps
  const deadLines = new Set<string>();

  for (const branch of branches) {
    for (let line = branch.startLine; line <= branch.endLine; line++) {
      deadLines.add(`${branch.file}:${line}`);
    }
  }

  const deadFiles = new Set<string>();
  for (const key of deadLines) {
    deadFiles.add(key.split(':')[0]);
  }

  return {
    totalDeadLines: deadLines.size,
    totalDeadFiles: deadFiles.size,
  };
}

/**
 * Generate a short code preview for a dead branch (first 3 lines).
 */
export function branchPreview(
  fileContent: string,
  branch: DeadBranch,
  maxLines: number = 3,
): string[] {
  const lines = fileContent.split('\n');
  const preview: string[] = [];

  const start = branch.startLine - 1; // 0-indexed
  const end = Math.min(start + maxLines, branch.endLine);
  const remaining = branch.endLine - branch.startLine + 1 - maxLines;

  for (let i = start; i < end; i++) {
    if (i < lines.length) {
      preview.push(`${String(i + 1).padStart(4)}  ${lines[i]}`);
    }
  }

  if (remaining > 0) {
    preview.push(`  ..  (${remaining} more lines)`);
  }

  return preview;
}
