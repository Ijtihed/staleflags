import type { FlagReport, ScanResult } from '@staleflags/core';

export function formatMarkdown(result: ScanResult): string {
  const lines: string[] = [];
  const { summary } = result;

  lines.push('## staleflags report');
  lines.push('');
  lines.push(
    `**${summary.totalFlags} flags** · ${summary.deadFlags} dead · ${summary.agingFlags} aging · ${summary.activeFlags} active`,
  );

  if (summary.totalDeadLines > 0) {
    lines.push('');
    lines.push(
      `**${summary.totalDeadLines} lines of removable dead code** across ${summary.totalDeadFiles} files`,
    );
  }

  lines.push('');

  // Dead flags table
  const deadFlags = result.flags.filter((f) => f.classification.status === 'dead');
  if (deadFlags.length > 0) {
    lines.push('### Dead flags');
    lines.push('');
    lines.push('| Flag | Value | Stuck Since | Dead Code |');
    lines.push('|------|-------|-------------|-----------|');

    for (const flag of deadFlags) {
      const ageStr = flag.age?.introducedAgo ?? '—';
      const deadFiles = new Set(flag.deadBranches.map((b) => b.file));
      const deadStr =
        flag.totalDeadLines > 0
          ? `${flag.totalDeadLines} lines in ${deadFiles.size} file${deadFiles.size !== 1 ? 's' : ''}`
          : '—';
      lines.push(
        `| \`${flag.name}\` | ${flag.classification.value} everywhere | ${ageStr} | ${deadStr} |`,
      );
    }
    lines.push('');

    // Dead code details
    const flagsWithDead = deadFlags.filter((f) => f.deadBranches.length > 0);
    if (flagsWithDead.length > 0) {
      lines.push('<details>');
      lines.push('<summary>Dead code locations (click to expand)</summary>');
      lines.push('');
      for (const flag of flagsWithDead) {
        lines.push(`**${flag.name}** (${flag.totalDeadLines} lines):`);
        for (const branch of flag.deadBranches) {
          lines.push(
            `- \`${branch.file}:${branch.startLine}-${branch.endLine}\` — ${branch.branchType} branch, ${branch.lineCount} lines`,
          );
        }
        lines.push('');
      }
      lines.push('</details>');
      lines.push('');
    }
  }

  // Active flags
  const activeFlags = result.flags.filter((f) => f.classification.status === 'active');
  if (activeFlags.length > 0) {
    lines.push('### Active flags');
    lines.push('');
    for (const flag of activeFlags) {
      const envStr = Object.entries(flag.classification.environments)
        .map(([env, val]) => `${val} in ${env}`)
        .join(', ');
      lines.push(`- **${flag.name}**: ${envStr}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
