import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeFlags, branchPreview } from '@staleflags/core';

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';

export interface ExplainOptions {
  path: string;
  flagName: string;
}

/**
 * Deep-dive a single flag: show everything we know about it.
 */
export async function runExplain(options: ExplainOptions): Promise<number> {
  const result = await analyzeFlags(options.path);
  const flag = result.flags.find(
    (f) => f.name.toLowerCase() === options.flagName.toLowerCase(),
  );

  if (!flag) {
    process.stderr.write(
      `\n  Flag "${options.flagName}" not found.\n\n` +
      `  Known flags: ${result.flags.map((f) => f.name).join(', ') || '(none)'}\n\n`,
    );
    return 1;
  }

  const lines: string[] = [];
  lines.push('');
  lines.push(`  ${BOLD}${flag.name}${RESET}`);
  lines.push('');

  // Status
  const statusColors: Record<string, string> = {
    dead: RED,
    active: GREEN,
    phantom: CYAN,
    aging: '\x1b[33m',
    orphan: DIM,
  };
  const color = statusColors[flag.classification.status] ?? '';
  lines.push(`  Status: ${color}${BOLD}${flag.classification.status.toUpperCase()}${RESET}`);
  lines.push('');

  // Environments
  const envEntries = Object.entries(flag.classification.environments);
  if (envEntries.length > 0) {
    lines.push(`  ${BOLD}Environments:${RESET}`);
    for (const [env, val] of envEntries) {
      lines.push(`    ${env}: ${BOLD}${val}${RESET}`);
    }
    lines.push('');
  }

  // Note
  if (flag.classification.note) {
    lines.push(`  ${DIM}${flag.classification.note}${RESET}`);
    lines.push('');
  }

  // Age info
  if (flag.age) {
    lines.push(`  ${BOLD}History:${RESET}`);
    if (flag.age.introducedDate) {
      const dateStr = flag.age.introducedDate.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const byStr = flag.age.introducedBy ? ` by ${flag.age.introducedBy}` : '';
      const commitStr = flag.age.introducedIn ? ` (commit ${flag.age.introducedIn.slice(0, 7)})` : '';
      lines.push(
        `    Introduced: ${dateStr}${byStr}${commitStr}`,
      );
      if (flag.age.introducedAgo) {
        lines.push(`    ${DIM}${flag.age.introducedAgo}${RESET}`);
      }
    }
    if (flag.age.valueUnchangedSince) {
      const dateStr = flag.age.valueUnchangedSince.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const byStr = flag.age.valueChangedBy ? ` by ${flag.age.valueChangedBy}` : '';
      const commitStr = flag.age.valueChangedIn ? ` (commit ${flag.age.valueChangedIn.slice(0, 7)})` : '';
      lines.push(
        `    Value unchanged since: ${dateStr}${byStr}${commitStr}`,
      );
      if (flag.age.valueUnchangedAgo) {
        lines.push(`    ${DIM}${flag.age.valueUnchangedAgo}${RESET}`);
      }
    }
    lines.push('');
  }

  // Locations
  if (flag.locations.length > 0) {
    lines.push(`  ${BOLD}Found in:${RESET}`);
    for (const loc of flag.locations) {
      lines.push(
        `    ${CYAN}${loc.file}:${loc.line}${RESET} ${DIM}(${loc.kind})${RESET}`,
      );
      lines.push(`    ${DIM}${loc.snippet}${RESET}`);
      lines.push('');
    }
  }

  // Dead branches with code preview
  if (flag.deadBranches.length > 0) {
    lines.push(`  ${BOLD}Dead code (${flag.totalDeadLines} lines total):${RESET}`);
    lines.push('');

    for (const branch of flag.deadBranches) {
      lines.push(
        `  ${CYAN}${branch.file}:${branch.startLine}-${branch.endLine}${RESET} (${branch.branchType} branch, ${branch.lineCount} lines)`,
      );

      // Try to show a code preview
      try {
        const absPath = path.resolve(options.path, branch.file);
        const content = fs.readFileSync(absPath, 'utf-8');
        const preview = branchPreview(content, branch, 3);
        for (const line of preview) {
          lines.push(`  ${DIM}|${line}${RESET}`);
        }
      } catch {
        // Can't read file — skip preview
      }
      lines.push('');
    }

    lines.push(`  ${RED}${BOLD}Total dead lines: ${flag.totalDeadLines}${RESET}`);
    lines.push('');
  }

  process.stdout.write(lines.join('\n'));
  return 0;
}
